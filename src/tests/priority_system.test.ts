import mongoose from "mongoose";
import connectDB from "../config/database";
import { BookingService } from "../services/BookingService";
import { PriorityService } from "../services/PriorityService";
import { BookingModel } from "../models/Booking";
import { UserModel } from "../models/User";
import { EventModel } from "../models/Event";
import { SystemSettingsModel } from "../models/SystemSettings";
import { BookingStatus } from "../types/index";
import { DateTime } from "luxon";

describe("Booking Prioritization System", () => {
  let bookingService: BookingService;
  let priorityService: PriorityService;
  let testEvent: any;
  let testSettings: any;

  beforeAll(async () => {
    // Increase timeout for DB connection
    jest.setTimeout(30000);
    await connectDB();

    bookingService = new BookingService();
    priorityService = new PriorityService();

    // Create a base event for testing (80 seats)
    const eventDate = DateTime.now().plus({ days: 5 }).toJSDate();
    testEvent = await EventModel.create({
      date: eventDate,
      title: "Test Priority Event",
      totalSeats: 80,
      availableSeats: 80,
      isActive: true,
      time: "09:00",
    });

    // Clean up existing settings from seeders
    await SystemSettingsModel.deleteMany({});

    // Create system settings with priority system enabled
    const nowLagos = DateTime.now().setZone('Africa/Lagos');
    testSettings = await SystemSettingsModel.create({
      reservationOpenDate: nowLagos.minus({ days: 10 }).toJSDate(),
      reservationCloseDate: nowLagos.plus({ days: 30 }).toJSDate(),
      defaultTotalSeats: 80,
      maxSeatsPerUser: 2,
      minCancellationHours: 2,
      prioritySystemEnabled: true,
      prioritySeatAllocation: 50, // 50 seats priority, 30 general
      waitingListCapacity: 5,
      autoAllocationHoursBeforeEvent: 12,
      priorityRules: {
        newUser: true,
        lowFrequency: true,
        inactivity: true,
        neverBooked: true,
      },
      lowFrequencyThreshold: 1,
      lowFrequencyPeriodDays: 30,
      inactivityPeriodDays: 60,
    });
  });

  afterAll(async () => {
    await UserModel.deleteMany({ email: /@test-priority\.com/ });
    await BookingModel.deleteMany({ eventId: testEvent._id });
    await EventModel.deleteOne({ _id: testEvent._id });
    await SystemSettingsModel.deleteOne({ _id: testSettings._id });
  });

  beforeEach(async () => {
    await BookingModel.deleteMany({});
  });

  describe("Priority Calculation", () => {
    it("should mark a completely new user as priority", async () => {
      const email = "new-user@test-priority.com";
      const result = await priorityService.calculatePriority(email, testSettings);
      expect(result.isPriority).toBe(true);
      expect(result.reasons).toContain("New user (First-time attendee)");
    });

    it("should mark an existing user with no bookings as priority", async () => {
      const email = "no-bookings@test-priority.com";
      const user = await UserModel.create({
        name: "No Bookings User",
        email,
        phone: "1234567890",
      });

      const result = await priorityService.calculatePriority(email, testSettings);
      expect(result.isPriority).toBe(true);
      expect(result.reasons).toContain("Has never booked an event before");
    });

    it("should mark a frequent user as general", async () => {
      const email = "frequent@test-priority.com";
      const user = await UserModel.create({
        name: "Frequent User",
        email,
      });

      // Add 2 recent bookings
      await BookingModel.create([
        {
          user: user._id,
          event: new mongoose.Types.ObjectId(),
          eventDate: DateTime.now().minus({ days: 5 }).toJSDate(),
          status: BookingStatus.Attended,
          ticketId: "T1",
          seatNumbers: [1],
          seatLabels: ["A1"],
          reservationToken: "token1",
          qrCode: "qr1",
        },
        {
          user: user._id,
          event: new mongoose.Types.ObjectId(),
          eventDate: DateTime.now().minus({ days: 10 }).toJSDate(),
          status: BookingStatus.Attended,
          ticketId: "T2",
          seatNumbers: [2],
          seatLabels: ["A2"],
          reservationToken: "token2",
          qrCode: "qr2",
        },
      ]);

      const result = await priorityService.calculatePriority(email, testSettings);
      expect(result.isPriority).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });
  });

  describe("Booking Allocation & Waitlist", () => {
    it("should allow general users until general pool is full", async () => {
      // Fill general pool (30 seats)
      // Mocking confirmed general bookings
      const bookings = [];
      for (let i = 1; i <= 30; i++) {
        const row = String.fromCharCode(65 + Math.floor((i - 1) / 10));
        const num = ((i - 1) % 10) + 1;
        bookings.push({
          event: testEvent._id,
          eventDate: testEvent.date,
          status: BookingStatus.Attending,
          category: "general",
          ticketId: `G${Date.now()}${i}`,
          seatNumbers: [i],
          seatLabels: [`${row}${num}`],
          user: new mongoose.Types.ObjectId(),
          reservationToken: `gtok${i}`,
          qrCode: `gqr${i}`,
        });
      }
      await BookingModel.create(bookings);
      
      // Update event available seats
      testEvent.availableSeats = 50; // 80 - 30
      await testEvent.save();

      // Create a frequent user so they are evaluated as general
      const generalEmail = "another-general@test-priority.com";
      const frequentUser = await UserModel.create({
        name: "Another General",
        email: generalEmail,
        phone: "09000000000",
      });
      await BookingModel.create([
        {
          user: frequentUser._id,
          event: new mongoose.Types.ObjectId(),
          eventDate: DateTime.now().minus({ days: 5 }).toJSDate(),
          status: BookingStatus.Attended,
          ticketId: "T-GEN-1",
          seatNumbers: [100],
          seatLabels: ["Z1"],
          reservationToken: "tok1",
          qrCode: "qr1",
        },
        {
          user: frequentUser._id,
          event: new mongoose.Types.ObjectId(),
          eventDate: DateTime.now().minus({ days: 10 }).toJSDate(),
          status: BookingStatus.Attended,
          ticketId: "T-GEN-2",
          seatNumbers: [101],
          seatLabels: ["Z2"],
          reservationToken: "tok2",
          qrCode: "qr2",
        },
      ]);

      const res = await (bookingService as any).initiateBooking({
        email: generalEmail,
        name: "Another General",
        phone: "09000000000",
        gender: "male",
        ageRange: "26-35",
        seatLabels: ["D1"],
        eventDate: testEvent.date,
      });

      // Should be waitlisted directly since it's an existing user (skips OTP)
      if (!res.success) {
        console.log("General booking failure:", res);
      }
      expect(res.success).toBe(true);
      const booking = await BookingModel.findOne({ user: frequentUser._id, event: testEvent._id });
      expect(booking).not.toBeNull();
      expect(booking!.status).toBe(BookingStatus.Waitlisted);
      expect(booking!.category).toBe("general");
    });

    it("should allow priority users even if general pool is full", async () => {
      const priorityEmail = "vip-priority@test-priority.com";
      // This user is new, so they should be priority
      const res = await (bookingService as any).initiateBooking({
        email: priorityEmail,
        name: "VIP Priority",
        phone: "09000000001",
        gender: "female",
        ageRange: "18-25",
        seatLabels: ["D2"],
        eventDate: testEvent.date,
      });

      if (!res.success) {
        console.log("Priority booking failure:", res);
      }
      expect(res.success).toBe(true);
      const pending = await mongoose.model("PendingBooking").findOne({ email: priorityEmail });
      expect(pending.bookingData.isWaitlist).toBe(false); // Priority gets the seat
      expect(pending.bookingData.category).toBe("priority");
    });

    it("should reject booking if waiting list is full", async () => {
      // Fill general pool (30 seats)
      const generals = [];
      for (let i = 1; i <= 30; i++) {
        const row = String.fromCharCode(65 + Math.floor((i - 1) / 10));
        const num = ((i - 1) % 10) + 1;
        generals.push({
          event: testEvent._id,
          eventDate: testEvent.date,
          status: BookingStatus.Attending,
          category: "general",
          ticketId: `G2-${Date.now()}${i}`,
          seatNumbers: [i],
          seatLabels: [`${row}${num}`],
          user: new mongoose.Types.ObjectId(),
          reservationToken: `gtok${i}`,
          qrCode: `gqr${i}`,
        });
      }
      await BookingModel.create(generals);

      // Fill waitlist (capacity is 5)
      const waitlistItems = [];
      for (let i = 1; i <= 5; i++) {
        waitlistItems.push({
          event: testEvent._id,
          eventDate: testEvent.date,
          status: BookingStatus.Waitlisted,
          category: "general",
          ticketId: `W${Date.now()}${i}`,
          seatNumbers: [i + 50],
          seatLabels: [`F${i}`],
          user: new mongoose.Types.ObjectId(),
          reservationToken: `wtok${i}`,
          qrCode: `wqr${i}`,
        });
      }
      await BookingModel.create(waitlistItems);

      // Create a frequent user so they are evaluated as general
      const generalEmail = "rejected@test-priority.com";
      const frequentUser = await UserModel.create({
        name: "Rejected User",
        email: generalEmail,
        phone: "09000000002",
      });
      await BookingModel.create([
        {
          user: frequentUser._id,
          event: new mongoose.Types.ObjectId(),
          eventDate: DateTime.now().minus({ days: 5 }).toJSDate(),
          status: BookingStatus.Attended,
          ticketId: "T-REJ-1",
          seatNumbers: [100],
          seatLabels: ["Z1"],
          reservationToken: "tok1",
          qrCode: "qr1",
        },
        {
          user: frequentUser._id,
          event: new mongoose.Types.ObjectId(),
          eventDate: DateTime.now().minus({ days: 10 }).toJSDate(),
          status: BookingStatus.Attended,
          ticketId: "T-REJ-2",
          seatNumbers: [101],
          seatLabels: ["Z2"],
          reservationToken: "tok2",
          qrCode: "qr2",
        },
      ]);

      const res = await (bookingService as any).initiateBooking({
        email: generalEmail,
        name: "Rejected User",
        phone: "09000000002",
        gender: "other",
        ageRange: "36-45",
        seatLabels: ["F6"],
        eventDate: testEvent.date,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Waitlist full");
    });
  });

  describe("Auto-Allocation", () => {
    it("should move waitlisted users to confirmed when priority slots are available", async () => {
      // Clear waitlist and confirmed for this test
      await BookingModel.deleteMany({ eventId: testEvent._id });
      testEvent.availableSeats = 80;
      await testEvent.save();

      // Create 1 priority booking (takes 1 priority seat)
      await BookingModel.create({
        event: testEvent._id,
        eventDate: testEvent.date,
        status: BookingStatus.Attending,
        category: "priority",
        ticketId: "P-REAL",
        seatNumbers: [1],
        seatLabels: ["A1"],
        user: new mongoose.Types.ObjectId(),
        reservationToken: "ptok",
        qrCode: "pqr",
      });

      // Create 30 general bookings (fills general pool)
      const generals = [];
      for (let i = 2; i <= 31; i++) {
        const row = String.fromCharCode(65 + Math.floor((i - 1) / 10));
        const num = ((i - 1) % 10) + 1;
        generals.push({
          event: testEvent._id,
          eventDate: testEvent.date,
          status: BookingStatus.Attending,
          category: "general",
          ticketId: `G-REAL-${Date.now()}-${i}`,
          seatNumbers: [i],
          seatLabels: [`${row}${num}`],
          user: new mongoose.Types.ObjectId(),
          reservationToken: `gtok${i}`,
          qrCode: `gqr${i}`,
        });
      }
      await BookingModel.create(generals);
      
      testEvent.availableSeats = 80 - 31;
      await testEvent.save();

      // Create 2 waitlisted bookings
      const waitlistedUser = await UserModel.create({ name: "Wait User", email: "wait@test-priority.com" });
      const waitlistedUser2 = await UserModel.create({ name: "Wait User 2", email: "wait2@test-priority.com" });
      const waitlist = await BookingModel.create([
        {
          event: testEvent._id,
          eventDate: testEvent.date,
          status: BookingStatus.Waitlisted,
          category: "general",
          ticketId: "W-AUTO-1",
          seatNumbers: [50],
          seatLabels: ["E1"],
          user: waitlistedUser._id,
          priorityScore: 0,
          reservationToken: "wtok1",
          qrCode: "wqr1",
        },
        {
          event: testEvent._id,
          eventDate: testEvent.date,
          status: BookingStatus.Waitlisted,
          category: "general",
          ticketId: "W-AUTO-2",
          seatNumbers: [51],
          seatLabels: ["E2"],
          user: waitlistedUser2._id,
          priorityScore: 0,
          reservationToken: "wtok2",
          qrCode: "wqr2",
        }
      ]);

      // Run auto-allocation
      await bookingService.allocateFromWaitlist(testEvent._id.toString());

      // Check results
      const confirmed1 = await BookingModel.findOne({ ticketId: "W-AUTO-1" });
      const confirmed2 = await BookingModel.findOne({ ticketId: "W-AUTO-2" });

      expect(confirmed1).not.toBeNull();
      expect(confirmed2).not.toBeNull();
      expect(confirmed1!.status).toBe(BookingStatus.Attending);
      expect(confirmed1!.category).toBe("priority"); // They took priority slots
      expect(confirmed2!.status).toBe(BookingStatus.Attending);
      expect(confirmed2!.category).toBe("priority");

      // Check event available seats
      const updatedEvent = await EventModel.findById(testEvent._id);
      expect(updatedEvent).not.toBeNull();
      expect(updatedEvent!.availableSeats).toBe(80 - 31 - 2);
    });
  });
});
