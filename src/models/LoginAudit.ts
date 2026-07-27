import { Schema, model, Document } from 'mongoose';

export interface ILoginAudit extends Document {
    userId?: Schema.Types.ObjectId;
    email: string;
    status: 'success' | 'failed';
    ipAddress?: string;
    userAgent?: string;
    failureReason?: string;
    authProvider: 'local' | 'google';
    createdAt: Date;
}

const loginAuditSchema = new Schema<ILoginAudit>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    email: {
        type: String,
        required: true,
        lowercase: true
    },
    status: {
        type: String,
        enum: ['success', 'failed'],
        required: true
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },
    failureReason: {
        type: String
    },
    authProvider: {
        type: String,
        enum: ['local', 'google'],
        required: true
    }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

loginAuditSchema.index({ email: 1 });
loginAuditSchema.index({ userId: 1 });
loginAuditSchema.index({ createdAt: -1 });

export const LoginAuditModel = model<ILoginAudit>('LoginAudit', loginAuditSchema);
