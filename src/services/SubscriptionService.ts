import { SubscriptionModel } from '../models/Subscription';
import { ISubscription, SubscriptionTier, SubscriptionStatus, PaymentProvider } from '../types/subscription.type';
import { ZoomService } from './ZoomService';
import mongoose from 'mongoose';
import { CronService } from './CronService';
import { EventModel } from '../models/Event';
import { DateTime } from 'luxon';
import { logger } from '../utils/logger';
import { NotificationService } from './NotificationService';
import { NotificationType } from '../models/Notification';

const notificationService = new NotificationService();

export class SubscriptionService {
    public static async activateSubscription(
        userId: string,
        email: string,
        tier: SubscriptionTier,
        provider: PaymentProvider,
        providerSubscriptionId?: string,
        providerSubscriptionToken?: string,
        providerCustomerId?: string,
        timezone?: string,
        amount?: number,
        currency?: string
    ): Promise<ISubscription> {
        const LAGOS_ZONE = 'Africa/Lagos';
        const now = DateTime.now().setZone(LAGOS_ZONE);
        let periodEnd: DateTime;

        // Calculate period end based on tier
        if (tier === SubscriptionTier.TIER_1_NGN || tier === SubscriptionTier.TIER_1_USD) {
            periodEnd = now.plus({ days: 7 });
        } else if (tier === SubscriptionTier.TIER_2_NGN || tier === SubscriptionTier.TIER_2_USD) {
            periodEnd = now.plus({ days: 30 });
        } else if (tier === SubscriptionTier.TIER_3_NGN || tier === SubscriptionTier.TIER_3_USD) {
            periodEnd = now.plus({ days: 365 });
        } else {
            periodEnd = now.plus({ days: 30 }); // fallback
        }

        const currentPeriodEnd = periodEnd.toJSDate();
        let subscription = await SubscriptionModel.findOne({ email });

        if (subscription) {
            // If the user is changing tiers or providers, cancel the old one in the gateway
            if (subscription.status === SubscriptionStatus.ACTIVE && 
                subscription.providerSubscriptionId && 
                subscription.providerSubscriptionId !== providerSubscriptionId) {
                
                logger.info(`[SubscriptionService] Upgrading/Changing plan for ${email}. Cancelling old subscription ${subscription.providerSubscriptionId}`);
                // Call cancelSubscription but without revoking Zoom access yet, 
                // because we are about to re-activate it for the new tier.
                // Actually, cancelSubscription handles Zoom too. 
                // Let's just do the gateway part here or make cancelSubscription modular.
                
                try {
                    if (subscription.provider === PaymentProvider.STRIPE) {
                        const Stripe = require('stripe');
                        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
                        await stripe.subscriptions.cancel(subscription.providerSubscriptionId);
                    } else if (subscription.provider === PaymentProvider.PAYSTACK) {
                        const axios = require('axios');
                        await axios.post(
                            'https://api.paystack.co/subscription/disable',
                            { code: subscription.providerSubscriptionId, token: subscription.providerSubscriptionToken },
                            { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
                        );
                    }
                } catch (e: any) {
                    logger.error(`[SubscriptionService] Failed to cancel old plan during upgrade:`, e.message);
                }
            }

            subscription.status = SubscriptionStatus.ACTIVE;
            subscription.tier = tier;
            subscription.provider = provider;
            subscription.currentPeriodEnd = currentPeriodEnd;
            if (providerSubscriptionId) subscription.providerSubscriptionId = providerSubscriptionId;
            if (providerSubscriptionToken) subscription.providerSubscriptionToken = providerSubscriptionToken;
            if (providerCustomerId) subscription.providerCustomerId = providerCustomerId;
            if (timezone) subscription.timezone = timezone;
        } else {
            subscription = new SubscriptionModel({
                userId: new mongoose.Types.ObjectId(userId),
                email,
                tier,
                status: SubscriptionStatus.ACTIVE,
                provider,
                providerSubscriptionId,
                providerSubscriptionToken,
                providerCustomerId,
                currentPeriodEnd,
                timezone: timezone || LAGOS_ZONE
            });
        }

        // Record Transaction
        if (amount && providerSubscriptionId) {
            try {
                const { TransactionModel } = require('../models/Transaction');
                await TransactionModel.findOneAndUpdate(
                    { providerTransactionId: providerSubscriptionId },
                    {
                        userId: subscription.userId,
                        email: subscription.email,
                        amount,
                        currency: currency || 'NGN',
                        provider: provider as any,
                        providerTransactionId: providerSubscriptionId,
                        status: 'successful',
                        tier
                    },
                    { upsert: true, new: true }
                );
            } catch (txError) {
                logger.error("[SubscriptionService] Failed to record transaction:", txError);
            }
        }

        // Register for default Webinar if webinar ID is in ENV
        const webinarId = process.env.ZOOM_WEBINAR_ID;
        if (webinarId) {
            try {
                const zoomData = await ZoomService.registerSubscriber(
                    webinarId,
                    email,
                    'Subscriber', // Placeholder names
                    'Member'
                );
                subscription.zoomJoinUrl = zoomData.join_url;
                subscription.zoomRegistrantId = zoomData.registrant_id;

                // Record Webinar Registration
                const { EventRegistrationModel } = require('../models/EventRegistration');
                await EventRegistrationModel.findOneAndUpdate(
                    { userId: subscription.userId, zoomMeetingId: webinarId },
                    {
                        email: subscription.email,
                        eventId: new mongoose.Types.ObjectId(), // Placeholder or link to a virtual 'webinar' event
                        zoomMeetingId: webinarId,
                        zoomRegistrantId: zoomData.registrant_id,
                        zoomJoinUrl: zoomData.join_url,
                        registrationType: 'webinar'
                    },
                    { upsert: true, new: true }
                );
            } catch (zoomError) {
                logger.error("[SubscriptionService] Zoom registration failed for new subscriber:", zoomError);
            }
        }

        await subscription.save();

        // Notify user
        notificationService.notify(
            userId,
            NotificationType.BILLING,
            'Subscription Activated',
            `Your ${tier} subscription has been successfully activated until ${currentPeriodEnd.toLocaleDateString()}.`,
            { tier, expiry: currentPeriodEnd }
        );

        // Add immediately to upcoming daily events
        try {
            await CronService.addSubscriberToUpcomingEvents(email);
        } catch (e) {
            logger.error("[SubscriptionService] Cron immediate hook failed:", e);
        }

        return subscription;
    }

    public static async cancelSubscription(providerSubscriptionId: string): Promise<ISubscription | null> {
        const subscription = await SubscriptionModel.findOne({ providerSubscriptionId });
        if (!subscription) return null;

        // 1. Cancel in Payment Gateway
        try {
            if (subscription.provider === PaymentProvider.STRIPE && subscription.providerSubscriptionId) {
                const Stripe = require('stripe');
                const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
                // We use update with cancel_at_period_end to let them finish their time, 
                // but the user's Zoom access is revoked immediately below as per requirement.
                // If the user wants immediate gateway cancellation:
                await stripe.subscriptions.cancel(subscription.providerSubscriptionId);
                logger.info(`[SubscriptionService] Stripe subscription cancelled: ${subscription.providerSubscriptionId}`);
            } else if (subscription.provider === PaymentProvider.PAYSTACK && subscription.providerSubscriptionId) {
                const axios = require('axios');
                await axios.post(
                    'https://api.paystack.co/subscription/disable',
                    { 
                        code: subscription.providerSubscriptionId,
                        token: subscription.providerSubscriptionToken 
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                        }
                    }
                );
                logger.info(`[SubscriptionService] Paystack subscription disabled: ${subscription.providerSubscriptionId}`);
            }
        } catch (gatewayError: any) {
            // Log error but continue with internal cleanup
            logger.error(`[SubscriptionService] Gateway cancellation failed for ${subscription.email}:`, gatewayError.message);
        }

        subscription.status = SubscriptionStatus.CANCELLED;
        
        // Remove from Zoom Webinar
        const webinarId = process.env.ZOOM_WEBINAR_ID;
        if (webinarId && subscription.zoomRegistrantId) {
            try {
                await ZoomService.removeSubscriber(webinarId, subscription.zoomRegistrantId);
            } catch (zoomError) {
                logger.error("[SubscriptionService] Zoom removal failed upon cancellation:", zoomError);
            }
        }

        // Remove from daily Zoom Meeting if event exists for today
        try {
            const LAGOS_ZONE = 'Africa/Lagos';
            const now = DateTime.now().setZone(LAGOS_ZONE);
            const start = now.startOf('day').toJSDate();
            const end = now.endOf('day').toJSDate();

            const event = await EventModel.findOne({
                date: { $gte: start, $lte: end }
            });

            if (event && event.zoomMeetingId && subscription.zoomRegistrantId) {
                await ZoomService.removeMeetingAttendee(event.zoomMeetingId, subscription.zoomRegistrantId);
            }
        } catch (meetingError) {
            logger.error("[SubscriptionService] Standard meeting attendee removal failed:", meetingError);
        }

        subscription.zoomJoinUrl = undefined;
        subscription.zoomRegistrantId = undefined;
        subscription.status = SubscriptionStatus.CANCELLED;

        await subscription.save();

        // Notify user
        notificationService.notify(
            subscription.userId.toString(),
            NotificationType.BILLING,
            'Subscription Cancelled',
            'Your subscription has been successfully cancelled. You will still have access until the end of your current period.',
            { status: 'cancelled' }
        );

        return subscription;
    }

