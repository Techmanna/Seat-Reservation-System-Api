import mongoose from "mongoose";
import { BookingModel } from "../src/models/Booking";
import config from "../src/config/environment";
import { UserModel } from "../src/models/User";

async function run() {
  await mongoose.connect(config.db.mongodb);
  const user = await UserModel.findOne({ email: "iamdavidenabs@gmail.com" });
  if (!user) {
    console.log("User not found");
    process.exit(0);
  }
  const bookings = await BookingModel.find({ user: user._id });
  console.log("Total Bookings:", bookings.length);
  for (const b of bookings) {
    console.log(`Status: ${b.status}, PaymentStatus: ${b.paymentStatus}, Date: ${b.eventDate}`);
  }
  process.exit(0);
}
run();
