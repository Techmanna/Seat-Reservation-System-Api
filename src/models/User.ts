import { Schema, model } from 'mongoose';
import { User } from '../types/index';

const userSchema = new Schema<User>({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: false,
        trim: true
    },
    country: {
        type: String,
        required: false,
        trim: true
    },
    gender: {
        type: String,
        required: false,
        enum: ['male', 'female', 'other']
    },
    ageRange: {
        type: String,
        required: false,
        enum: ['18-25', '26-35', '36-45', '46-55', '55+']
    },
    password: {
        type: String,
        required: false 
    },
    googleId: {
        type: String,
        required: false,
        unique: true,
        sparse: true 
    },
    authProvider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationOtp: {
        type: String,
        default: null
    },
    verificationOtpExpiry: {
        type: Date,
        default: null
    },
    resetPasswordToken: {
        type: String,
        default: null
    },
    resetPasswordExpiry: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual: fetch the subscription linked to this user
userSchema.virtual('subscription', {
    ref: 'Subscription',
    localField: '_id',
    foreignField: 'userId',
    justOne: true   // One active subscription per user
});

// Only keep index for non-unique field
userSchema.index({ phone: 1 });

export const UserModel = model<User>('User', userSchema);