import { Request, Response } from 'express';
import { SubscriptionService } from '../services/SubscriptionService';
import { SubscriptionModel } from '../models/Subscription';
import { EventModel } from '../models/Event';
import { ApiResponse } from '../types/index';
import { SubscriptionTier, PaymentProvider, SubscriptionStatus } from '../types/subscription.type';
import axios from 'axios';
import Stripe from 'stripe';
import jwt from 'jsonwebtoken';
import { SubscriptionDTO } from '../dtos/subscription.dto';
import { ZoomService } from '../services/ZoomService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
    apiVersion: '2026-04-22.dahlia',
});

export class SubscriptionController {
    public static async getStatus(req: Request, res: Response): Promise<void> {
        try {
            const email = req.query.email as string;

            if (!email) {
                res.status(400).json({
                    success: false,
                    message: "Email parameter is required"
                });
                return;
            }

            const subscription = await SubscriptionModel.findOne({ email });

            if (!subscription) {
                res.status(200).json({
                    success: false,
                    message: "Subscription not found"
                });
                return;
            }

            const hasAccess = await SubscriptionService.checkAccess(email);

            res.status(200).json({
                success: true,
                message: "Subscription details fetched",
                data: {
                    subscription: SubscriptionDTO.toResponse(subscription),
                    hasAccess
                }
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message || "Internal error"
            });
        }
    }

    // public static async getStatus(req: Request, res: Response): Promise<void> {
    //     try {
    //         const email = req.query.email as string;
    //         if (!email) {
    //             res.status(400).json({ success: false, message: "Email parameter is required" });
    //             return;
    //         }

    //         const subscription = await SubscriptionModel.findOne({ email });
    //         if (!subscription) {
    //             res.status(200).json({ success: false, message: "Subscription not found" });
    //             return;
    //         }

    //         const hasAccess = await SubscriptionService.checkAccess(email);

    //         const { userId, email: subEmail, tier, provider, providerSubscriptionId, providerCustomerId, currentPeriodEnd, zoomRegistrantId, lastZoomMeetingId, timezone, createdAt, updatedAt } = subscription;

    //         res.status(200).json({
    //             success: true,
    //             message: "Subscription details fetched",
    //             data: {
    //                 subscription: {
    //                     userId,
    //                     email: subEmail,
    //                     tier,
    //                     provider,
    //                     providerSubscriptionId,
    //                     providerCustomerId,
    //                     currentPeriodEnd,
    //                     zoomRegistrantId,
    //                     lastZoomMeetingId,
    //                     timezone,
    //                     createdAt,
    //                     updatedAt
    //                 },
    //                 hasAccess
    //             }
    //         });
    //     } catch (error: any) {
    //         res.status(500).json({ success: false, message: error.message || "Internal error" });
    //     }
    // }


    // In your signature endpoint (backend)
    public static async getZoomSignature(
        meetingId: string,
        role: number,
        requesterEmail: string
    ): Promise<string> {
        const subscription = await SubscriptionModel.findOne({
            email: requesterEmail,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: { $gte: new Date() }
        });

        if (!subscription) throw new Error('No active subscription found');

        const iat = Math.floor(Date.now() / 1000) - 30;
        const exp = iat + 60 * 60 * 2;

        const payload = {
            sdkKey: process.env.ZOOM_SDK_KEY,
            mn: parseInt(meetingId),
            role,
            iat,
            exp,
            tokenExp: exp,
        };

        return jwt.sign(payload, process.env.ZOOM_SDK_SECRET!, { algorithm: 'HS256' });
    }

    public static async getVideoSDKSignature(
        sessionName: string,
        role: number,
        requesterEmail: string
    ): Promise<string> {
        console.log({
            sessionName,
            role,
            requesterEmail
        });

        const subscription = await SubscriptionModel.findOne({
            email: requesterEmail,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: { $gte: new Date() }
        });

        if (!subscription) throw new Error('No active subscription found');

        const iat = Math.floor(Date.now() / 1000);
        const exp = iat + 60 * 60 * 2;

        const payload = {
            app_key: process.env.ZOOM_SDK_KEY,
            tpc: sessionName,
            role_type: role,
            version: 1,
            iat,
            exp,
        };

        return jwt.sign(payload, process.env.ZOOM_SDK_SECRET!, { algorithm: 'HS256' });
    }

