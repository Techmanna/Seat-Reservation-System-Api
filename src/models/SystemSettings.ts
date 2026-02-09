import { Schema, model } from "mongoose";
import { SystemSettings } from "../types/index";

const systemSettingsSchema = new Schema<SystemSettings>(
  {
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
  },
  {
    timestamps: true,
  }
);

export const SystemSettingsModel = model<SystemSettings>(
  "SystemSettings",
  systemSettingsSchema
);
