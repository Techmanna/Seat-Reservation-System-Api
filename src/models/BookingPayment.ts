import mongoose, { Schema, model } from 'mongoose';
import { BookingPayment } from '../types/index';

const bookingPaymentSchema = new Schema<BookingPayment>({
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
  bookings: [{
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Booking'
  }],
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    default: 'NGN'
  },
  status: {
    type: String,
    enum: ['pending', 'successful', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentReference: {
    type: String,
    required: false
  },
  paymentLink: {
    type: String,
    required: false
  },
  provider: {
    type: String,
    enum: ['paystack', 'flutterwave'],
    required: true
  }
}, {
  timestamps: true
});

// Indexes for fast lookups
bookingPaymentSchema.index({ user: 1 });
bookingPaymentSchema.index({ hall: 1 });
bookingPaymentSchema.index({ status: 1 });
bookingPaymentSchema.index({ paymentReference: 1 }, { unique: true, partialFilterExpression: { paymentReference: { $exists: true, $type: 'string' } } });

export const BookingPaymentModel = model<BookingPayment>('BookingPayment', bookingPaymentSchema);