    // New backend endpoint
    public static async getJoinToken(email: string, meetingId: string): Promise<string> {
        // 1. Find active subscription regardless of which meeting was last
        const subscription = await SubscriptionModel.findOne({
            email,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: { $gte: new Date() }
        }).populate('user', 'name');

        if (!subscription) {
            throw new Error('No active subscription found');
        }

        // 2. If already registered for this meeting, just extract the token
        if (subscription.lastZoomMeetingId === meetingId && subscription.zoomJoinUrl) {
            try {
                const url = new URL(subscription.zoomJoinUrl);
                const tk = url.searchParams.get('tk');
                if (tk) return tk;
            } catch (e) {
                // fall through to re-registration if URL is malformed
            }
        }

        // 3. Not registered for this meeting? Register them now!
        console.log(`[SubscriptionController] Registering ${email} on-the-fly for meeting ${meetingId}`);

        const name = (subscription as any).user?.name || 'Subscriber';
        const nameParts = name.split(' ');
        const firstName = nameParts[0] || 'Subscriber';
        const lastName = nameParts.slice(1).join(' ') || 'Member';

        try {
            const zoomRegistrant = await ZoomService.registerMeetingAttendee(
                meetingId,
                email,
                firstName,
                lastName
            );

            // subscription.zoomJoinUrl = zoomRegistrant.join_url;
            subscription.zoomRegistrantId = zoomRegistrant.registrant_id;
            subscription.lastZoomMeetingId = meetingId;
            await subscription.save();

            const url = new URL(zoomRegistrant.join_url);
            const tk = url.searchParams.get('tk');
            if (!tk) throw new Error('Zoom returned join URL without tk parameter');
            return tk;
        } catch (error: any) {
            console.error(`[SubscriptionController] On-the-fly registration failed:`, error.message);
            throw new Error(`Failed to register for live stream: ${error.message}`);
        }
    }

