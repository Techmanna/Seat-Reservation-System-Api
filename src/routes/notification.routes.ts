import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { authenticateUser } from '../middleware/auth';

const router = Router();
const controller = new NotificationController();

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticateUser, controller.getNotifications);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 */
router.patch('/read-all', authenticateUser, controller.markAllAsRead);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 */
router.patch('/:id/read', authenticateUser, controller.markAsRead);

/**
 * @swagger
 * /notifications/clear-all:
 *   delete:
 *     summary: Clear all notifications
 *     tags: [Notifications]
 */
router.delete('/clear-all', authenticateUser, controller.clearAll);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 */
router.delete('/:id', authenticateUser, controller.deleteNotification);

/**
 * @swagger
 * /notifications/preferences:
 *   get:
 *     summary: Get notification preferences
 *     tags: [Notifications]
 */
router.get('/preferences', authenticateUser, controller.getPreferences);

/**
 * @swagger
 * /notifications/preferences:
 *   patch:
 *     summary: Update notification preferences
 *     tags: [Notifications]
 */
router.patch('/preferences', authenticateUser, controller.updatePreferences);

export default router;
