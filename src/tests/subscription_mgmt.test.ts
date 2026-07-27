import request from 'supertest';
import app from '../app';
import { SubscriptionModel } from '../models/Subscription';
import { UserModel } from '../models/User';
import { SubscriptionStatus, SubscriptionTier, PaymentProvider } from '../types/subscription.type';
import jwt from 'jsonwebtoken';
import { ZoomService } from '../services/ZoomService';

jest.mock('../services/ZoomService');
jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => {
        return {
            subscriptions: {
                cancel: jest.fn().mockResolvedValue({ id: 'sub_123', status: 'canceled' })
            }
        };
    });
});

describe('Subscription Management', () => {
    let testUser: any;
    let authToken: string;

    beforeAll(async () => {
        process.env.ZOOM_WEBINAR_ID = 'webinar_123';
        testUser = await UserModel.create({
            email: 'test-sub@example.com',
            password: 'password123',
            name: 'Test User',
            isVerified: true
        });

        authToken = jwt.sign(
            { id: testUser._id.toString() }, 
            process.env.JWT_SECRET || 'default_jwt_secret'
        );
    });

    afterAll(async () => {
        await UserModel.deleteMany({ email: 'test-sub@example.com' });
        await SubscriptionModel.deleteMany({ userId: testUser._id });
    });

    describe('POST /api/subscriptions/cancel', () => {
        it('should cancel an active Stripe subscription', async () => {
            const sub = await SubscriptionModel.create({
                userId: testUser._id,
                email: testUser.email,
                tier: SubscriptionTier.TIER_1_USD,
                status: SubscriptionStatus.ACTIVE,
                provider: PaymentProvider.STRIPE,
                providerSubscriptionId: 'sub_stripe_123',
                currentPeriodEnd: new Date(Date.now() + 86400000),
                zoomRegistrantId: 'zoom_123'
            });

            const res = await request(app)
                .post('/api/subscriptions/cancel')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const updatedSub = await SubscriptionModel.findById(sub._id);
            expect(updatedSub?.status).toBe(SubscriptionStatus.CANCELLED);
            expect(updatedSub?.zoomRegistrantId).toBeFalsy();
            
            expect(ZoomService.removeSubscriber).toHaveBeenCalled();
        });

        it('should return 404 if no active subscription found', async () => {
            await SubscriptionModel.deleteMany({ userId: testUser._id });

            const res = await request(app)
                .post('/api/subscriptions/cancel')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(404);
        });
    });
});
