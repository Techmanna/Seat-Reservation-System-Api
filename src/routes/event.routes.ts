import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { EventController } from '../controllers/EventController';

const router = Router();

router.get('/next-event', authenticateUser, EventController.getNextEvent);

export default router;
