import { Schema, model, Document } from 'mongoose';

export interface IEventRegistration extends Document {
    userId: Schema.Types.ObjectId;
    email: string;
    eventId: Schema.Types.ObjectId;
    zoomMeetingId: string;
    zoomRegistrantId: string;
    zoomJoinUrl: string;
    registrationType: 'daily_meeting' | 'webinar';
    createdAt: Date;
    updatedAt: Date;
}

const eventRegistrationSchema = new Schema<IEventRegistration>({
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
    eventId: {
        type: Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    zoomMeetingId: {
        type: String,
        required: true
    },
    zoomRegistrantId: {
        type: String,
        required: true
    },
    zoomJoinUrl: {
        type: String,
        required: true
    },
    registrationType: {
        type: String,
        enum: ['daily_meeting', 'webinar'],
        default: 'daily_meeting'
    }
}, {
    timestamps: true
});

// Index for quick lookup of user registrations for a specific event
eventRegistrationSchema.index({ userId: 1, eventId: 1 }, { unique: true });

export const EventRegistrationModel = model<IEventRegistration>('EventRegistration', eventRegistrationSchema);
