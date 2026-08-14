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
  for (const b of bookings) {
    if (b.status === 'cancelled') {
      b.status = 'attending' as any;
      b.paymentExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      await b.save();
      console.log(`Un-cancelled booking ${b._id}`);
    }
  }
  process.exit(0);
}
run();
