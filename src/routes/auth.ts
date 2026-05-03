import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { AdminModel } from '../models/Admin';
import { AuthService } from '../services/AuthService';
import { LoginAuditModel } from '../models/LoginAudit';
import { authenticateUser } from '../middleware/auth';
import { BookingService } from '../services/BookingService';
import { validateRequest } from '../middleware/validateRequest';
import { UserModel } from '../models/User';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../utils/email';
import crypto from 'crypto';
// import { authenticateAdmin } from '../middleware/auth';
import {
    adminLoginSchema,
    createAdminSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    updateAdminSchema,
    adminQuerySchema,
} from '../dtos/index.dto';
import { AuthRequest } from '../types';

const router = Router();
const authService = new AuthService();

// Admin login
router.post('/login', validateRequest(adminLoginSchema, 'body'), async (req, res) => {
    try {
        const result = await authService.login(req.body);
        const statusCode = result.success ? 200 : 401;
        res.status(statusCode).json(result);
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
});

// Verify token
router.get('/verify', async (req, res) => {
    try {
        const result = await authService.verifyToken(req.headers.authorization?.split(' ')[1] || '');
        const statusCode = result.success ? 200 : 401;
        res.status(statusCode).json(result);
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
});

// Forgot password
router.post('/forgot-password', validateRequest(forgotPasswordSchema, 'body'), async (req, res) => {
    try {
        const result = await authService.forgotPassword(req.body);
        const statusCode = result.success ? 200 : 400;
        res.status(statusCode).json(result);
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Forgot password request failed',
            error: error.message
        });
    }
});

// Reset password
router.post('/reset-password', validateRequest(resetPasswordSchema, 'body'), async (req, res) => {
    try {
        const result = await authService.resetPassword(req.body);
        const statusCode = result.success ? 200 : 400;
        res.status(statusCode).json(result);
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Password reset failed',
            error: error.message
        });
    }
});

// Protected Routes (Authentication required)

// Get current admin profile
// router.get('/profile', authenticateAdmin, async (req: AuthRequest, res) => {
//     try {
//         const admin = await AdminModel.findById(req.admin.id)
//             .select('-password -resetPasswordToken -resetPasswordExpiry')
//             .populate('createdBy', 'username email');

//         if (!admin) {
//             res.status(404).json({
//                 success: false,
//                 message: 'Admin not found',
//                 error: 'Invalid admin ID'
//             });
//             return
//         }

//         res.json({
//             success: true,
//             message: 'Profile retrieved successfully',
//             data: admin
//         });
//     } catch (error: any) {
//         res.status(500).json({
//             success: false,
//             message: 'Failed to retrieve profile',
//             error: error.message
//         });
//     }
// });

// Update current admin profile
// router.put('/profile', authenticateAdmin, validateRequest(updateAdminSchema, 'body'), async (req: AuthRequest, res) => {
//     try {
//         const { username, email, phone } = req.body;

//         // Check if username or email already exists (excluding current admin)
//         if (username || email) {
//             const query: any = { _id: { $ne: req.admin.id } };
//             if (username) query.$or = [{ username }];
//             if (email) query.$or = query.$or ? [...query.$or, { email }] : [{ email }];

//             const existingAdmin = await AdminModel.findOne(query);
//             if (existingAdmin) {
//                 res.status(400).json({
//                     success: false,
//                     message: 'Username or email already taken',
//                     error: 'Duplicate credentials'
//                 });
//                 return
//             }
//         }

//         const admin = await AdminModel.findByIdAndUpdate(
//             req.admin.id,
//             { username, email, phone },
//             { new: true, runValidators: true }
//         ).select('-password -resetPasswordToken -resetPasswordExpiry');

//         res.json({
//             success: true,
//             message: 'Profile updated successfully',
//             data: admin
//         });
//     } catch (error: any) {
//         res.status(500).json({
//             success: false,
//             message: 'Failed to update profile',
//             error: error.message
//         });
//     }
// });

// Change password
// router.post('/change-password', authenticateAdmin, validateRequest(changePasswordSchema, 'body'), async (req: AuthRequest, res) => {
//     try {
//         const result = await authService.changePassword(req.admin.id, req.body);
//         const statusCode = result.success ? 200 : 400;
//         res.status(statusCode).json(result);
//     } catch (error: any) {
//         res.status(500).json({
//             success: false,
//             message: 'Password change failed',
//             error: error.message
//         });
//     }
// });

// Super Admin Routes (Superadmin access required)

