import { Types } from 'mongoose';
import { NotificationModel, NotificationType, INotification } from '../models/Notification';
import { NotificationPreferenceModel, INotificationPreference } from '../models/NotificationPreference';
import { 
    NotificationResponseDto, 
    NotificationListDto, 
    UpdateNotificationPreferenceDto,
    NotificationPreferenceResponseDto
} from '../dtos/notification.dto';
import { logger } from '../utils/logger';

export class InAppNotificationService {
    
    /**
     * Create an in-app notification
     */
    async createNotification(
        userId: string | Types.ObjectId,
        type: NotificationType,
        title: string,
        message: string,
        data: any = {}
    ): Promise<INotification | null> {
        try {
            // Check preferences first
            const prefs = await this.getPreferences(userId.toString());
            const category = type.toLowerCase() as keyof INotificationPreference;
            
            // If the user has disabled in-app for this category, skip
            // Note: 'reminders', 'events', 'billing' map to type categories
            let shouldSend = true;
            if (type === NotificationType.REMINDER && !prefs.reminders.inApp) shouldSend = false;
            if (type === NotificationType.EVENT && !prefs.events.inApp) shouldSend = false;
            if (type === NotificationType.BILLING && !prefs.billing.inApp) shouldSend = false;

            if (!shouldSend) return null;

            const notification = await NotificationModel.create({
                userId,
                type,
                title,
                message,
                data,
                isRead: false
            });

            return notification;
        } catch (error) {
            logger.error('[InAppNotificationService] Failed to create notification:', error);
            return null;
        }
    }

    /**
     * Get paginated notifications for a user
     */
    async getNotifications(
        userId: string,
        page: number = 1,
        limit: number = 20,
        filter: { type?: NotificationType; isRead?: boolean } = {}
    ): Promise<NotificationListDto> {
        const query: any = { userId };
        if (filter.type) query.type = filter.type;
        if (filter.isRead !== undefined) query.isRead = filter.isRead;

        const skip = (page - 1) * limit;

        const [notifications, total, unreadCount] = await Promise.all([
            NotificationModel.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            NotificationModel.countDocuments(query),
            NotificationModel.countDocuments({ userId, isRead: false })
        ]);

        return {
            notifications: notifications.map(n => this.mapToDto(n)),
            total,
            unreadCount,
            page,
            limit
        };
    }

    /**
     * Mark a specific notification as read
     */
    async markAsRead(userId: string, notificationId: string): Promise<boolean> {
        const result = await NotificationModel.updateOne(
            { _id: notificationId, userId },
            { isRead: true }
        );
        return result.modifiedCount > 0;
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId: string): Promise<number> {
        const result = await NotificationModel.updateMany(
            { userId, isRead: false },
            { isRead: true }
        );
        return result.modifiedCount;
    }

    /**
     * Delete a notification
     */
    async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
        const result = await NotificationModel.deleteOne({ _id: notificationId, userId });
        return result.deletedCount > 0;
    }

    /**
     * Clear all notifications for a user
     */
    async clearAll(userId: string): Promise<number> {
        const result = await NotificationModel.deleteMany({ userId });
        return result.deletedCount;
    }

    /**
     * Get user notification preferences
     */
    async getPreferences(userId: string): Promise<INotificationPreference> {
        let prefs = await NotificationPreferenceModel.findOne({ userId });
        if (!prefs) {
            prefs = await NotificationPreferenceModel.create({ userId });
        }
        return prefs;
    }

    /**
     * Update user notification preferences
     */
    async updatePreferences(
        userId: string,
        updateDto: UpdateNotificationPreferenceDto
    ): Promise<NotificationPreferenceResponseDto> {
        let prefs = await NotificationPreferenceModel.findOne({ userId });
        if (!prefs) {
            prefs = new NotificationPreferenceModel({ userId });
        }

        if (updateDto.reminders) {
            prefs.reminders = { ...prefs.reminders, ...updateDto.reminders };
        }
        if (updateDto.events) {
            prefs.events = { ...prefs.events, ...updateDto.events };
        }
        if (updateDto.billing) {
            prefs.billing = { ...prefs.billing, ...updateDto.billing };
        }

        await prefs.save();

        return {
            reminders: prefs.reminders,
            events: prefs.events,
            billing: prefs.billing
        };
    }

    private mapToDto(notification: INotification): NotificationResponseDto {
        return {
            id: (notification._id as any).toString(),
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            isRead: notification.isRead,
            createdAt: notification.createdAt.toISOString()
        };
    }
}
