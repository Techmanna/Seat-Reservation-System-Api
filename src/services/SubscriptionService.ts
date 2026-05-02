import { SubscriptionModel } from '../models/Subscription';
import { ISubscription, SubscriptionTier, SubscriptionStatus, PaymentProvider } from '../types/subscription.type';
import { ZoomService } from './ZoomService';
import mongoose from 'mongoose';
import { CronService } from './CronService';
import { EventModel } from '../models/Event';
import { DateTime } from 'luxon';

export class SubscriptionService {
    public static async activateSubscription(
        userId: string,
        email: string,
        tier: SubscriptionTier,
        provider: PaymentProvider,
        providerSubscriptionId?: string,
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
            subscription.status = SubscriptionStatus.ACTIVE;
            subscription.tier = tier;
            subscription.provider = provider;
            subscription.currentPeriodEnd = currentPeriodEnd;
            if (providerSubscriptionId) subscription.providerSubscriptionId = providerSubscriptionId;
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
                console.error("[SubscriptionService] Failed to record transaction:", txError);
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
                console.error("[SubscriptionService] Zoom registration failed for new subscriber:", zoomError);
            }
        }

        await subscription.save();

        // Add immediately to upcoming daily events
        try {
            await CronService.addSubscriberToUpcomingEvents(email);
        } catch (e) {
            console.error("[SubscriptionService] Cron immediate hook failed:", e);
        }

        return subscription;
    }

    public static async cancelSubscription(providerSubscriptionId: string): Promise<ISubscription | null> {
        const subscription = await SubscriptionModel.findOne({ providerSubscriptionId });
        if (!subscription) return null;

        subscription.status = SubscriptionStatus.CANCELLED;
        
        // Remove from Zoom Webinar
        const webinarId = process.env.ZOOM_WEBINAR_ID;
        if (webinarId && subscription.zoomRegistrantId) {
            try {
                await ZoomService.removeSubscriber(webinarId, subscription.zoomRegistrantId);
            } catch (zoomError) {
                console.error("[SubscriptionService] Zoom removal failed upon cancellation:", zoomError);
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
            console.error("[SubscriptionService] Standard meeting attendee removal failed:", meetingError);
        }

        subscription.zoomJoinUrl = undefined;
        subscription.zoomRegistrantId = undefined;
        subscription.status = SubscriptionStatus.CANCELLED;

        await subscription.save();
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
}
