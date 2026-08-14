import mongoose from "mongoose";
import dotenv from "dotenv";
import { BookingPaymentModel } from "../src/models/BookingPayment";
import config from "../src/config/environment";

dotenv.config();

async function run() {
  await mongoose.connect(config.db.mongodb);
  const payments = await BookingPaymentModel.find({ paymentReference: { $regex: /BKG-255108987c/ } });
  console.log("Payments:", payments);
  process.exit(0);
}

run().catch(console.error);
