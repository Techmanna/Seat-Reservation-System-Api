import { Request, Response } from 'express';
import { InAppNotificationService } from '../services/InAppNotificationService';
import { NotificationType } from '../models/Notification';
import { logger } from '../utils/logger';

const notificationService = new InAppNotificationService();

export class NotificationController {
    
    /**
     * Get user notifications
     */
    async getNotifications(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const type = req.query.type as NotificationType;
            const isRead = req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined;

            const result = await notificationService.getNotifications(userId, page, limit, { type, isRead });

            return res.status(200).json({
                success: true,
                message: 'Notifications retrieved successfully',
                data: result
            });
        } catch (error: any) {
            logger.error('[NotificationController] Error getting notifications:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve notifications',
                error: error.message
            });
        }
    }

    /**
     * Mark a notification as read
     */
    async markAsRead(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            const { id } = req.params;

            const success = await notificationService.markAsRead(userId, id);

            if (!success) {
                return res.status(404).json({
                    success: false,
                    message: 'Notification not found'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Notification marked as read'
            });
        } catch (error: any) {
            logger.error('[NotificationController] Error marking as read:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to mark notification as read'
            });
        }
    }

    /**
     * Mark all as read
     */
    async markAllAsRead(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            const count = await notificationService.markAllAsRead(userId);

            return res.status(200).json({
                success: true,
                message: `${count} notifications marked as read`
            });
        } catch (error: any) {
            logger.error('[NotificationController] Error marking all as read:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to mark all notifications as read'
            });
        }
    }

    /**
     * Delete notification
     */
    async deleteNotification(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            const { id } = req.params;

            const success = await notificationService.deleteNotification(userId, id);

            if (!success) {
                return res.status(404).json({
                    success: false,
                    message: 'Notification not found'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Notification deleted'
            });
        } catch (error: any) {
            logger.error('[NotificationController] Error deleting notification:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete notification'
            });
        }
    }

    /**
     * Clear all notifications
     */
    async clearAll(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            const count = await notificationService.clearAll(userId);

            return res.status(200).json({
                success: true,
                message: 'All notifications cleared'
            });
        } catch (error: any) {
            logger.error('[NotificationController] Error clearing notifications:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to clear notifications'
            });
        }
    }

    /**
     * Get notification preferences
     */
    async getPreferences(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            const prefs = await notificationService.getPreferences(userId);

            return res.status(200).json({
                success: true,
                message: 'Preferences retrieved successfully',
                data: {
                    reminders: prefs.reminders,
                    events: prefs.events,
                    billing: prefs.billing
                }
            });
        } catch (error: any) {
            logger.error('[NotificationController] Error getting preferences:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve preferences'
            });
        }
    }

    /**
     * Update notification preferences
     */
    async updatePreferences(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            const result = await notificationService.updatePreferences(userId, req.body);

            return res.status(200).json({
                success: true,
                message: 'Preferences updated successfully',
                data: result
            });
        } catch (error: any) {
            logger.error('[NotificationController] Error updating preferences:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update preferences'
            });
        }
    }
}
