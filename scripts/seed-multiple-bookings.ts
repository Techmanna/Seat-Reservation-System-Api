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

async function createBooking(user: any, hall: any, event: any, offsetDays: any) {
  const ticketId = "BKG-MULT-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + offsetDays);

  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 7);

  await BookingModel.create({
    ticketId,
    user: user._id,
    hall: hall._id,
    event: event._id,
    eventDate: eventDate,
    seatNumbers: [Math.floor(Math.random() * 100)],
    seatLabels: ["A" + Math.floor(Math.random() * 100)],
    calendarLink: "https://calendar.google.com/test",
    status: BookingStatus.Attending,
    paymentStatus: "pending",
    paymentExpiresAt: expirationDate,
    qrCode: "test-qr",
    reservationToken: "test-token-" + Date.now() + offsetDays,
    category: "general",
    priorityScore: 0
  });
  console.log(`Created booking for ${user.email} on ${eventDate.toDateString()}`);
}

async function seed() {
  try {
    console.log("Connecting to DB...");
    await mongoose.connect(MONGODB_URI);

    let hall = await HallModel.findOne({ name: "Payment Test Hall" });
    let event = await EventModel.findOne({ title: "Payment Test Event" });

    // Ensure David
    let david = await UserModel.findOne({ email: "davidenabs@gmail.com" });
    if (david) {
      // Create 3 bookings for David
      await createBooking(david, hall, event, 14);
      await createBooking(david, hall, event, 15);
      await createBooking(david, hall, event, 16);
    }

    // Ensure Emma
    let emma = await UserModel.findOne({ email: "emma@gmail.com" });
    if (!emma) {
      emma = await UserModel.create({
        name: "Emma Test",
        email: "emma@gmail.com",
        phone: "+2348000000001",
        country: "Nigeria",
        password: "password123",
        authProvider: "local",
        isVerified: true,
        ageRange: "18-25",
        gender: "female",
      });
    }
    
    // Create 2 bookings for Emma
    await createBooking(emma, hall, event, 20);
    await createBooking(emma, hall, event, 21);

    console.log("Seed completed!");
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.disconnect();
  }
}
seed();
