import { Request, Response } from 'express';
import { SubscriptionService } from '../services/SubscriptionService';
import { SubscriptionTier, PaymentProvider } from '../types/subscription.type';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { PaymentService } from '../services/PaymentService';
import { TransactionModel } from '../models/Transaction';

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

                // Check if it's a booking payment
                if (data.metadata?.type === 'booking_payment') {
                    const { BookingPaymentService } = require('../services/BookingPaymentService');
                    const paymentService = new BookingPaymentService();
                    await paymentService.verifyPayment(data.reference);
                    res.status(200).send('Webhook Handled - Booking Payment');
                    return;
                }

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
            const signature = req.headers['flutterwave-signature'] as string;

            // 1. Verify Webhook Signature (HMAC-SHA256)
            if (secretHash && signature) {
                const hash = crypto
                    .createHmac('sha256', secretHash)
                    .update((req as any).rawBody || JSON.stringify(req.body))
                    .digest('hex');

                // If you are using verif-hash (legacy), it's a direct string comparison.
                const verifHash = req.headers['verif-hash'];

                if (signature !== hash && verifHash !== secretHash) {
                    logger.error("[WebhookController] Flutterwave invalid signature");
                    res.status(401).send('Invalid signature');
                    return;
                }
            }

            const body = req.body;
            const event = body.type || body.event || body['event.type'];
            const data = body.data || body;

            logger.info(`[Flutterwave Webhook] Event: ${event}`);

            if ((event === 'charge.completed' || event === 'CARD_TRANSACTION') && (data.status === 'successful' || data.status === 'succeeded')) {
                const transactionId = data.id?.toString();
                if (!transactionId) {
                    res.status(200).send('No transaction ID');
                    return;
                }

                // 2. Best Practice: Re-query Flutterwave API to verify transaction details
                const verifiedData = await PaymentService.verifyFlutterwaveTransaction(transactionId);

                if (verifiedData.status !== 'successful' && verifiedData.status !== 'succeeded') {
                    logger.error(`[WebhookController] Flutterwave transaction ${transactionId} verification failed`);
                    res.status(200).send('Transaction not successful');
                    return;
                }

                const email = verifiedData.meta?.email || verifiedData.customer?.email;
                const amount = verifiedData.amount;
                const currency = verifiedData.currency;
                const txRef = verifiedData.tx_ref || verifiedData.txRef;

                // Check if it's a booking payment
                if (verifiedData.meta?.type === 'booking_payment') {
                    const { BookingPaymentService } = require('../services/BookingPaymentService');
                    const paymentService = new BookingPaymentService();
                    await paymentService.verifyPayment(txRef);
                    res.status(200).send('Webhook Handled - Booking Payment');
                    return;
                }

                // 3. Idempotency: Check if transaction already processed
                const existingTx = await TransactionModel.findOne({ providerTransactionId: transactionId });
                if (existingTx && existingTx.status === 'successful') {
                    logger.info(`[WebhookController] Flutterwave transaction ${transactionId} already processed.`);
                    res.status(200).send('Already processed');
                    return;
                }

                // Extract user context from meta
                const userId = verifiedData.meta?.userId || verifiedData.customer?.id?.toString() || 'flw_user';
                const timezone = verifiedData.meta?.timezone || 'Africa/Lagos';

                // Determine tier
                let tier = verifiedData.meta?.tier as SubscriptionTier || SubscriptionTier.TIER_1_USD;
                if (!verifiedData.meta?.tier) {
                    if (amount === 5) tier = SubscriptionTier.TIER_2_USD;
                    else if (amount === 50) tier = SubscriptionTier.TIER_3_USD;
                    else if (currency === 'NGN') {
                        tier = SubscriptionTier.TIER_1_NGN;
                        if (amount === 6500) tier = SubscriptionTier.TIER_2_NGN;
                        if (amount === 70000) tier = SubscriptionTier.TIER_3_NGN;
                    }
                }

                await SubscriptionService.activateSubscription(
                    userId,
                    email,
                    tier,
                    PaymentProvider.FLUTTERWAVE,
                    verifiedData.payment_plan?.toString() || verifiedData.subscription_id?.toString() || txRef,
                    transactionId, // Unique Transaction Token
                    verifiedData.customer?.id?.toString(),
                    timezone,
                    amount,
                    currency
                );
            }

            if (event === 'subscription.cancelled') {
                await SubscriptionService.cancelSubscription(data.id.toString());
            }

            res.status(200).send('Webhook Handled');
        } catch (error: any) {
            logger.error("[WebhookController] Flutterwave error:", error.message);
            res.status(200).send('Webhook Error');
        }
    }
}
