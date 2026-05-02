import { Router } from 'express';
import { SubscriptionController } from '../controllers/SubscriptionController';
import { authenticateUser } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

/**
 * @swagger
 * /subscriptions/status:
 *   get:
 *     summary: Retrieve subscriber access parameters
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Validated subscription contexts
 *       404:
 *         description: User data unmatched
 */
router.get('/status', authenticateUser, SubscriptionController.getStatus);

/**
 * @swagger
 * /subscriptions/zoom-signature:
 *   post:
 *     summary: Generate Zoom Meeting SDK signature
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               meetingNumber:
 *                 type: integer
 *               role:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Signature generated successfully
 */
router.post('/zoom-signature', authenticateUser, async (req: AuthRequest, res) => {
    try {
        const { meetingId, role } = req.body;
        console.log(req.body);

        const signature = await SubscriptionController.getZoomSignature(meetingId, role, req.user!.email);
        res.json({ success: true, signature });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});


// New route to get Video SDK signature
router.post('/zoom-video-signature', authenticateUser, async (req: AuthRequest, res) => {
    try {
        const { sessionName, role } = req.body;
        const signature = await SubscriptionController.getVideoSDKSignature(sessionName, role, req.user!.email);
        res.json({ success: true, signature });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// New route to get join token for meeting
router.post('/zoom-join-token', authenticateUser, async (req: AuthRequest, res) => {
    try {
        const { meetingId } = req.body;
        const email = req.user!.email;
        console.log(req.user);

        const token = await SubscriptionController.getJoinToken(email, meetingId);
        res.json({ success: true, token });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * @swagger
 * /subscriptions/paystack/initialize:
 *   post:
 *     summary: Initialize a Paystack subscription payment
 *     tags: [Subscriptions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               userId:
 *                 type: string
 *               plan:
 *                 type: string
 *     responses:
 *       200:
 *         description: Paystack initialized
 */
router.post('/paystack/initialize', authenticateUser, SubscriptionController.initializePaystack);

/**
 * @swagger
 * /subscriptions/stripe/initialize:
 *   post:
 *     summary: Initialize a Stripe subscription payment
 *     tags: [Subscriptions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               userId:
 *                 type: string
 *               plan:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stripe initialized
 */
router.post('/stripe/initialize', authenticateUser, SubscriptionController.initializeStripe);

// Webhooks
router.post('/paystack/webhook', SubscriptionController.handlePaystackWebhook);
router.post('/stripe/webhook', SubscriptionController.handleStripeWebhook);

export default router;
