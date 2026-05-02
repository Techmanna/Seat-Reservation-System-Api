import { Schema, model } from 'mongoose';
import { ISubscription, SubscriptionStatus, SubscriptionTier, PaymentProvider } from '../types/subscription.type';

const subscriptionSchema = new Schema<ISubscription>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    tier: {
        type: String,
        enum: Object.values(SubscriptionTier),
        required: true
    },
    status: {
        type: String,
        enum: Object.values(SubscriptionStatus),
        default: SubscriptionStatus.INACTIVE,
        required: true
    },
    provider: {
        type: String,
        enum: Object.values(PaymentProvider),
        required: true
    },
    providerSubscriptionId: {
        type: String,
        default: null
    },
    providerSubscriptionToken: {
        type: String,
        default: null
    },
    providerCustomerId: {
        type: String,
        default: null
    },
    currentPeriodEnd: {
        type: Date,
        required: true
    },
    zoomJoinUrl: {
        type: String,
        default: null
    },
    zoomRegistrantId: {
        type: String,
        default: null
    },
    lastZoomMeetingId: {
        type: String,
        default: null
    },
    timezone: {
        type: String,
        default: 'Africa/Lagos' // Default to WAT if not captured
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual: populate the full user document from userId
subscriptionSchema.virtual('user', {
    ref: 'User',
    localField: 'userId',
    foreignField: '_id',
    justOne: true
});

subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ email: 1 }, { unique: true });
subscriptionSchema.index({ providerSubscriptionId: 1 });

export const SubscriptionModel = model<ISubscription>('Subscription', subscriptionSchema);
