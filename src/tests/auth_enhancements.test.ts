import request from 'supertest';
import app from '../app';
import { UserModel } from '../models/User';
import { LoginAuditModel } from '../models/LoginAudit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

describe('Auth Enhancements', () => {
    let testUser: any;
    let authToken: string;

    beforeAll(async () => {
        const password = await bcrypt.hash('password123', 10);
        testUser = await UserModel.create({
            name: 'Auth Test',
            email: 'auth-test@example.com',
            password,
            isVerified: true,
            authProvider: 'local'
        });

        authToken = jwt.sign(
            { id: testUser._id.toString(), email: testUser.email }, 
            process.env.JWT_SECRET || 'default_jwt_secret'
        );
    });

    afterAll(async () => {
        await UserModel.deleteMany({ email: 'auth-test@example.com' });
        await LoginAuditModel.deleteMany({ email: 'auth-test@example.com' });
    });

    describe('Login Audit', () => {
        it('should record a successful login audit', async () => {
            const res = await request(app)
                .post('/api/auth/user/login')
                .send({
                    email: 'auth-test@example.com',
                    password: 'password123'
                });

            expect(res.status).toBe(200);
            
            const audit = await LoginAuditModel.findOne({ email: 'auth-test@example.com', status: 'success' });
            expect(audit).toBeDefined();
            expect(audit?.authProvider).toBe('local');
        });
    });

    describe('Profile Management', () => {
        it('should fetch user profile', async () => {
            const res = await request(app)
                .get('/api/auth/user/profile')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.email).toBe('auth-test@example.com');
        });

        it('should update user profile including phone', async () => {
            const res = await request(app)
                .patch('/api/auth/user/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    phone: '+2348012345678',
                    gender: 'female'
                });

            expect(res.status).toBe(200);
            expect(res.body.data.phone).toBe('+2348012345678');
            expect(res.body.data.gender).toBe('female');
        });
    });

    describe('Password Management', () => {
        it('should change password', async () => {
            const res = await request(app)
                .post('/api/auth/user/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    currentPassword: 'password123',
                    newPassword: 'newpassword123'
                });

            expect(res.status).toBe(200);
            
            // Verify new password works
            const loginRes = await request(app)
                .post('/api/auth/user/login')
                .send({
                    email: 'auth-test@example.com',
                    password: 'newpassword123'
                });
            expect(loginRes.status).toBe(200);
        });
    });
});