    public static async initializePaystack(req: Request, res: Response): Promise<void> {
        try {
            const { email, userId, plan, timezone } = req.body;
            if (!email || !userId || !plan) {
                res.status(400).json({ success: false, message: "Email, userId, and plan are required" });
                return;
            }

            let amount = 0;
            let tier = SubscriptionTier.TIER_1_NGN;
            let paystackPlanCode = "";

            if (plan === 'weekly') {
                amount = 2500 * 100;
                tier = SubscriptionTier.TIER_1_NGN;
                paystackPlanCode = process.env.PAYSTACK_PLAN_TIER_1 || "";
            } else if (plan === 'monthly') {
                amount = 6500 * 100;
                tier = SubscriptionTier.TIER_2_NGN;
                paystackPlanCode = process.env.PAYSTACK_PLAN_TIER_2 || "";
            } else if (plan === 'annual') {
                amount = 70000 * 100;
                tier = SubscriptionTier.TIER_3_NGN;
                paystackPlanCode = process.env.PAYSTACK_PLAN_TIER_3 || "";
            }

            // Guard: reject if user already has an active subscription on the same tier
            const existingSub = await SubscriptionModel.findOne({ email, status: SubscriptionStatus.ACTIVE });
            if (existingSub && existingSub.tier === tier) {
                res.status(409).json({
                    success: false,
                    message: `You already have an active ${plan} subscription. To change plans, select a different tier.`
                });
                return;
            }

            const paystackResponse = await axios.post(
                'https://api.paystack.co/transaction/initialize',
                {
                    email,
                    amount,
                    plan: paystackPlanCode,
                    metadata: {
                        userId,
                        tier,
                        timezone: timezone || 'Africa/Lagos',
                        provider: PaymentProvider.PAYSTACK
                    },
                    callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5177'}/member`
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                    }
                }
            );

            res.status(200).json({
                success: true,
                message: "Paystack initialized",
                data: {
                    authorizationUrl: paystackResponse.data.data.authorization_url,
                    reference: paystackResponse.data.data.reference
                }
            });
        } catch (error: any) {
            console.error("Paystack Init Error:", error.response?.data || error.message);
            res.status(500).json({ success: false, message: "Payment initialization failed" });
        }
    }

    public static async initializeStripe(req: Request, res: Response): Promise<void> {
        try {
            const { email, userId, plan, timezone } = req.body;
            if (!email || !userId || !plan) {
                res.status(400).json({ success: false, message: "Email, userId, and plan are required" });
                return;
            }

            let amount = 0;
            let tier = SubscriptionTier.TIER_1_USD;
            if (plan === 'weekly') { amount = 200; tier = SubscriptionTier.TIER_1_USD; }
            else if (plan === 'monthly') { amount = 500; tier = SubscriptionTier.TIER_2_USD; }
            else if (plan === 'annual') { amount = 5000; tier = SubscriptionTier.TIER_3_USD; }

            // Guard: reject if user already has an active subscription on the same tier
            const existingSub = await SubscriptionModel.findOne({ email, status: SubscriptionStatus.ACTIVE });
            if (existingSub && existingSub.tier === tier) {
                res.status(409).json({
                    success: false,
                    message: `You already have an active ${plan} subscription. To change plans, select a different tier.`
                });
                return;
            }

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `The Morayo Show - ${plan} Subscription`,
                        },
                        unit_amount: amount,
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${process.env.FRONTEND_URL || 'http://localhost:5177'}/member?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5177'}/subscription`,
                customer_email: email,
                metadata: {
                    userId,
                    tier,
                    timezone: timezone || 'Africa/Lagos',
                    provider: PaymentProvider.STRIPE
                }
            });

            res.status(200).json({
                success: true,
                message: "Stripe initialized",
                data: {
                    url: session.url
                }
            });
        } catch (error: any) {
            console.error("Stripe Init Error:", error.message);
            res.status(500).json({ success: false, message: "Payment initialization failed" });
        }
    }

    public static async handlePaystackWebhook(req: Request, res: Response): Promise<void> {
        try {
            const event = req.body;
            if (event.event === 'charge.success') {
                const { metadata, customer, reference } = event.data;
                if (metadata && metadata.userId && metadata.tier) {
                    await SubscriptionService.activateSubscription(
                        metadata.userId,
                        customer.email,
                        metadata.tier as SubscriptionTier,
                        PaymentProvider.PAYSTACK,
                        reference,
                        customer.id?.toString()
                    );
                }
            }
            res.status(200).send('Webhook received');
        } catch (error) {
            console.error('Paystack Webhook Error:', error);
            res.status(500).send('Webhook Error');
        }
    }

    public static async handleStripeWebhook(req: Request, res: Response): Promise<void> {
        const sig = req.headers['stripe-signature'] as string;
        let event;

        try {
            event = stripe.webhooks.constructEvent(
                req.body, // Make sure raw body is used in routing for this endpoint!
                sig,
                process.env.STRIPE_WEBHOOK_SECRET || ''
            );
        } catch (err: any) {
            console.error("Stripe Webhook Signature Error:", err.message);
            res.status(400).send(`Webhook Error: ${err.message}`);
            return;
        }

        try {
            if (event.type === 'checkout.session.completed') {
                const session = event.data.object as any;
                const metadata = session.metadata;

                if (metadata && metadata.userId && metadata.tier && session.customer_details?.email) {
                    await SubscriptionService.activateSubscription(
                        metadata.userId,
                        session.customer_details.email,
                        metadata.tier as SubscriptionTier,
                        PaymentProvider.STRIPE,
                        session.id,
                        session.customer as string
                    );
                }
            }
            res.status(200).send('Webhook received');
        } catch (error) {
            console.error('Stripe Webhook Processing Error:', error);
            res.status(500).send('Webhook Error');
        }
    }
}
