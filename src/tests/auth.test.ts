import connectDB from '../config/database';
import { UserModel } from '../models/User';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

async function runAuthValidation() {
    console.log(">>> Initializing User Authentication Tests...");
    try {
        await connectDB();

        const mockEmail = `auth_test_${Date.now()}@gmail.com`;
        const mockPassword = "password123";

        // 1. Simulate Registration
        console.log(`>>> 1. Simulating Registration for ${mockEmail}`);
        const hashedPassword = await bcrypt.hash(mockPassword, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const user = await UserModel.create({
            name: 'Auth Test User',
            email: mockEmail,
            password: hashedPassword,
            isVerified: false,
            verificationToken,
            verificationExpiry
        });

        if (user && !user.isVerified) {
            console.log("✔ User Registered Successfully (Unverified).");
        } else {
            throw new Error("❌ Registration logic failed!");
        }

        // 2. Simulate Email Verification
        console.log(">>> 2. Simulating Email Verification...");
        const verifyAttempt = await UserModel.findOne({
            verificationToken,
            verificationExpiry: { $gt: new Date() }
        });

        if (!verifyAttempt) throw new Error("❌ Verification Token not found or expired!");

        verifyAttempt.isVerified = true;
        verifyAttempt.verificationToken = undefined;
        verifyAttempt.verificationExpiry = undefined;
        await verifyAttempt.save();

        const updatedUser = await UserModel.findOne({ email: mockEmail });
        if (updatedUser?.isVerified) {
            console.log("✔ Email Verified Successfully.");
        } else {
            throw new Error("❌ Verification save failed!");
        }

        // 3. Simulate Password Reset (Forgot Password)
        console.log(">>> 3. Simulating Forgot Password Flow...");
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000);

        updatedUser.resetPasswordToken = resetToken;
        updatedUser.resetPasswordExpiry = resetExpiry;
        await updatedUser.save();

        const resetAttempt = await UserModel.findOne({
            resetPasswordToken: resetToken,
            resetPasswordExpiry: { $gt: new Date() }
        });

        if (resetAttempt) {
            console.log("✔ Password Reset Token Generated.");
        } else {
            throw new Error("❌ Reset token validation failed!");
        }

        // 4. Simulate Reset Completion
        console.log(">>> 4. Simulating Password Reset Completion...");
        const newPassword = "newPassword123";
        const newHashed = await bcrypt.hash(newPassword, 10);

        resetAttempt.password = newHashed;
        resetAttempt.resetPasswordToken = undefined;
        resetAttempt.resetPasswordExpiry = undefined;
        await resetAttempt.save();

        const finalUser = await UserModel.findOne({ email: mockEmail });
        const passwordMatches = await bcrypt.compare(newPassword, finalUser!.password!);
        if (passwordMatches) {
            console.log("✔ Password Reset Completed Successfully.");
        } else {
            throw new Error("❌ New password verification failed!");
        }

        // Cleanup
        await UserModel.deleteOne({ email: mockEmail });
        console.log("✔ Mock Records Cleaned.");
        console.log(">>> Authentication Validation Completed Successfully.");
        process.exit(0);
    } catch (error: any) {
        console.error("❌ Auth Validation Script Failed:", error.message);
        process.exit(1);
    }
}

runAuthValidation();