    public static async checkAccess(email: string): Promise<boolean> {
        const subscription = await SubscriptionModel.findOne({ email });
        if (!subscription) return false;
        
        // Validate status and expiration constraints
        const now = DateTime.now().toJSDate();
        const isValid = subscription.status === SubscriptionStatus.ACTIVE && 
                        subscription.currentPeriodEnd > now;
        return isValid;
    }

    public static async getBillingHistory(email: string) {
        const { TransactionModel } = require('../models/Transaction');
        const { EventRegistrationModel } = require('../models/EventRegistration');
        const { EventModel } = require('../models/Event');

        const subscription = await SubscriptionModel.findOne({ email });
        if (!subscription) return null;

        // 1. Fetch Transactions
        const transactions = await TransactionModel.find({ email }).sort({ createdAt: -1 });

        // 2. Fetch Event Registrations with Event Titles
        const registrations = await EventRegistrationModel.find({ email })
            .populate({ path: 'eventId', model: EventModel, select: 'title date time' })
            .sort({ createdAt: -1 });

        // 3. Calculate Summary Stats
        const totalSpent = transactions
            .filter((t: any) => t.status === 'successful')
            .reduce((sum: number, t: any) => sum + (t.amount / 100), 0);

        const activePlan = subscription.status === SubscriptionStatus.ACTIVE ? {
            tier: subscription.tier,
            renewsAt: subscription.currentPeriodEnd,
            amount: subscription.tier.includes('NGN') ? 6500 : 5.00, // Hardcoded for demo/display logic
            currency: subscription.tier.includes('NGN') ? '₦' : '$'
        } : null;

        const showsAccessed = registrations.length;

        // 4. Combine into a timeline
        const history = [
            ...transactions.map((t: any) => ({
                id: t._id,
                type: 'subscription',
                title: `${t.tier.split('_')[0].charAt(0).toUpperCase() + t.tier.split('_')[0].slice(1)} subscription`,
                date: t.createdAt,
                amount: t.amount / 100,
                currency: t.currency === 'NGN' ? '₦' : '$',
                status: t.status,
                meta: t.provider
            })),
            ...registrations.map((r: any) => ({
                id: r._id,
                type: 'show_access',
                title: r.eventId?.title || 'Show access granted',
                date: r.createdAt,
                amount: 0,
                currency: '',
                status: 'included',
                meta: 'auto-registered'
            }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return {
            stats: {
                totalSpent,
                activePlan,
                showsAccessed
            },
            history
        };
    }
}
