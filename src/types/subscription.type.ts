import mongoose from "mongoose";

export enum SubscriptionTier {
    TIER_1_NGN = '₦2,500',
    TIER_2_NGN = '₦6,500',
    TIER_3_NGN = '₦70,000',
    TIER_1_USD = '$2',
    TIER_2_USD = '$5',
    TIER_3_USD = '$50'
}

export enum SubscriptionStatus {
    ACTIVE = 'active',
    CANCELLED = 'cancelled',
    PAST_DUE = 'past_due',
    TRIALING = 'trialing',
    INACTIVE = 'inactive'
}

export enum PaymentProvider {
    PAYSTACK = 'paystack',
    STRIPE = 'stripe',
    FLUTTERWAVE = 'flutterwave'
}

export interface ISubscription {
    _id?: string;
    userId: mongoose.Schema.Types.ObjectId | string;
    email: string;
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    provider: PaymentProvider;
    providerSubscriptionId?: string;
    providerSubscriptionToken?: string;
    providerCustomerId?: string;
    currentPeriodEnd: Date;
    zoomJoinUrl?: string;
    zoomRegistrantId?: string;
    lastZoomMeetingId?: string;
    timezone?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IWebhookPayload {
    provider: PaymentProvider;
    event: string;
    data: any;
}
