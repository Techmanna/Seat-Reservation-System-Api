import { Schema, model } from 'mongoose';
import { Event } from '../types/index';

const eventSchema = new Schema<Event>({
  date: {
    type: Date,
    required: true,
    unique: true
  },
  time: {
    type: String,
    required: true
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

// Only keep index for non-unique field
eventSchema.index({ isActive: 1 });

export const EventModel = model<Event>('Event', eventSchema);