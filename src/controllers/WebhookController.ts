import { Request, Response } from 'express';
import { SubscriptionService } from '../services/SubscriptionService';
import { SubscriptionTier, PaymentProvider } from '../types/subscription.type';
import crypto from 'crypto';

export class WebhookController {
    public static async handlePaystack(req: Request, res: Response): Promise<void> {
        try {
            const hash = crypto
                .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
                .update(JSON.stringify(req.body))
                .digest('hex');

            if (hash !== req.headers['x-paystack-signature']) {
                res.status(401).json({ success: false, message: "Invalid signature" });
                return;
            }

            const { event, data } = req.body;
            console.log("[Paystack Webhook]", {
                event,
                // data
            });
            if (event === 'subscription.create' || event === 'charge.success') {
                const email = data.customer.email;
                const userId = data.metadata?.userId || data.customer.id;
                const timezone = data.metadata?.timezone || 'Africa/Lagos';
                
                // Determine tier from amount
                let tier = SubscriptionTier.TIER_1_NGN;
                if (data.amount === 650000) tier = SubscriptionTier.TIER_2_NGN;
                if (data.amount === 7000000) tier = SubscriptionTier.TIER_3_NGN;

                await SubscriptionService.activateSubscription(
                    userId,
                    email,
                    tier,
                    PaymentProvider.PAYSTACK,
                    data.subscription_code || data.reference,
                    data.email_token,
                    data.customer.customer_code,
                    timezone,
                    data.amount / 100, // Convert Kobo to NGN
                    'NGN'
                );
            }

            if (event === 'subscription.disable' || event === 'subscription.not_renew') {
                if (data.status === 'cancelled' || data.status === 'non-renewing') {
                    await SubscriptionService.cancelSubscription(data.subscription_code);
                }
            }

            res.status(200).send('Webhook Handled');
        } catch (error: any) {
            console.error("[WebhookController] Paystack error:", error.message);
            res.status(500).send('Webhook Error');
        }
    }

    public static async handleStripe(req: Request, res: Response): Promise<void> {
        try {
            // Verification would typically use stripe.webhooks.constructEvent
            // We parse raw properties for resilience if keys differ slightly.
            const { type, data } = req.body;

            if (type === 'checkout.session.completed') {
                const session = data.object;
                const email = session.customer_details?.email || session.customer_email;
                const userId = session.client_reference_id || 'stripe_user';
                const timezone = session.metadata?.timezone || 'Africa/Lagos';

                let tier = SubscriptionTier.TIER_1_USD;
                if (session.amount_total === 500) tier = SubscriptionTier.TIER_2_USD;
                if (session.amount_total === 5000) tier = SubscriptionTier.TIER_3_USD;

                await SubscriptionService.activateSubscription(
                    userId,
                    email,
                    tier,
                    PaymentProvider.STRIPE,
                    session.subscription || session.id,
                    undefined, // Stripe doesn't use tokens for cancellation
                    session.customer,
                    timezone,
                    session.amount_total / 100, // Convert Cents to USD
                    session.currency?.toUpperCase() || 'USD'
                );
            }

            if (type === 'customer.subscription.deleted' || type === 'customer.subscription.updated') {
                const subscription = data.object;
                if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
                    await SubscriptionService.cancelSubscription(subscription.id);
                }
            }

            res.status(200).send('Webhook Handled');
        } catch (error: any) {
            console.error("[WebhookController] Stripe error:", error.message);
            res.status(500).send('Webhook Error');
        }
    }

    public static async handleFlutterwave(req: Request, res: Response): Promise<void> {
        try {
            const secretHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
            const signature = req.headers['verif-hash'];

            if (!signature || signature !== secretHash) {
                res.status(401).json({ success: false, message: "Invalid signature" });
                return;
            }

            const { event, data } = req.body;
            console.log("[Flutterwave Webhook]", { event });

            if (event === 'charge.completed' && data.status === 'successful') {
                const email = data.customer.email;
                // Try to get userId from meta, fallback to customer.id
                const userId = data.meta?.userId || data.customer.id;
                const timezone = data.meta?.timezone || 'Africa/Lagos';
                
                // Determine tier from amount (assuming USD for international)
                // amounts are usually in basic units (not cents) in Flutterwave? 
                // Actually, Flutterwave amounts are usually like 5.00 for $5.
                let tier = SubscriptionTier.TIER_1_USD;
                if (data.amount === 5) tier = SubscriptionTier.TIER_2_USD;
                if (data.amount === 50) tier = SubscriptionTier.TIER_3_USD;

                // If NGN was used, we could map those too
                if (data.currency === 'NGN') {
                    tier = SubscriptionTier.TIER_1_NGN;
                    if (data.amount === 6500) tier = SubscriptionTier.TIER_2_NGN;
                    if (data.amount === 70000) tier = SubscriptionTier.TIER_3_NGN;
                }

                await SubscriptionService.activateSubscription(
                    userId,
                    email,
                    tier,
                    PaymentProvider.FLUTTERWAVE,
                    data.tx_ref, // Using tx_ref as providerId for verification later if needed
                    data.id.toString(),
                    timezone,
                    data.amount,
                    data.currency
                );
            }

            res.status(200).send('Webhook Handled');
        } catch (error: any) {
            console.error("[WebhookController] Flutterwave error:", error.message);
            res.status(500).send('Webhook Error');
        }
    }
}
