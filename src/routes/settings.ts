import { Router } from "express";
import { UserModel } from "../models/User";
import { EventModel } from "../models/Event";
import { BookingModel } from "../models/Booking";
import { NotificationService } from "../services/NotificationService";
import { startOfDay, endOfDay, subDays, isBefore, isAfter } from "date-fns";
import { validateRequest } from "../middleware/validateRequest";
import { getAllBookingsSchema, ticketIdParamsSchema } from "../dtos/index.dto";
import { ApiResponse, BookingStatus, User } from "../types";
import { BookingService } from "../services/BookingService";
import { SettingsService } from "../services/SettingsService";
import { EventService } from "../services/EventService";

const router = Router();
const settingsService = new SettingsService();

/**
 * @swagger
 * /settings:
 *   get:
 *     summary: Get system settings
 *     description: Retrieve the current system-wide settings for reservations and events
 *     tags:
 *       - Settings
 *     responses:
 *       200:
 *         description: System settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     reservationOpenDate:
 *                       type: string
 *                       format: date
 *                       description: ISO date string (YYYY-MM-DD) when reservations open
 *                       example: "2023-12-01"
 *                     reservationCloseDate:
 *                       type: string
 *                       format: date
 *                       description: ISO date string (YYYY-MM-DD) when reservations close
 *                       example: "2023-12-31"
 *                     defaultTotalSeats:
 *                       type: integer
 *                       description: Default number of total seats per event
 *                       example: 100
 *                     eventTimes:
 *                       type: array
 *                       items:
 *                         type: string
 *                         description: Time slots for events (HH:MM format)
 *                       example: ["09:00", "14:00", "18:00"]
 *                     workingDays:
 *                       type: array
 *                       items:
 *                         type: string
 *                         enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday]
 *                       description: Days of the week when events are held
 *                       example: ["monday", "tuesday", "wednesday", "thursday", "friday"]
 *                     maxSeatsPerUser:
 *                       type: integer
 *                       description: Maximum number of seats a single user can reserve
 *                       example: 5
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to fetch settings"
 *                 error:
 *                   type: string
 *                   example: "Database connection failed"
 */
router.get("", async (req, res) => {
  try {
    const result = await settingsService.getSettings();

    res.status(200).json({
      ...result,
      data: {
        reservationOpenDate: result.data?.reservationOpenDate
          .toISOString()
          .split("T")[0],
        reservationCloseDate: result.data?.reservationCloseDate
          .toISOString()
          .split("T")[0],
        defaultTotalSeats: result.data?.defaultTotalSeats,
        eventTimes: result.data?.eventTimes,
        workingDays: result.data?.workingDays,
        maxSeatsPerUser: result.data?.maxSeatsPerUser,
        blockedDates: result.data?.blockedDates,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
      error: error.message,
    });
  }
});

export default router;
