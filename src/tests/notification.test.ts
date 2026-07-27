import request from 'supertest';
import app from '../app';
import { NotificationModel, NotificationType } from '../models/Notification';
import { NotificationPreferenceModel } from '../models/NotificationPreference';
import { UserModel } from '../models/User';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

describe('Notification System', () => {
    let testUser: any;
    let authToken: string;

    beforeAll(async () => {
        // Create a test user
        testUser = await UserModel.create({
            name: 'Notification Test User',
            email: `test-notify-${Date.now()}@example.com`,
            authProvider: 'local',
            isVerified: true
        });

        authToken = jwt.sign(
            { id: testUser._id.toString() }, 
            process.env.JWT_SECRET || 'default_jwt_secret'
        );
    });

    afterAll(async () => {
        await UserModel.deleteMany({ email: /test-notify/ });
        await NotificationModel.deleteMany({ userId: testUser._id });
        await NotificationPreferenceModel.deleteMany({ userId: testUser._id });
    });

    describe('GET /api/notifications', () => {
        it('should return empty notifications list for new user', async () => {
            const res = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.notifications).toHaveLength(0);
        });

        it('should return created notifications', async () => {
            // Manually create a notification
            await NotificationModel.create({
                userId: testUser._id,
                type: NotificationType.BILLING,
                title: 'Test Billing',
                message: 'Your payment was successful'
            });

            const res = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.notifications).toHaveLength(1);
            expect(res.body.data.notifications[0].title).toBe('Test Billing');
        });
    });

    describe('PATCH /api/notifications/preferences', () => {
        it('should update user preferences', async () => {
            const updateData = {
                reminders: { email: false, inApp: true },
                billing: { sms: true }
            };

            const res = await request(app)
                .patch('/api/notifications/preferences')
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData);

            expect(res.status).toBe(200);
            expect(res.body.data.reminders.email).toBe(false);
            expect(res.body.data.billing.sms).toBe(true);
        });
    });

    describe('PATCH /api/notifications/:id/read', () => {
        it('should mark a notification as read', async () => {
            const notification = await NotificationModel.create({
                userId: testUser._id,
                type: NotificationType.EVENT,
                title: 'Unread Event',
                message: 'Check this out'
            });

            const res = await request(app)
                .patch(`/api/notifications/${notification._id}/read`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            
            const updated = await NotificationModel.findById(notification._id);
            expect(updated?.isRead).toBe(true);
        });
    });

    describe('DELETE /api/notifications/clear-all', () => {
        it('should clear all notifications', async () => {
            await NotificationModel.create([
                { userId: testUser._id, type: NotificationType.SYSTEM, title: 'N1', message: 'M1' },
                { userId: testUser._id, type: NotificationType.SYSTEM, title: 'N2', message: 'M2' }
            ]);

            const res = await request(app)
                .delete('/api/notifications/clear-all')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            
            const count = await NotificationModel.countDocuments({ userId: testUser._id });
            expect(count).toBe(0);
        });
    });
});
