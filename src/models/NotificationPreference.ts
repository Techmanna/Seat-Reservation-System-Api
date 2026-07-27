import { Schema, model, Document, Types } from 'mongoose';

export interface INotificationChannelPreference {
    inApp: boolean;
    email: boolean;
    sms: boolean;
}

export interface INotificationPreference extends Document {
    userId: Types.ObjectId;
    reminders: INotificationChannelPreference;
    events: INotificationChannelPreference;
    billing: INotificationChannelPreference;
    createdAt: Date;
    updatedAt: Date;
}

const channelPreferenceSchema = new Schema({
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false }
}, { _id: false });

const notificationPreferenceSchema = new Schema<INotificationPreference>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    reminders: {
        type: channelPreferenceSchema,
        default: () => ({ inApp: true, email: true, sms: false })
    },
    events: {
        type: channelPreferenceSchema,
        default: () => ({ inApp: true, email: true, sms: false })
    },
    billing: {
        type: channelPreferenceSchema,
        default: () => ({ inApp: true, email: true, sms: false })
    }
}, {
    timestamps: true
});

export const NotificationPreferenceModel = model<INotificationPreference>('NotificationPreference', notificationPreferenceSchema);
