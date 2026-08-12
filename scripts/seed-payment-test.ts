import mongoose from "mongoose";
import dotenv from "dotenv";
import { UserModel } from "../src/models/User";
import { HallModel } from "../src/models/Hall";
import { EventModel } from "../src/models/Event";
import { BookingModel } from "../src/models/Booking";
import { BookingStatus } from "../src/types/index";
import crypto from "crypto";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/morayoshow_db";

async function seed() {
  try {
    console.log("Connecting to DB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB.");

    // 1. Ensure User exists
    let user = await UserModel.findOne({ email: "davidenabs@gmail.com" });
    if (!user) {
      console.log("Creating user davidenabs@gmail.com...");
      user = await UserModel.create({
        name: "David Enabs",
        email: "davidenabs@gmail.com",
        phone: "+2348000000000",
        country: "Nigeria",
        password: "password123",
        authProvider: "local",
        isVerified: true,
        ageRange: "26-35",
        gender: "male",
      });
    } else {
      console.log("User davidenabs@gmail.com already exists.");
    }

    // 2. Ensure Paid Hall exists
    let hall = await HallModel.findOne({ name: "Payment Test Hall" });
    if (!hall) {
      console.log("Creating paid hall...");
      hall = await HallModel.create({
        name: "Payment Test Hall",
        state: "Lagos",
        city: "Ikeja",
        address: "Test Address",
        reservationOpenDate: new Date(),
        reservationCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        defaultTotalSeats: 100,
        eventTimes: ["09:00 AM"],
        workingDays: [1, 2, 3, 4, 5], // Mon-Fri
        maxSeatsPerUser: 5,
        minCancellationHours: 2,
        isPaymentEnabled: true,
        paymentPriceNGN: 15000,
        paymentPriceUSD: 10,
      });
    } else {
      console.log("Paid hall already exists.");
      // Ensure it's paid
      hall.isPaymentEnabled = true;
      hall.paymentPriceNGN = 15000;
      await hall.save();
    }

    // 3. Ensure Event exists
    let event = await EventModel.findOne({ title: "Payment Test Event" });
    if (!event) {
      console.log("Creating event...");
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 14); // 2 weeks from now
      
      event = await EventModel.create({
        hall: hall._id,
        date: eventDate,
        time: "09:00 AM",
        endTime: "11:00 AM",
        totalSeats: 100,
        availableSeats: 98,
        isActive: true,
        title: "Payment Test Event",
      });
    } else {
      console.log("Event already exists.");
    }

    // 4. Create pending payment booking
    const ticketId = "BKG-TEST-" + crypto.randomBytes(4).toString("hex").toUpperCase();
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7); // 1 week grace period

    console.log("Creating pending booking...");
    const booking = await BookingModel.create({
      ticketId,
      user: user._id,
      hall: hall._id,
      event: event._id,
      eventDate: event.date,
      seatNumbers: [1, 2],
      seatLabels: ["A1", "A2"],
      calendarLink: "https://calendar.google.com/test",
      status: BookingStatus.Attending,
      paymentStatus: "pending",
      paymentExpiresAt: expirationDate,
      qrCode: "test-qr",
      reservationToken: "test-token-" + Date.now(),
      category: "general",
      priorityScore: 0
    });

    console.log(`\n✅ Successfully seeded!`);
    console.log(`User: ${user.email}`);
    console.log(`Ticket ID: ${ticketId}`);
    console.log(`Payment Status: pending`);
    console.log(`Payment Expires At: ${expirationDate.toISOString()}`);
    console.log(`Event Date: ${event.date.toISOString()}`);
    console.log(`\nYou can now go to the Admin Dashboard > Registrations, select this booking, and click "Generate Payment Link".`);
    
  } catch (error) {
    console.error("Error seeding:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from DB.");
  }
}

seed();
