import { Schema, model } from "mongoose";
import { Hall } from "../types/index";

const hallSchema = new Schema<Hall>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    state: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    featureImage: {
      type: String,
      required: false,
    },
    reservationOpenDate: {
      type: Date,
      required: true,
    },
    reservationCloseDate: {
      type: Date,
      required: true,
    },
    defaultTotalSeats: {
      type: Number,
      required: true,
      min: 1,
      default: 100,
    },
    seatCapacityOverrides: [
      {
        date: {
          type: Date,
          required: true,
        },
        totalSeats: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],
    eventTimes: [
      {
        type: String,
        required: true,
      },
    ],
    workingDays: [
      {
        type: Number,
        min: 1,
        max: 7,
      },
    ],
    maxSeatsPerUser: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      default: 2,
    },
    blockedDates: [
      {
        type: Date,
      },
    ],
    minCancellationHours: {
      type: Number,
      required: true,
      min: 0,
      default: 2,
    },
    prioritySystemEnabled: {
      type: Boolean,
      default: false,
    },
    prioritySeatAllocation: {
      type: Number,
      min: 0,
      default: 50,
    },
    waitingListCapacity: {
      type: Number,
      min: 0,
      default: 50,
    },
    autoAllocationHoursBeforeEvent: {
      type: Number,
      min: 1,
      default: 12,
    },
    priorityRules: {
      newUser: { type: Boolean, default: true },
      lowFrequency: { type: Boolean, default: true },
      inactivity: { type: Boolean, default: true },
      neverBooked: { type: Boolean, default: true },
    },
    lowFrequencyThreshold: {
      type: Number,
      default: 2,
    },
    lowFrequencyPeriodDays: {
      type: Number,
      default: 30,
    },
    inactivityPeriodDays: {
      type: Number,
      default: 60,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookups
hallSchema.index({ isActive: 1 });
hallSchema.index({ state: 1, city: 1 });

export const HallModel = model<Hall>("Hall", hallSchema);
