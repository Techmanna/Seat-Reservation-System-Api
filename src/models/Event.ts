import mongoose, { Schema, model } from 'mongoose';
import { Event } from '../types/index';

const eventSchema = new Schema<Event>({
  hall: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Hall'
  },
  date: {
    type: Date,
    required: true,
    unique: false
  },
  time: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    default: null
  },
  totalSeats: {
    type: Number,
    required: true,
    min: 1
  },
  availableSeats: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  zoomMeetingId: {
    type: String,
    default: null
  },
  zoomMeetingUrl: {
    type: String,
    default: null
  },
  zoomPassword: {
    type: String,
    default: null
  },
  title: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Keep index for non-unique field
eventSchema.index({ isActive: 1 });
eventSchema.index({ hall: 1, date: 1 }, { unique: true });

export const EventModel = model<Event>('Event', eventSchema);