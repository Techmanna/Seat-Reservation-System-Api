import { Schema, model, Document } from 'mongoose';

export interface ITransaction extends Document {
    userId: Schema.Types.ObjectId;
    email: string;
    amount: number;
    currency: string;
    provider: 'paystack' | 'stripe' | 'flutterwave';
    providerTransactionId: string;
    status: 'successful' | 'failed' | 'pending';
    tier: string;
    createdAt: Date;
    updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        required: true,
        default: 'NGN'
    },
    provider: {
        type: String,
        enum: ['paystack', 'stripe', 'flutterwave'],
        required: true
    },
    providerTransactionId: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['successful', 'failed', 'pending'],
        default: 'pending'
    },
    tier: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

export const TransactionModel = model<ITransaction>('Transaction', transactionSchema);
