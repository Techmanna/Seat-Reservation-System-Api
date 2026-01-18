import { UserModel } from "../models/User";
import { EventModel } from "../models/Event";
import { BookingModel } from "../models/Booking";
import { SystemSettingsModel } from "../models/SystemSettings";
import { QRService } from "./QRService";
import { v4 as uuidv4 } from "uuid";
import {
  startOfDay,
  endOfDay,
  isAfter,
  isBefore,
  addMinutes,
  isWithinInterval,
} from "date-fns";
import {
  BookingRequest,
  Booking,
  ApiResponse,
  BookingStatus,
  PendingBooking,
  OTPVerificationRequest,
  CancelBookingRequest,
} from "../types/index";
import { SeatUtils } from "../utils/seat";
import { NotFoundError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import { NotificationService } from "./NotificationService";
import { OTPModel } from "../models/OTP";
import { PendingBookingModel } from "../models/PendingBooking";
import { getSystemSettings } from "./SettingsService";
import config from "../config/environment";
import * as crypto from "crypto";

interface BookingRequestWithSeats extends Omit<BookingRequest, "seatNumbers"> {
  seatLabels: string[];
}

export class BookingService {
  private notificationService: NotificationService;
  private qrService: QRService;
  private pendingBookings: Map<string, PendingBooking> = new Map();

  constructor() {
    this.notificationService = new NotificationService();
    this.qrService = new QRService();

    // Clean up expired pending bookings every 10 minutes
    setInterval(() => this.cleanupExpiredBookings(), 10 * 60 * 1000);
  }

  private async cleanupExpiredBookings() {
    try {
      const now = new Date();
      await PendingBookingModel.deleteMany({
        expiresAt: { $lt: now },
      });
      logger.info("Cleaned up expired pending bookings");
    } catch (error) {
      logger.error("Error cleaning up expired pending bookings:", error);
    }
  }

  private generateOTP(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private generateReservationToken(email: string, eventDate: string): string {
    const secret = config.jwt.secret;
    const data = `${email}:${eventDate}:${Date.now()}`;
    return crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("hex")
      .substring(0, 32); // Take first 32 characters for shorter token
  }

  async initiateBooking(bookingData: BookingRequest): Promise<
    | ApiResponse<Booking>
    | ApiResponse<{
        tempId?: string;
        expiresAt?: Date;
        reservationToken: string;
        requiresOTP: boolean;
      }>
  > {
    try {
      // Perform all the validation checks first (same as original createBooking)
      const settings = await getSystemSettings();
      const now = new Date();
      const selected = startOfDay(new Date(bookingData.eventDate));
      const start = startOfDay(settings.reservationOpenDate);
      const end = endOfDay(settings.reservationCloseDate);
      console.log({
        now,
        reservationOpenDate: settings.reservationOpenDate,
        reservationCloseDate: settings.reservationCloseDate,
        selectedDate: bookingData.eventDate,
      });

      // Check if reservations are open
      if (
        settings.reservationOpenDate &&
        settings.reservationCloseDate &&
        !isWithinInterval(selected, { start, end })
      ) {
        return {
          success: false,
          message: `Reservations open ${start.toLocaleDateString()} and close ${end.toLocaleDateString()}. Please select a date within this range.`,
          error: "Outside reservation period",
        };
      }

      const eventDate = new Date(bookingData.eventDate);
      // Check if event date is in the future
      if (isBefore(eventDate, startOfDay(now))) {
        return {
          success: false,
          message: "Cannot book for past dates",
          error: "Invalid date",
        };
      }

      // Only allow Monday to Friday
      const dayOfWeek = eventDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return {
          success: false,
          message: "Bookings are only allowed from Monday to Friday",
          error: "Invalid event date",
        };
      }

      // Check if user already has a booking for this date
      const existingUser = await UserModel.findOne({
        email: bookingData.email,
      });
      if (existingUser) {
        const existingBooking = await BookingModel.findOne({
          user: { _id: existingUser._id?.toString() },
          eventDate: {
            $gte: startOfDay(eventDate),
            $lte: endOfDay(eventDate),
          },
          status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
        });

        if (existingBooking) {
          return {
            success: false,
            message: "You already have a booking for this date",
            error: "Duplicate booking",
          };
        }

        // or the pending booking
        const pendingBooking = await PendingBookingModel.findOne({
          email: bookingData.email,
          bookingData: {
            eventDate: {
              $gte: startOfDay(eventDate),
              $lte: endOfDay(eventDate),
            },
          },
        });

        if (pendingBooking) {
          return {
            success: false,
            message: "You already have a pending booking for this date",
            error: "Pending booking",
          };
        }
      }

      // Validate seat count
      if (bookingData.seatLabels.length > settings.maxSeatsPerUser) {
        return {
          success: false,
          message: `Maximum ${settings.maxSeatsPerUser} seats allowed per booking`,
          error: "Too many seats",
        };
      }

      // Find or create event
      let event = await EventModel.findOne({
        date: {
          $gte: startOfDay(eventDate),
          $lte: endOfDay(eventDate),
        },
      });

      if (!event) {
        event = new EventModel({
          date: eventDate,
          time: settings.eventTimes[0] || "10:00 AM",
          totalSeats: settings.defaultTotalSeats,
          availableSeats: settings.defaultTotalSeats,
          isActive: true,
        });
        await event.save();
      }

      // Validate and convert seat labels to numbers
      let seatNumbers: number[];
      let seatLabels: string[];

      try {
        const seatInfo = SeatUtils.validateAndConvertSeatLabels(
          bookingData.seatLabels,
          event.totalSeats
        );
        seatNumbers = seatInfo.numbers;
        seatLabels = seatInfo.labels;
      } catch (error: any) {
        return {
          success: false,
          message: error.message,
          error: "Invalid seat selection",
        };
      }

      // Check seat availability
      if (event.availableSeats < seatNumbers.length) {
        return {
          success: false,
          message: "Not enough seats available",
          error: "Insufficient seats",
        };
      }

      // Check if requested seats are available in both confirmed and pending bookings
      const bookedSeats = await BookingModel.find({
        eventId: event._id?.toString(),
        status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
      }).select("seatNumbers seatLabels");

      const pendingBookings = await PendingBookingModel.find({
        "bookingData.eventDate": {
          $gte: startOfDay(eventDate),
          $lte: endOfDay(eventDate),
        },
        expiresAt: { $gt: new Date() }, // Only check non-expired pending bookings
      }).select("bookingData.seatLabels bookingData.seatNumbers");

      const allBookedSeatNumbers = bookedSeats.flatMap(
        (booking) => booking.seatNumbers
      );
      const allBookedSeatLabels = bookedSeats.flatMap(
        (booking) => booking.seatLabels
      );
      const allPendingSeatNumbers = pendingBookings.flatMap(
        (pending) => pending.bookingData.seatNumbers || []
      );
      const allPendingSeatLabels = pendingBookings.flatMap(
        (pending) => pending.bookingData.seatLabels || []
      );

      const conflictingNumbers = seatNumbers.filter(
        (seat) =>
          allBookedSeatNumbers.includes(seat) ||
          allPendingSeatNumbers.includes(seat)
      );
      const conflictingLabels = seatLabels.filter(
        (label) =>
          allBookedSeatLabels.includes(label) ||
          allPendingSeatLabels.includes(label)
      );

      if (conflictingNumbers.length > 0) {
        return {
          success: false,
          message: `Seats ${conflictingLabels.join(
            ", "
          )} are already booked or pending`,
          error: "Seats unavailable",
        };
      }

      // Generate reservation token for security
      const reservationToken = this.generateReservationToken(
        bookingData.email,
        eventDate.toISOString()
      );

      // Add reservation token to booking data
      const bookingDataWithToken = {
        ...bookingData,
        eventDate,
        reservationToken,
      };

      // Check if user exists to determine if OTP is required
      const isExistingUser = existingUser !== null;

      if (isExistingUser) {
        // User exists, skip OTP and complete booking directly
        const bookingResult = await this.completeBooking(bookingDataWithToken);

        if (bookingResult.success) {
          bookingResult.message =
            "Booking completed successfully! Check your email for confirmation.";
          return bookingResult;
        } else {
          return bookingResult as unknown as ApiResponse<{
            tempId?: string;
            expiresAt?: Date;
            reservationToken: string;
            requiresOTP: boolean;
          }>;
        }
      } else {
        // New user, require OTP verification
        const otp = this.generateOTP();
        const tempId = uuidv4();
        const expiresAt = addMinutes(now, 10); // OTP expires in 10 minutes

        // Store or update OTP
        await OTPModel.findOneAndUpdate(
          { email: bookingData.email },
          {
            email: bookingData.email,
            otp,
            tempId,
            expiresAt,
            verified: false,
            attempts: 0,
          },
          { upsert: true, new: true }
        );

        // Store pending booking in database
        await PendingBookingModel.findOneAndUpdate(
          { email: bookingData.email },
          {
            tempId,
            email: bookingData.email,
            bookingData: bookingDataWithToken,
            createdAt: now,
            expiresAt,
          },
          { upsert: true, new: true }
        );

        // Send OTP email
        try {
          await this.notificationService.sendOTPEmail(
            bookingData.email,
            otp,
            bookingData.name
          );
        } catch (emailError) {
          logger.error("Failed to send OTP email:", emailError);
          return {
            success: false,
            message: "Failed to send verification email. Please try again.",
            error: "Email service error",
          };
        }

        return {
          success: true,
          message:
            "Verification code sent to your email. Please check and verify to complete booking.",
          data: {
            tempId,
            expiresAt,
            reservationToken,
            requiresOTP: true,
          },
        };
      }
    } catch (error: any) {
      logger.error("Booking initiation error:", error);
      return {
        success: false,
        message: "Failed to initiate booking",
        error: error.message,
      };
    }
  }

  async verifyOTPAndCompleteBooking(
    data: OTPVerificationRequest
  ): Promise<ApiResponse<Booking>> {
    try {
      const { email, otp, tempId, reservationToken } = data;

      // Get OTP record
      const otpRecord = await OTPModel.findOne({ email, tempId });

      if (!otpRecord) {
        return {
          success: false,
          message: "Invalid verification request",
          error: "OTP record not found",
        };
      }

      // Check if OTP is expired
      if (isAfter(new Date(), otpRecord.expiresAt)) {
        await Promise.all([
          OTPModel.deleteOne({ _id: otpRecord._id }),
          PendingBookingModel.deleteOne({ email, tempId }),
        ]);
        return {
          success: false,
          message: "Verification code expired. Please request a new one.",
          error: "OTP expired",
        };
      }

      // Check if already verified
      if (otpRecord.verified) {
        return {
          success: false,
          message: "This verification code has already been used",
          error: "OTP already used",
        };
      }

      // Check attempts limit
      if (otpRecord.attempts >= 3) {
        await Promise.all([
          OTPModel.deleteOne({ _id: otpRecord._id }),
          PendingBookingModel.deleteOne({ email, tempId }),
        ]);
        return {
          success: false,
          message:
            "Too many failed attempts. Please request a new verification code.",
          error: "Max attempts exceeded",
        };
      }

      // Verify OTP
      if (otpRecord.otp !== otp) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        return {
          success: false,
          message: `Invalid verification code. ${
            3 - otpRecord.attempts
          } attempts remaining.`,
          error: "Invalid OTP",
        };
      }

      // Get pending booking from database
      const pendingBooking = await PendingBookingModel.findOne({
        email,
        tempId,
        expiresAt: { $gt: new Date() }, // Ensure not expired
      });

      if (!pendingBooking) {
        return {
          success: false,
          message: "Booking session expired. Please start again.",
          error: "Pending booking not found or expired",
        };
      }

      // Mark OTP as verified
      otpRecord.verified = true;
      await otpRecord.save();

      // Complete the booking using the original createBooking logic
      const bookingResult = await this.completeBooking({
        ...pendingBooking.bookingData,
        reservationToken,
      });

      // Clean up from database
      await Promise.all([
        PendingBookingModel.deleteOne({ _id: pendingBooking._id }),
        OTPModel.deleteOne({ _id: otpRecord._id }),
      ]);

      return bookingResult;
    } catch (error: any) {
      logger.error("OTP verification error:", error);
      return {
        success: false,
        message: "Failed to verify and complete booking",
        error: error.message,
      };
    }
  }

  private async completeBooking(
    bookingData: BookingRequest
  ): Promise<ApiResponse<Booking>> {
    try {
      const eventDate = new Date(bookingData.eventDate);
      const settings = await getSystemSettings();

      // Find event
      let event = await EventModel.findOne({
        date: {
          $gte: startOfDay(eventDate),
          $lte: endOfDay(eventDate),
        },
      });

      if (!event) {
        return {
          success: false,
          message: "Event not found",
          error: "Event not found",
        };
      }

      // Validate seats again (in case they were booked while waiting for OTP)
      const seatInfo = SeatUtils.validateAndConvertSeatLabels(
        bookingData.seatLabels,
        event.totalSeats
      );
      const seatNumbers = seatInfo.numbers;
      const seatLabels = seatInfo.labels;

      // Check seat availability again
      const bookedSeats = await BookingModel.find({
        eventId: event._id?.toString(),
        status: { $ne: BookingStatus.Cancelled },
      }).select("seatNumbers seatLabels");

      const allBookedSeatNumbers = bookedSeats.flatMap(
        (booking) => booking.seatNumbers
      );
      const conflictingNumbers = seatNumbers.filter((seat) =>
        allBookedSeatNumbers.includes(seat)
      );

      if (conflictingNumbers.length > 0) {
        const allBookedSeatLabels = bookedSeats.flatMap(
          (booking) => booking.seatLabels
        );
        const conflictingLabels = seatLabels.filter((label) =>
          allBookedSeatLabels.includes(label)
        );
        return {
          success: false,
          message: `Seats ${conflictingLabels.join(
            ", "
          )} were booked by someone else. Please select different seats.`,
          error: "Seats no longer available",
        };
      }

      // Create or update user
      let user = await UserModel.findOne({ email: bookingData.email });
      if (!user) {
        user = new UserModel({
          name: bookingData.name,
          email: bookingData.email,
          phone: bookingData.phone,
          gender: bookingData.gender,
          ageRange: bookingData.ageRange,
        });
        await user.save();
      } else {
        user.name = bookingData.name;
        user.phone = bookingData.phone;
        user.gender = bookingData.gender;
        user.ageRange = bookingData.ageRange;
        await user.save();
      }

      // Create booking
      const ticketId = uuidv4().split("-")[0].toUpperCase();
      const booking = new BookingModel({
        ticketId,
        user,
        event,
        eventDate: eventDate,
        seatNumbers,
        seatLabels,
        status: BookingStatus.Attending,
        reservationToken: bookingData.reservationToken,
        qrCode: "",
        calendarLink: this.generateGoogleCalendarLink(
          seatLabels,
          ticketId,
          eventDate
        ),
      });

      // Generate QR code
      const qrCode = await this.qrService.generateQRCode(booking);
      booking.qrCode = qrCode;

      await booking.save();

      // Update event available seats
      event.availableSeats -= seatNumbers.length;
      await event.save();

      // Send notifications
      try {
        await Promise.all([
          this.notificationService.sendTicketSMS(user.phone, ticketId),
          this.notificationService.sendBookingConfirmationEmail(
            user,
            booking,
            event
          ),
        ]);
      } catch (notificationError) {
        logger.error("Notification error:", notificationError);
      }

      return {
        success: true,
        message:
          "Booking completed successfully! Check your email for confirmation.",
        data: booking,
      };
    } catch (error: any) {
      logger.error("Complete booking error:", error);
      return {
        success: false,
        message: "Failed to complete booking",
        error: error.message,
      };
    }
  }

  private generateGoogleCalendarLink(
    seatLabels: string[],
    ticketId: string,
    eventDate: Date
  ): string {
    // Start & End time
    const startDate = new Date(eventDate);
    startDate.setHours(16, 0, 0, 0); // 4:00 PM

    const endDate = new Date(eventDate);
    endDate.setHours(18, 0, 0, 0); // 6:00 PM

    // Event details
    const eventData = {
      title: `THE MORAYO BROWN SHOW - Seat ${seatLabels.join(", ")}`,
      start: startDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z",
      end: endDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z",
      description: `Booking ID: ${ticketId}\nLocation: Conference Hall A`,
      location: "Conference Hall A",
    };

    // Google Calendar URL
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      eventData.title
    )}&dates=${eventData.start}/${eventData.end}&details=${encodeURIComponent(
      eventData.description
    )}&location=${encodeURIComponent(eventData.location)}`;
  }

  async resendOTP(email: string): Promise<ApiResponse<{ expiresAt: Date }>> {
    try {
      // Get pending booking from database
      const pendingBooking = await PendingBookingModel.findOne({
        email,
        expiresAt: { $gt: new Date() }, // Not expired
      });

      if (!pendingBooking) {
        return {
          success: false,
          message:
            "No pending booking found for this email or session expired. Kindly book again.",
          error:
            "No pending booking found for this email or session expired. Kindly book again.",
        };
      }

      const now = new Date();
      const otp = this.generateOTP();
      const expiresAt = addMinutes(now, 10);

      // Update OTP record
      await OTPModel.findOneAndUpdate(
        { email },
        {
          otp,
          expiresAt,
          verified: false,
          attempts: 0,
        }
      );

      // Update pending booking expiration
      pendingBooking.expiresAt = expiresAt;
      await pendingBooking.save();

      // Send new OTP
      await this.notificationService.sendOTPEmail(
        email,
        otp,
        pendingBooking.bookingData.name
      );

      return {
        success: true,
        message: "New verification code sent to your email",
        data: { expiresAt },
      };
    } catch (error: any) {
      logger.error("Resend OTP error:", error);
      return {
        success: false,
        message: "Failed to resend verification code",
        error: error.message,
      };
    }
  }

  async getBookingByTicketId(ticketId: string): Promise<ApiResponse<any>> {
    try {
      const booking = await BookingModel.findOne({ ticketId }).populate(
        "user event"
      );

      if (!booking) {
        return {
          success: false,
          message: "Booking not found",
          error: "Invalid ticket ID",
        };
      }

      return {
        success: true,
        message: "Booking found",
        data: booking,
      };
    } catch (error: any) {
      return {
        success: false,
        message: "Failed to fetch booking",
        error: error.message,
      };
    }
  }

  async verifyBooking(ticketId: string): Promise<ApiResponse<Booking>> {
    try {
      const booking = await BookingModel.findOneAndUpdate(
        { ticketId, status: BookingStatus.Attending },
        { status: BookingStatus.Attended },
        { new: true }
      ).populate("user event");

      if (!booking) {
        return {
          success: false,
          message: "Booking not found or already processed",
          error: "Invalid ticket",
        };
      }

      return {
        success: true,
        message: "Booking verified successfully",
        data: booking,
      };
    } catch (error: any) {
      return {
        success: false,
        message: "Failed to verify booking",
        error: error.message,
      };
    }
  }

  async getAvailableSeats(eventDate: string): Promise<ApiResponse<any>> {
    try {
      const date = new Date(eventDate);
      const settings = await getSystemSettings();

      // Find or get default event info
      let event = await EventModel.findOne({
        date: {
          $gte: startOfDay(date),
          $lte: endOfDay(date),
        },
      });

      const totalSeats = event?.totalSeats || settings.defaultTotalSeats;

      // Get booked seats for this date
      const bookedSeats = await BookingModel.find({
        eventDate: {
          $gte: startOfDay(date),
          $lte: endOfDay(date),
        },
        status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
      }).select("seatNumbers seatLabels");

      console.log(bookedSeats.length);

      const bookedSeatNumbers = [
        ...new Set(bookedSeats.flatMap((b) => b.seatNumbers)),
      ];

      console.log(bookedSeatNumbers.length);
      const allSeats = SeatUtils.generateAllSeats(
        totalSeats,
        bookedSeatNumbers
      );
      const availableSeats = allSeats.filter(
        (seat: { isAvailable: any }) => seat.isAvailable
      );

      return {
        success: true,
        message: "Available seats retrieved successfully",
        data: {
          eventDate: eventDate,
          totalSeats,
          availableSeats: availableSeats.length,
          bookedSeats: bookedSeatNumbers.length,
          allSeats,
          availableSeatList: availableSeats,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: "Failed to fetch available seats",
        error: error.message,
      };
    }
  }

  async getAllBookings({
    page = 1,
    limit = 10,
    search = "",
    status,
    eventDate,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    eventDate?: string;
  }): Promise<ApiResponse<Booking[]>> {
    try {
      const query: any = {};

      // Search by user full name or event name
      // Search by user or event fields
      if (search) {
        const regex = new RegExp(search, "i");

        // Step 1: Search users and events separately
        const [users, events] = await Promise.all([
          UserModel.find({
            $or: [{ name: regex }, { email: regex }, { phone: regex }],
          }).select("_id"),
          EventModel.find({
            $or: [
              { name: regex },
              { availableSeats: regex }, // if availableSeats is string
            ],
          }).select("_id"),
        ]);

        const userIds = users.map((user) => user._id);
        const eventIds = events.map((event) => event._id);

        // Step 2: Add OR clause for user/event match or ticketId
        query.$or = [
          { user: { $in: userIds } },
          { event: { $in: eventIds } },
          { ticketId: regex },
        ];
      }

      // Filter by status if provided
      if (status) {
        query.status = status;
      }

      if (eventDate) {
        const date = new Date(eventDate as string);
        query.eventDate = {
          $gte: startOfDay(date),
          $lte: endOfDay(date),
        };
      }

      const skip = (page - 1) * limit;

      const bookings = await BookingModel.find(query)
        .populate("user event")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }) // most recent first
        .exec();

      const total = await BookingModel.countDocuments(query);

      return {
        success: true,
        message: "Bookings fetched successfully",
        data: bookings,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Error fetching bookings:", error);
      return {
        success: false,
        message: "Failed to fetch bookings",
        data: [],
      };
    }
  }

  async getUpcomingEvents({
    page = 1,
    limit = 10,
    includeFullyBooked = false,
    startDate,
    endDate,
  }: {
    page?: number;
    limit?: number;
    includeFullyBooked?: boolean;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const settings = await getSystemSettings();
      const now = new Date();
      const today = startOfDay(now);

      // Build query for upcoming events
      const query: any = {
        date: { $gte: today },
        isActive: true,
      };

      // Add date range filters if provided
      if (startDate) {
        query.date.$gte = startOfDay(new Date(startDate));
      }

      if (endDate) {
        query.date.$lte = endOfDay(new Date(endDate));
      }

      // Ensure we don't go beyond reservation close date
      if (settings.reservationCloseDate) {
        query.date.$lte = endOfDay(new Date(settings.reservationCloseDate));
      }

      const skip = (page - 1) * limit;

      // Get events with booking statistics
      const events = await EventModel.find(query)
        .sort({ date: 1 }) // Sort by date ascending (earliest first)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec();

      const total = await EventModel.countDocuments(query);

      // Enhance each event with booking information
      const enhancedEvents = await Promise.all(
        events.map(async (event) => {
          // Get booking statistics for this event
          const bookings = await BookingModel.find({
            eventDate: {
              $gte: startOfDay(new Date(event.date)),
              $lte: endOfDay(new Date(event.date)),
            },
            status: { $ne: BookingStatus.Cancelled },
          }).select("seatNumbers seatLabels status");

          const totalBookedSeats = bookings.reduce(
            (sum, booking) => sum + booking.seatNumbers.length,
            0
          );

          const attendedBookings = bookings.filter(
            (b) => b.status === BookingStatus.Attended
          ).length;
          const confirmedBookings = bookings.filter(
            (b) => b.status === BookingStatus.Attending
          ).length;

          const isFullyBooked =
            event.availableSeats === 0 || totalBookedSeats >= event.totalSeats;
          const isBookable =
            !isFullyBooked &&
            !isBefore(new Date(event.date), today) &&
            (!settings.reservationCloseDate ||
              !isAfter(
                new Date(event.date),
                new Date(settings.reservationCloseDate)
              ));

          // Check if it's a working day
          const eventDay = new Date(event.date).getDay();
          const workingDayNumber = eventDay === 0 ? 7 : eventDay;
          const isWorkingDay = settings.workingDays.includes(workingDayNumber);

          return {
            ...event,
            bookingStats: {
              totalBookings: bookings.length,
              totalBookedSeats,
              attendedBookings,
              confirmedBookings,
              availableSeats: event.totalSeats - totalBookedSeats,
              occupancyRate: (
                (totalBookedSeats / event.totalSeats) *
                100
              ).toFixed(1),
            },
            isFullyBooked,
            isBookable: isBookable && isWorkingDay,
            isWorkingDay,
            dayOfWeek: new Date(event.date).toLocaleDateString("en-US", {
              weekday: "long",
            }),
            formattedDate: new Date(event.date).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
          };
        })
      );

      // Filter out fully booked events if requested
      const filteredEvents = includeFullyBooked
        ? enhancedEvents
        : enhancedEvents.filter((event) => !event.isFullyBooked);

      return {
        success: true,
        message: "Upcoming events retrieved successfully",
        data: filteredEvents,
        meta: {
          total: includeFullyBooked ? total : filteredEvents.length,
          page,
          limit,
          totalPages: Math.ceil(
            (includeFullyBooked ? total : filteredEvents.length) / limit
          ),
          hasNextPage:
            page <
            Math.ceil(
              (includeFullyBooked ? total : filteredEvents.length) / limit
            ),
          hasPrevPage: page > 1,
          reservationPeriod: {
            open: settings.reservationOpenDate,
            close: settings.reservationCloseDate,
          },
          workingDays: settings.workingDays,
          eventTimes: settings.eventTimes,
        },
      };
    } catch (error: any) {
      logger.error("Error fetching upcoming events:", error);
      return {
        success: false,
        message: "Failed to fetch upcoming events",
        error: error.message,
        data: [],
      };
    }
  }

  async cancelBooking(
    cancelData: CancelBookingRequest
  ): Promise<ApiResponse<Booking>> {
    try {
      const { ticketId, reservationToken, email } = cancelData;

      // First, find the booking
      const booking = await BookingModel.findOne({
        ticketId,
        status: BookingStatus.Attending,
      }).populate("user event");

      if (!booking) {
        return {
          success: false,
          message: "Booking not found or already processed",
          error: "Invalid ticket",
        };
      }

      // Validate reservation token
      const userEmail =
        typeof booking.user === "object" && "email" in booking.user
          ? (booking.user as any).email
          : email; // fallback to provided email if not populated

      const expectedToken = this.generateReservationToken(
        userEmail,
        booking.eventDate.toISOString()
      );

      if (reservationToken !== expectedToken) {
        // logger.warn(`Invalid cancellation attempt for ticket ${ticketId} with token ${reservationToken}`);
        // return {
        //     success: false,
        //     message: 'Invalid cancellation request. Please use the link from your booking confirmation email.',
        //     error: 'Invalid token'
        // };
      }

      // Optional: Additional email validation for extra security
      // if (email && email !== booking.user.email) {
      //     return {
      //         success: false,
      //         message: 'Email does not match booking record',
      //         error: 'Email mismatch'
      //     };
      // }

      // Check if cancellation is allowed (e.g., not too close to event date)
      const settings = await getSystemSettings();
      const now = new Date();
      const eventDate = new Date(booking.eventDate);
      const hoursUntilEvent =
        (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Example: Don't allow cancellation within 2 hours of event
      const minCancellationHours = settings.minCancellationHours || 2;
      if (hoursUntilEvent < minCancellationHours) {
        return {
          success: false,
          message: `Cancellation not allowed within ${minCancellationHours} hours of the event`,
          error: "Cancellation too late",
        };
      }

      // Update booking status
      booking.status = BookingStatus.Cancelled;
      booking.cancelledAt = now;
      await booking.save();

      // Update event available seats
      // booking.event may be an ObjectId or a populated Event object
      const eventId =
        typeof booking.event === "object" &&
        booking.event !== null &&
        "_id" in booking.event
          ? (booking.event as any)._id
          : booking.event;
      const event = await EventModel.findById(eventId);
      if (event) {
        event.availableSeats += booking.seatNumbers.length;
        await event.save();
      }

      // Send cancellation confirmation email
      try {
        await this.notificationService.sendCancellationConfirmationEmail(
          booking
        );
      } catch (notificationError) {
        logger.error("Cancellation notification error:", notificationError);
        // Don't fail the cancellation if email fails
      }

      logger.info(
        `Booking ${ticketId} cancelled successfully by user ${userEmail}`
      );

      return {
        success: true,
        message:
          "Booking cancelled successfully. You will receive a confirmation email shortly.",
        data: booking,
      };
    } catch (error: any) {
      logger.error("Error cancelling booking:", error);
      return {
        success: false,
        message: "Failed to cancel booking",
        error: error.message,
      };
    }
  }

  async adminCancelBooking(ticketId: string): Promise<ApiResponse<Booking>> {
    const now = new Date();
    try {
      const booking = await BookingModel.findOneAndUpdate(
        { ticketId, status: BookingStatus.Attending },
        { status: BookingStatus.Cancelled, cancelledAt: now },
        { new: true }
      ).populate("user event");

      if (!booking) {
        return {
          success: false,
          message: "Booking not found or already processed",
          error: "Invalid ticket",
        };
      }

      return {
        success: true,
        message: "Booking cancelled successfully",
        data: booking,
      };
    } catch (error: any) {
      logger.error("Error cancelling booking:", error);
      return {
        success: false,
        message: "Failed to cancel booking",
        error: error.message,
      };
    }
  }

  // getUpcomingEvents
  async getUpcomingEventsSummary(): Promise<ApiResponse<any>> {
    try {
      const settings = await getSystemSettings();
      const now = new Date();
      const today = startOfDay(now);

      // Get upcoming events count
      const upcomingEventsCount = await EventModel.countDocuments({
        date: { $gte: today },
        isActive: true,
      });

      // Get next few events (next 5)
      const nextEvents = await EventModel.find({
        date: { $gte: today },
        isActive: true,
      })
        .sort({ date: 1 })
        .limit(5)
        .lean()
        .exec();

      // Get booking stats for next events
      const nextEventsWithStats = await Promise.all(
        nextEvents.map(async (event) => {
          const bookings = await BookingModel.find({
            eventDate: {
              $gte: startOfDay(new Date(event.date)),
              $lte: endOfDay(new Date(event.date)),
            },
            status: { $ne: BookingStatus.Cancelled },
          });

          const totalBookedSeats = bookings.reduce(
            (sum, booking) => sum + booking.seatNumbers.length,
            0
          );

          return {
            ...event,
            totalBookedSeats,
            availableSeats: event.totalSeats - totalBookedSeats,
            occupancyRate: (
              (totalBookedSeats / event.totalSeats) *
              100
            ).toFixed(1),
            formattedDate: new Date(event.date).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            }),
          };
        })
      );

      return {
        success: true,
        message: "Upcoming events summary retrieved successfully",
        data: {
          upcomingEventsCount,
          nextEvents: nextEventsWithStats,
        },
      };
    } catch (error: any) {
      logger.error("Error fetching upcoming events summary:", error);
      return {
        success: false,
        message: "Failed to fetch upcoming events summary",
        error: error.message,
        data: [],
      };
    }
  }

  async resendBookingConfirmation(
    ticketId: string
  ): Promise<ApiResponse<null>> {
    try {
      const booking = await BookingModel.findOne({ ticketId });
      if (!booking) {
        return {
          success: false,
          message: "Booking not found",
          error: "Booking not found",
        };
      }

      const user = await UserModel.findOne({ _id: booking.user });
      if (!user) {
        return {
          success: false,
          message: "User not found",
          error: "User not found",
        };
      }

      const event = await EventModel.findOne({ _id: booking.event });
      if (!event) {
        return {
          success: false,
          message: "Event not found",
          error: "Event not found",
        };
      }

      await this.notificationService.sendBookingConfirmationEmail(
        user,
        booking,
        event
      );

      return {
        success: true,
        message: "Booking confirmation email resent successfully",
        data: null,
      };
    } catch (error: any) {
      logger.error("Error resending booking confirmation email:", error);
      return {
        success: false,
        message: "Failed to resend booking confirmation email",
        error: error.message,
        data: null,
      };
    }
  }
}
