import { UserModel } from "../models/User";
import { BookingModel } from "../models/Booking";
import { BookingStatus, Hall } from "../types/index";
import { DateTime } from "luxon";

export class PriorityService {
  /**
   * Calculates the priority score for a user based on historical data and rules for a specific hall.
   */
  public async calculatePriority(
    email: string,
    hallId: string,
    settings: Hall
  ): Promise<{ isPriority: boolean; score: number; reasons: string[] }> {
    let score = 0;
    const reasons: string[] = [];
    const user = await UserModel.findOne({ email });

    // 1. New User (No account yet)
    if (!user) {
      if (settings.priorityRules.newUser) {
        score += 1;
        reasons.push("New user (First-time attendee)");
      }
      return {
        isPriority: score > 0,
        score,
        reasons,
      };
    }

    const userId = user._id;

    // 2. Never Booked for an event in this hall
    const totalBookings = await BookingModel.countDocuments({
      user: userId,
      hall: hallId,
      status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
    });

    if (totalBookings === 0 && settings.priorityRules.neverBooked) {
      score += 1;
      reasons.push("Has never booked an event in this hall before");
    }

    // 3. Fewer bookings within a configurable period
    const periodStart = DateTime.now()
      .minus({ days: settings.lowFrequencyPeriodDays })
      .toJSDate();
    const recentBookings = await BookingModel.countDocuments({
      user: userId,
      hall: hallId,
      createdAt: { $gte: periodStart },
      status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
    });

    if (
      recentBookings <= settings.lowFrequencyThreshold &&
      settings.priorityRules.lowFrequency
    ) {
      score += 1;
      reasons.push(
        `Low booking frequency (${recentBookings} bookings in last ${settings.lowFrequencyPeriodDays} days)`
      );
    }

    // 4. Inactivity period
    const lastBooking = await BookingModel.findOne({
      user: userId,
      hall: hallId,
      status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
    }).sort({ eventDate: -1 });

    if (lastBooking && settings.priorityRules.inactivity) {
      const daysSinceLast = DateTime.now().diff(
        DateTime.fromJSDate(lastBooking.eventDate),
        "days"
      ).days;
      if (daysSinceLast >= settings.inactivityPeriodDays) {
        score += 1;
        reasons.push(`Inactive for over ${settings.inactivityPeriodDays} days`);
      }
    }

    return {
      isPriority: score > 0,
      score,
      reasons,
    };
  }
}
