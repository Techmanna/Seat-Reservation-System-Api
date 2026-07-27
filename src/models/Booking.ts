import mongoose, { Schema, model } from 'mongoose';
import { Booking, BookingStatus } from '../types/index';

const bookingSchema = new Schema<Booking>({
  ticketId: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  hall: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Hall'
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Event'
  },
  eventDate: {
    type: Date,
    required: true
  },
  seatNumbers: [{
    type: Number,
    required: true
  }],
  seatLabels: [{
    type: String,
    required: true
  }],
  calendarLink: {
    type: String,
    required: false
  },
  status: {
    type: String,
    enum: BookingStatus,
    default: BookingStatus.Attending
  },
  qrCode: {
    type: String,
    required: true
  },
  reservationToken: {
    type: String,
    required: true
  },
  attendedAt: {
    type: Date,
    required: false
  },
  category: {
    type: String,
    enum: ['priority', 'general'],
    required: false
  },
  priorityScore: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Fix incorrect field names and add compound indexes for performance
bookingSchema.index({ user: 1 });
bookingSchema.index({ event: 1 });
bookingSchema.index({ hall: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ hall: 1, status: 1 });
bookingSchema.index({ hall: 1, eventDate: -1 }); // often sorted descending per hall
bookingSchema.index({ eventDate: -1 }); // often sorted descending
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ event: 1, status: 1 });
bookingSchema.index({ user: 1, eventDate: -1 }); // heavily used in priority calculation

export const BookingModel = model<Booking>('Booking', bookingSchema);