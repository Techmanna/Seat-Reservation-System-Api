import { SubscriptionModel } from '../../models/Subscription';
import { SubscriptionStatus } from '../../types/subscription.type';
import { NotificationService } from '../NotificationService';
import { NotificationType } from '../../models/Notification';
import { logger } from '../../utils/logger';
import { DateTime } from 'luxon';
import { SubscriptionService } from '../SubscriptionService';

const notificationService = new NotificationService();

export async function sendExpirationReminders(): Promise<void> {
    try {
        const threeDaysFromNow = DateTime.now().plus({ days: 3 }).toJSDate();
        const fourDaysFromNow = DateTime.now().plus({ days: 4 }).toJSDate();

        const expiringSubscriptions = await SubscriptionModel.find({
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: { $gte: threeDaysFromNow, $lt: fourDaysFromNow }
        });

        for (const sub of expiringSubscriptions) {
            await notificationService.notify(
                sub.userId.toString(),
                NotificationType.REMINDER,
                'Subscription Expiring Soon',
                `Your subscription will expire on ${sub.currentPeriodEnd.toLocaleDateString()}. Renew now to avoid losing access!`,
                { expiry: sub.currentPeriodEnd }
            );
        }
    } catch (error) {
        logger.error('[CronService] Expiration reminders failed:', error);
    }
}

export async function checkAndCleanupExpiredSubscriptions(): Promise<void> {
    try {
        const now = new Date();
        // Find active subscriptions that have passed their period end
        const expiredSubscriptions = await SubscriptionModel.find({
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: { $lt: now }
        });

        if (expiredSubscriptions.length === 0) return;

        logger.info(`[CronService] Found ${expiredSubscriptions.length} expired subscriptions. Cleaning up...`);

        for (const sub of expiredSubscriptions) {
            try {
                // We use the subscription service to handle the complex cancellation logic 
                // (removing from Zoom, clearing join URLs, etc.)
                // If providerSubscriptionId is missing (e.g. for some manual subs), 
                // we'll need to handle it.
                if (sub.providerSubscriptionId) {
                    await SubscriptionService.cancelSubscription(sub.providerSubscriptionId);
                } else {
                    // Manual cleanup for subscriptions without provider IDs
                    sub.status = SubscriptionStatus.CANCELLED;
                    sub.zoomJoinUrl = undefined;
                    sub.zoomRegistrantId = undefined;
                    await sub.save();
                }
                logger.info(`[CronService] Deactivated expired subscription for: ${sub.email}`);
            } catch (subError) {
                logger.error(`[CronService] Failed to cleanup sub for ${sub.email}:`, subError);
            }
        }
    } catch (error) {
        logger.error('[CronService] Expired subscription cleanup failed:', error);
    }
}