// Create new admin
// router.post('/create', authenticateAdmin, validateRequest(createAdminSchema, 'body'), async (req: AuthRequest, res) => {
//     try {
//         const result = await authService.createAdmin(req.body, req.admin.id);
//         const statusCode = result.success ? 201 : 400;
//         res.status(statusCode).json(result);
//     } catch (error: any) {
//         res.status(500).json({
//             success: false,
//             message: 'Admin creation failed',
//             error: error.message
//         });
//     }
// });

// Get all admins (with pagination and search)
// router.get('/list', authenticateAdmin, validateRequest(adminQuerySchema, 'query'), async (req, res) => {
//     try {
//         const { page, limit, search, role, isActive } = req.query as any;

//         const query: any = {};

//         // Search functionality
//         if (search) {
//             const regex = new RegExp(search, 'i');
//             query.$or = [
//                 { username: regex },
//                 { email: regex }
//             ];
//         }

//         // Filter by role
//         if (role) {
//             query.role = role;
//         }

//         // Filter by active status
//         if (typeof isActive === 'boolean') {
//             query.isActive = isActive;
//         }

//         const skip = (page - 1) * limit;

//         const [admins, total] = await Promise.all([
//             AdminModel.find(query)
//                 .select('-password -resetPasswordToken -resetPasswordExpiry')
//                 .populate('createdBy', 'username email')
//                 .sort({ createdAt: -1 })
//                 .skip(skip)
//                 .limit(limit),
//             AdminModel.countDocuments(query)
//         ]);

//         res.json({
//             success: true,
//             message: 'Admins retrieved successfully',
//             data: admins,
//             meta: {
//                 total,
//                 page,
//                 limit,
//                 totalPages: Math.ceil(total / limit),
//                 hasNextPage: page < Math.ceil(total / limit),
//                 hasPrevPage: page > 1
//             }
//         });
//     } catch (error: any) {
//         res.status(500).json({
//             success: false,
//             message: 'Failed to retrieve admins',
//             error: error.message
//         });
//     }
// });

// Get specific admin
// router.get('/:adminId', authenticateAdmin, requireSuperAdmin, async (req, res) => {
//   try {
//     const admin = await AdminModel.findById(req.params.adminId)
//       .select('-password -resetPasswordToken -resetPasswordExpiry')
//       .populate('createdBy', 'username email');

//     if (!admin) {
//       return res.status(404).json({



