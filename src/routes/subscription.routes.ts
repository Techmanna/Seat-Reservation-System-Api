import { Router } from 'express';
import { SubscriptionController } from '../controllers/SubscriptionController';
import { authenticateUser } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

router.get('/status', authenticateUser, SubscriptionController.getStatus);
router.get('/billing-history', authenticateUser, SubscriptionController.getBillingHistory);

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

router.post('/paystack/initialize', authenticateUser, SubscriptionController.initializePaystack);

router.post('/stripe/initialize', authenticateUser, SubscriptionController.initializeStripe);

// Webhooks
router.post('/paystack/webhook', SubscriptionController.handlePaystackWebhook);
router.post('/stripe/webhook', SubscriptionController.handleStripeWebhook);
router.post('/cancel', authenticateUser, SubscriptionController.cancel);
router.post('/upgrade', authenticateUser, SubscriptionController.upgrade);

export default router;
