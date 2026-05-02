import { Router } from 'express';
import { WebhookController } from '../controllers/WebhookController';

const router = Router();

/**
 * @swagger
 * /webhooks/paystack:
 *   post:
 *     summary: Intercept Paystack gateway transaction confirmations
 *     tags: [Webhooks]
 *     responses:
 *       200:
 *         description: Processed comfortably
 */
router.post('/paystack', WebhookController.handlePaystack);

/**
 * @swagger
 * /webhooks/stripe:
 *   post:
 *     summary: Capture Stripe lifecycle updates securely
 *     tags: [Webhooks]
 *     responses:
 *       200:
 *         description: Verified successfully
 */
router.post('/stripe', WebhookController.handleStripe);

/**
 * @swagger
 * /webhooks/flutterwave:
 *   post:
 *     summary: Receive Flutterwave payment notifications
 *     tags: [Webhooks]
 */
router.post('/flutterwave', WebhookController.handleFlutterwave);

export default router;