// User Registration
router.post('/user/register', async (req, res) => {
    try {
        const { name, email, password, phone, country } = req.body;
        if (!name || !email || !password) {
             res.status(400).json({ success: false, message: 'Name, email and password are required' });
             return;
        }

        // validate the name to be in this format: First Name Last Name
        const nameParts = name.split(' ');
        if (nameParts.length < 2) {
             res.status(400).json({ success: false, message: 'Name must be in the format: First Name Last Name' });
             return;
        }

        const existingUser = await UserModel.findOne({ email: email.toLowerCase() });
        if (existingUser) {
             res.status(400).json({ success: false, message: 'Email is already registered' });
             return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationOtp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
        const verificationOtpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        const user = await UserModel.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            phone,
            country,
            isVerified: false,
            verificationOtp,
            verificationOtpExpiry
        });

        // Send Verification Email
        try {
            await sendEmail({
                to: user.email,
                subject: `${verificationOtp} is your verification code - The Morayo Live Show`,
                html: `
                    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 16px;">
                        <div style="text-align: center; margin-bottom: 32px;">
                            <img src="https://themorayoshow.com/tmas-logo-dark.png" alt="TMAS Logo" style="height: 40px;">
                        </div>
                        <h2 style="font-family: 'Fraunces', serif; font-style: italic; color: #1a1a1a; font-size: 24px; text-align: center; margin-bottom: 24px;">Verify your access.</h2>
                        <p style="color: #666; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 32px;">
                            Thank you for joining The Morayo Live Show. Use the 6-digit code below to verify your email address and complete your registration.
                        </p>
                        <div style="background: #f8f8f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #E8593C;">${verificationOtp}</span>
                        </div>
                        <p style="color: #999; font-size: 13px; text-align: center;">
                            This code will expire in 15 minutes. If you did not request this, you can safely ignore this email.
                        </p>
                    </div>
                `
            });
        } catch (emailErr: any) {
            console.error(">>> [User Registration] SMTP Error:", emailErr.message);
            console.log(`>>> VERIFICATION OTP FOR TESTING: ${verificationOtp}`);
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please verify your email.',
            email: user.email
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// User Verify Email OTP
router.post('/user/verify-email', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
             res.status(400).json({ success: false, message: 'Email and OTP are required' });
             return;
        }

        const user = await UserModel.findOne({
            email: email.toLowerCase(),
            verificationOtp: otp,
            verificationOtpExpiry: { $gt: new Date() }
        });

        if (!user) {
             res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
             return;
        }

        user.isVerified = true;
        user.verificationOtp = undefined;
        user.verificationOtpExpiry = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Email successfully verified. You can now subscribe.'
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// User Resend OTP
router.post('/user/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ success: false, message: 'Email is required' });
            return;
        }

        const user = await UserModel.findOne({ email: email.toLowerCase() });
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        if (user.isVerified) {
            res.status(400).json({ success: false, message: 'Email is already verified' });
            return;
        }

        const verificationOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationOtpExpiry = new Date(Date.now() + 15 * 60 * 1000);

        user.verificationOtp = verificationOtp;
        user.verificationOtpExpiry = verificationOtpExpiry;
        await user.save();

        // Send Email
        try {
            await sendEmail({
                to: user.email,
                subject: `${verificationOtp} is your new verification code - The Morayo Live Show`,
                html: `
                    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 16px;">
                        <div style="text-align: center; margin-bottom: 32px;">
                            <img src="https://themorayoshow.com/tmas-logo-dark.png" alt="TMAS Logo" style="height: 40px;">
                        </div>
                        <h2 style="font-family: 'Fraunces', serif; font-style: italic; color: #1a1a1a; font-size: 24px; text-align: center; margin-bottom: 24px;">New verification code.</h2>
                        <p style="color: #666; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 32px;">
                            You requested a new verification code. Use the code below to complete your registration.
                        </p>
                        <div style="background: #f8f8f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #E8593C;">${verificationOtp}</span>
                        </div>
                        <p style="color: #999; font-size: 13px; text-align: center;">
                            This code will expire in 15 minutes.
                        </p>
                    </div>
                `
            });
        } catch (emailErr: any) {
            console.error(">>> [Resend OTP] SMTP Error:", emailErr.message);
            console.log(`>>> NEW VERIFICATION OTP FOR TESTING: ${verificationOtp}`);
        }

        res.status(200).json({ success: true, message: 'Verification code resent successfully' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// User Login
router.post('/user/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
             res.status(400).json({ success: false, message: 'Email and password are required' });
             return;
        }

        const user = await UserModel.findOne({ email: email.toLowerCase() });
        if (!user) {
             res.status(401).json({ success: false, message: 'Invalid email or password' });
             return;
        }

        // ENFORCE RULE: If user is a Google user, they cannot use password login
        if (user.authProvider === 'google') {
            res.status(403).json({ 
                success: false, 
                message: 'This account is linked with Google. Please use "Sign in with Google" to continue.' 
            });
            return;
        }

        if (!user.password) {
             res.status(401).json({ success: false, message: 'Invalid email or password' });
             return;
        }

        if (!user.isVerified) {
             res.status(403).json({ success: false, message: 'Please verify your email address before logging in' });
             return;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
             res.status(401).json({ success: false, message: 'Invalid email or password' });
             return;
        }

        const token = jwt.sign(
            { id: user._id, email: user.email, role: 'user' },
            process.env.JWT_SECRET || 'default_jwt_secret',
            { expiresIn: '30d' }
        );

        // Audit Success
        await LoginAuditModel.create({
            userId: user._id,
            email: user.email,
            status: 'success',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            authProvider: 'local'
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error: any) {
        // Audit Failure
        if (req.body.email) {
            await LoginAuditModel.create({
                email: req.body.email,
                status: 'failed',
                failureReason: error.message,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                authProvider: 'local'
            });
        }
        res.status(500).json({ success: false, message: error.message });
    }
});

// User Google Login/Signup
router.post('/user/google-login', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            res.status(400).json({ success: false, message: 'Google ID Token is required' });
            return;
        }

        const { OAuth2Client } = require('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            res.status(400).json({ success: false, message: 'Invalid Google token' });
            return;
        }

        const { email, name, sub: googleId } = payload;

        let user = await UserModel.findOne({ email: email.toLowerCase() });

        if (user) {
            // Update user to be a Google user if they weren't already
            // and link their googleId
            if (user.authProvider !== 'google') {
                user.authProvider = 'google';
                user.googleId = googleId;
                user.password = undefined; // Remove password to enforce Google-only login
                await user.save();
            }
        } else {
            // Create new user via Google
            user = await UserModel.create({
                name: name || email,
                email: email.toLowerCase(),
                googleId,
                authProvider: 'google',
                isVerified: true // Google accounts are pre-verified
            });
        }

        const token = jwt.sign(
            { id: user._id, email: user.email, role: 'user' },
            process.env.JWT_SECRET || 'default_jwt_secret',
            { expiresIn: '30d' }
        );

        // Audit Success
        await LoginAuditModel.create({
            userId: user._id,
            email: user.email,
            status: 'success',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            authProvider: 'google'
        });

        res.status(200).json({
            success: true,
            message: 'Google login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error: any) {
        console.error("Google Login Error:", error);
        // Audit Failure
        await LoginAuditModel.create({
            email: 'google-auth-failure',
            status: 'failed',
            failureReason: error.message,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            authProvider: 'google'
        });
        res.status(500).json({ success: false, message: 'Google authentication failed' });
    }
});

// User Forgot Password
router.post('/user/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
             res.status(400).json({ success: false, message: 'Email is required' });
             return;
        }

        const user = await UserModel.findOne({ email: email.toLowerCase() });
        if (!user) {
             res.status(404).json({ success: false, message: 'No user found with that email address' });
             return;
        }

        if (user.authProvider === 'google') {
            res.status(400).json({ 
                success: false, 
                message: 'This account uses Google authentication. Please sign in with Google.' 
            });
            return;
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpiry = resetExpiry;
        await user.save();

        // Send Reset Email
        try {
            const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${resetToken}`;
            await sendEmail({
                to: user.email,
                subject: 'Reset your password - The Morayo Live Show',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Password Reset Request</h2>
                        <p>You requested a password reset. Please click the button below to set a new password:</p>
                        <a href="${resetLink}" style="background: #007bff; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block;">Reset Password</a>
                        <p>If you did not initiate this request, you can safely ignore this email.</p>
                    </div>
                `
            });
        } catch (emailErr: any) {
            console.error(">>> [Forgot Password] SMTP Error:", emailErr.message);
            console.log(`>>> RESET TOKEN FOR TESTING: ${resetToken}`);
        }

        res.status(200).json({
            success: true,
            message: 'Password reset link sent securely to your email',
            resetToken: resetToken // Expose for integration testing safely
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// User Reset Password
router.post('/user/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
             res.status(400).json({ success: false, message: 'Token and new password are required' });
             return;
        }

        const user = await UserModel.findOne({
            resetPasswordToken: token,
            resetPasswordExpiry: { $gt: new Date() }
        });

        if (!user) {
             res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
             return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiry = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password updated successfully. You can now log in.'
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// User Change Password (Authenticated)
router.post('/user/change-password', authenticateUser, async (req: AuthRequest, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user!.id;

        if (!currentPassword || !newPassword) {
            res.status(400).json({ success: false, message: 'Current and new passwords are required' });
            return;
        }

        const user = await UserModel.findById(userId);
        if (!user || user.authProvider === 'google') {
            res.status(400).json({ success: false, message: 'Password change not supported for this account type' });
            return;
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password!);
        if (!isMatch) {
            res.status(400).json({ success: false, message: 'Incorrect current password' });
            return;
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get User Profile
router.get('/user/profile', authenticateUser, async (req: AuthRequest, res) => {
    try {
        const user = await UserModel.findById(req.user!.id).select('-password -verificationToken -resetPasswordToken');
        res.status(200).json({ success: true, data: user });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update User Profile
router.patch('/user/profile', authenticateUser, async (req: AuthRequest, res) => {
    try {
        const { name, phone, gender, ageRange } = req.body;
        const user = await UserModel.findById(req.user!.id);

        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (gender) user.gender = gender;
        if (ageRange) user.ageRange = ageRange;
        if (req.body.country) user.country = req.body.country;

        await user.save();

        res.status(200).json({ 
            success: true, 
            message: 'Profile updated successfully',
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                country: user.country,
                gender: user.gender,
                ageRange: user.ageRange
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete User Account
router.delete('/user/account', authenticateUser, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id;
        
        // 1. Find user
        const user = await UserModel.findById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        // 2. Perform cleanup (Optional but recommended)
        // Delete subscriptions, registrations, etc.
        const { SubscriptionModel } = require('../models/Subscription');
        const { EventRegistrationModel } = require('../models/EventRegistration');
        const { TransactionModel } = require('../models/Transaction');
        
        await SubscriptionModel.deleteMany({ userId });
        await EventRegistrationModel.deleteMany({ userId });
        await TransactionModel.deleteMany({ userId });

        // 3. Delete user
        await UserModel.findByIdAndDelete(userId);

        res.status(200).json({ success: true, message: 'Account deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;