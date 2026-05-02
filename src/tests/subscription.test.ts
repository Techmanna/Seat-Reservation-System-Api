import connectDB from '../config/database';
import { SubscriptionService } from '../services/SubscriptionService';
import { SubscriptionModel } from '../models/Subscription';
import { UserModel } from '../models/User';
import { SubscriptionTier, PaymentProvider } from '../types/subscription.type';
import mongoose from 'mongoose';

async function runValidation() {
    console.log(">>> Initializing E2E Subscription Tests...");
    try {
        await connectDB();

        // 1. Create Mock User
        const mockEmail = `test_subscriber_${Date.now()}@gmail.com`;
        const mockUser = new UserModel({
            name: 'Test User',
            email: mockEmail,
            phone: '08012345678',
            gender: 'female',
            ageRange: '26-35'
        });
        await mockUser.save();
        console.log(`✔ Created Mock User: ${mockEmail}`);

        // 2. Test Activation Flow
        console.log(">>> Simulating Paystack Webhook Activation...");
        const sub = await SubscriptionService.activateSubscription(
            mockUser._id!.toString(),
            mockEmail,
            SubscriptionTier.TIER_1_NGN,
            PaymentProvider.PAYSTACK,
            'sub_paystack_mock_123',
            'cust_paystack_mock_123'
        );

        console.log(`✔ Subscription Activated. Zoom Join URL: ${sub.zoomJoinUrl}`);

        // 3. Test Access Verification
        console.log(">>> Verifying Access Gateway...");
        const hasAccess = await SubscriptionService.checkAccess(mockEmail);
        if (hasAccess) {
            console.log("✔ Access Granted Successfully.");
        } else {
            throw new Error("❌ Access should be granted but was denied!");
        }

        // 4. Test Cancellation Flow
        console.log(">>> Simulating Subscription Cancellation...");
        await SubscriptionService.cancelSubscription('sub_paystack_mock_123');
        const stillHasAccess = await SubscriptionService.checkAccess(mockEmail);
        const updatedSub = await SubscriptionModel.findOne({ email: mockEmail });

        if (updatedSub?.status === 'cancelled') {
            console.log("✔ Subscription state changed to 'cancelled'.");
        } else {
            throw new Error(`❌ Unexpected subscription state: ${updatedSub?.status}`);
        }

        // Clean up mock entries
        await SubscriptionModel.deleteOne({ email: mockEmail });
        await UserModel.deleteOne({ email: mockEmail });
        console.log("✔ Mock Records Cleaned.");
        console.log(">>> End-to-End Validation Completed Safely.");
        process.exit(0);

    } catch (error: any) {
        console.error("❌ Verification Script Failed:", error.message);
        process.exit(1);
    }
}

runValidation();
