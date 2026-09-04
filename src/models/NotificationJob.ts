import mongoose, { Document, Schema } from 'mongoose';

export interface INotificationJob extends Document {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  targetType: 'all' | 'specific_users' | 'booked_date_range' | 'booked_hall' | 'not_booked' | 'individual_email';
  subject: string;
  message: string;
  attachments?: { filename: string; path: string }[];
  pendingRecipients: { email: string; name: string }[];
  sentCount: number;
  failedCount: number;
  errorLogs: string[];
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

const notificationJobSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    targetType: {
      type: String,
      enum: [
        'all',
        'specific_users',
        'booked_date_range',
        'booked_hall',
        'not_booked',
        'individual_email',
      ],
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    attachments: [
      {
        filename: { type: String },
        path: { type: String },
      },
    ],
    pendingRecipients: [
      {
        email: { type: String },
        name: { type: String },
      },
    ],
    sentCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    errorLogs: [
      {
        type: String,
      },
    ],
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export const NotificationJobModel = mongoose.model<INotificationJob>('NotificationJob', notificationJobSchema);
