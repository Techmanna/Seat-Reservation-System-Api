import { Router } from "express";
import mongoose from "mongoose";
import { UserModel } from "../models/User";
import { EventModel } from "../models/Event";
import { BookingModel } from "../models/Booking";
import { SubscriptionModel } from "../models/Subscription";
import { BookingPaymentModel } from "../models/BookingPayment";

import { NotificationService } from "../services/NotificationService";
import { startOfDay, endOfDay, subDays, isBefore, isAfter, differenceInCalendarDays, addDays } from "date-fns";
import { validateRequest } from "../middleware/validateRequest";
import { getAllBookingsSchema, ticketIdParamsSchema } from "../dtos/index.dto";
import { ApiResponse, BookingStatus, User } from "../types";
import { BookingService } from "../services/BookingService";
import { SettingsService } from "../services/SettingsService";
import { EventService } from "../services/EventService";

const router = Router();
const notificationService = new NotificationService();
const bookingService = new BookingService();
const settingsService = new SettingsService();
const eventService = new EventService();

/**
 * @swagger
 * /admin/revenue:
 *   get:
 *     summary: Aggregate administrative tier metrics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Yields complete business logic states
 */
router.get("/revenue/export", async (req, res) => {
  try {
    // Note: Population assumes the 'user' field exists and references the User collection
    const subscriptions = await SubscriptionModel.find().lean().populate('user');
    
    const exportData = subscriptions.map((sub: any) => ({
      email: sub.email || (sub.user ? sub.user.email : ""),
      plan: sub.plan || "",
      status: sub.status || "",
      provider: sub.provider || "",
      providerSubscriptionId: sub.providerSubscriptionId || "",
      currentPeriodStart: sub.currentPeriodStart ? new Date(sub.currentPeriodStart).toISOString() : "",
      currentPeriodEnd: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toISOString() : "",
      createdAt: sub.createdAt ? new Date(sub.createdAt).toISOString() : ""
    }));

    res.json({
      success: true,
      message: "Transactions exported successfully",
      data: exportData
    });
  } catch (error: any) {
    console.error("Export transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export transactions",
      error: error.message
    });
  }
});

router.get("/revenue", async (req, res) => {
  try {
    const today = new Date();
    const range = (req.query.range as string) || '30d';

    // Pricing definitions (NGN values converted to USD equivalent for unified MRR)
    const pricing: Record<string, { amount: number; amountNgn: number; currency: string }> = {
      '₦2,500':  { amount: 2500  / 1500, amountNgn: 2500,  currency: 'NGN' },
      '₦6,500':  { amount: 6500  / 1500, amountNgn: 6500,  currency: 'NGN' },
      '₦70,000': { amount: 70000 / 1500, amountNgn: 70000, currency: 'NGN' },
      '$2':  { amount: 2,  amountNgn: 2  * 1500, currency: 'USD' },
      '$5':  { amount: 5,  amountNgn: 5  * 1500, currency: 'USD' },
      '$50': { amount: 50, amountNgn: 50 * 1500, currency: 'USD' },
    };

    // Date range resolution
    let startDate: Date;
    let previousStartDate: Date;
    let trendDays: number; // how many daily buckets to generate

    switch (range) {
      case 'today':
        startDate = startOfDay(today);
        previousStartDate = startOfDay(subDays(today, 1));
        trendDays = 1;
        break;
      case '7d':
        startDate = subDays(today, 7);
        previousStartDate = subDays(today, 14);
        trendDays = 7;
        break;
      case '90d':
        startDate = subDays(today, 90);
        previousStartDate = subDays(today, 180);
        trendDays = 90;
        break;
      case 'YTD':
        startDate = new Date(today.getFullYear(), 0, 1);
        previousStartDate = new Date(today.getFullYear() - 1, 0, 1);
        trendDays = differenceInCalendarDays(today, startDate) + 1;
        break;
      case '30d':
      default:
        startDate = subDays(today, 30);
        previousStartDate = subDays(today, 60);
        trendDays = 30;
        break;
    }


    // Fetch all active subs once
    const allActiveSubs = await SubscriptionModel.find({ status: 'active' }).lean();

    // Fetch all successful booking payments
    const allSuccessfulPayments = await BookingPaymentModel.find({ status: 'successful' }).lean();
    
    // Ticket revenue calculation (USD)
    const sumTicketUsd = (payments: typeof allSuccessfulPayments) =>
      payments.reduce((acc, p) => {
         // rough conversion if NGN
         if (p.currency === 'NGN') return acc + (p.amount / 1500);
         return acc + p.amount;
      }, 0);

    const currentPayments = allSuccessfulPayments.filter(p => p.updatedAt && p.updatedAt >= startDate);
    const previousPayments = allSuccessfulPayments.filter(p => p.updatedAt && p.updatedAt >= previousStartDate && p.updatedAt < startDate);

    const currentTicketRev = sumTicketUsd(currentPayments);
    const previousTicketRev = sumTicketUsd(previousPayments);
    const ticketRevDiff = currentTicketRev - previousTicketRev;
    const ticketRevPct = previousTicketRev > 0 ? (ticketRevDiff / previousTicketRev) * 100 : 0;


    const currentSubs  = allActiveSubs.filter(s => s.createdAt && s.createdAt >= startDate);
    const previousSubs = allActiveSubs.filter(s => s.createdAt && s.createdAt >= previousStartDate && s.createdAt < startDate);

    // MRR calculation (USD)
    const sumUsd = (subs: typeof allActiveSubs) =>
      subs.reduce((acc, s) => acc + (pricing[s.tier]?.amount ?? 0), 0);

    const currentMrr  = sumUsd(currentSubs);
    const previousMrr = sumUsd(previousSubs);
    const mrrDiff       = currentMrr - previousMrr;
    const mrrPct        = previousMrr > 0 ? (mrrDiff / previousMrr) * 100 : 0;

    const subDiff = currentSubs.length - previousSubs.length;
    const subPct  = previousSubs.length > 0 ? (subDiff / previousSubs.length) * 100 : 0;

    // ARPU
    const arpu = currentSubs.length > 0 ? currentMrr / currentSubs.length : 0;

    // Churn = cancelled in window / total at start of window
    const cancelledInRange = await SubscriptionModel.countDocuments({
      status: 'cancelled',
      updatedAt: { $gte: startDate }
    });
    const totalAtStart = await SubscriptionModel.countDocuments({
      createdAt: { $lt: startDate },
      status: { $in: ['active', 'cancelled'] }
    });
    const churnRate = totalAtStart > 0 ? (cancelledInRange / totalAtStart) * 100 : 0;

    // Region breakdown — use stored `provider` & `timezone` (no random)
    const NIGERIA_TZ  = ['Africa/Lagos', 'Africa/Abuja'];
    const UK_TZ_PREFIX = ['Europe/'];
    const US_TZ_PREFIX = ['America/'];
    const regions = { nigeriaPaystack: 0, usaUkStripe: 0, restOfWorldStripe: 0 };

    currentSubs.forEach(sub => {
      if (sub.provider === 'paystack') {
        regions.nigeriaPaystack++;
      } else {
        const tz = sub.timezone || '';
        if (NIGERIA_TZ.includes(tz) || US_TZ_PREFIX.some(p => tz.startsWith(p)) || UK_TZ_PREFIX.some(p => tz.startsWith(p))) {
          regions.usaUkStripe++;
        } else {
          regions.restOfWorldStripe++;
        }
      }
    });

    const totalReg = regions.nigeriaPaystack + regions.usaUkStripe + regions.restOfWorldStripe || 1;

    // Tier counts (all active, not just in range)
    const tierCounts = { monthly: 0, annual: 0, weekly: 0 };
    allActiveSubs.forEach(sub => {
      if (sub.tier.includes('2,500') || sub.tier.includes('$2'))  tierCounts.weekly++;
      else if (sub.tier.includes('6,500') || sub.tier.includes('$5'))   tierCounts.monthly++;
      else if (sub.tier.includes('70,000') || sub.tier.includes('$50')) tierCounts.annual++;
    });
    const totalTiers = tierCounts.weekly + tierCounts.monthly + tierCounts.annual || 1;

    // Daily revenue trend — current period vs previous period (USD)
    // Bucket daily: for each day in [0..trendDays-1] count revenue from subs created that day
    const buildDailyTrend = (periodStart: Date, days: number) => {
      return Array.from({ length: days }, (_, i) => {
        const day = startOfDay(addDays(periodStart, i));
        const next = startOfDay(addDays(periodStart, i + 1));
        const dayRevenue = allActiveSubs
          .filter(s => s.createdAt && s.createdAt >= day && s.createdAt < next)
          .reduce((acc, s) => acc + (pricing[s.tier]?.amount ?? 0), 0);
        return {
          date: day.toISOString().slice(0, 10),
          revenue: Math.round(dayRevenue * 100) / 100
        };
      });
    };

    const currentTrend  = buildDailyTrend(startDate,         trendDays);
    const previousTrend = buildDailyTrend(previousStartDate, trendDays);

    res.status(200).json({
      success: true,
      data: {
        range,

        metrics: {
          ticketRevenue: {
            total: Math.round(currentTicketRev * 100) / 100,
            percentage: Math.abs(Math.round(ticketRevPct * 10) / 10),
            trend: ticketRevDiff >= 0 ? 'up' : 'down'
          },
          mrr: {

            total: Math.round(currentMrr * 100) / 100,
            percentage: Math.abs(Math.round(mrrPct * 10) / 10),
            trend: mrrDiff >= 0 ? 'up' : 'down'
          },
          activeSubs: {
            total: currentSubs.length,
            delta: subDiff,
            percentage: Math.abs(Math.round(subPct * 10) / 10),
            trend: subDiff >= 0 ? 'up' : 'down'
          },
          arpu: Math.round(arpu * 100) / 100,
          churnRate: Math.round(churnRate * 10) / 10,
        },
        byRegion: {
          nigeriaPaystack: Math.round((regions.nigeriaPaystack / totalReg) * 100),
          usaUkStripe:     Math.round((regions.usaUkStripe     / totalReg) * 100),
          restOfWorldStripe: Math.round((regions.restOfWorldStripe / totalReg) * 100),
        },
        byTier: {
          weekly:  { count: tierCounts.weekly,  pct: Math.round((tierCounts.weekly  / totalTiers) * 100) },
          monthly: { count: tierCounts.monthly, pct: Math.round((tierCounts.monthly / totalTiers) * 100) },
          annual:  { count: tierCounts.annual,  pct: Math.round((tierCounts.annual  / totalTiers) * 100) },
        },
        totalActiveCount: allActiveSubs.length,
        trend: {
          current:  currentTrend,
          previous: previousTrend,
        }
      }
    });

  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Internal error" });
  }
});


// Get dashboard statistics
// router.get('/dashboard/stats', async (req, res) => {
//   try {
//     const today = new Date();
//     const startOfToday = startOfDay(today);
//     const endOfToday = endOfDay(today);

//     // Today's registrations
//     const todayRegistrations = await BookingModel.countDocuments({
//       createdAt: { $gte: startOfToday, $lte: endOfToday },
//       status: { $ne: 'cancelled' }
//     });

//     // Total registrations
//     const totalRegistrations = await BookingModel.countDocuments({
//       status: { $ne: 'cancelled' }
//     });

//     // Gender distribution
//     const genderStats = await UserModel.aggregate([
//       {
//         $group: {
//           _id: '$gender',
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     // Age distribution
//     const ageStats = await UserModel.aggregate([
//       {
//         $group: {
//           _id: '$ageRange',
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     // Upcoming events
//     const upcomingEvents = await EventModel.find({
//       date: { $gte: today },
//       isActive: true
//     }).sort({ date: 1 }).limit(5);

//     // Recent bookings
//     const recentBookings = await BookingModel.find()
//       .populate('userId', 'name email')
//       .populate('eventId', 'date time')
//       .sort({ createdAt: -1 })
//       .limit(10);

//     res.json({
//       success: true,
//       message: 'Dashboard stats retrieved successfully',
//       data: {
//         todayRegistrations,
//         totalRegistrations,
//         genderStats,
//         ageStats,
//         upcomingEvents,
//         recentBookings
//       }
//     });
//   } catch (error: any) {
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch dashboard stats',
//       error: error.message
//     });
//   }
// });

// Get dashboard overview statistics
router.get("/dashboard/overview", async (req, res) => {
  try {
    const today = new Date();
    const yesterday = subDays(today, 1);
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);
    const startOfYesterday = startOfDay(yesterday);
    const endOfYesterday = endOfDay(yesterday);

    // Today's registrations (bookings created today)
    const todayRegistrations = await BookingModel.countDocuments({
      createdAt: { $gte: startOfToday, $lte: endOfToday },
      status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
    });

    // Yesterday's registrations for comparison
    const yesterdayRegistrations = await BookingModel.countDocuments({
      createdAt: { $gte: startOfYesterday, $lte: endOfYesterday },
      status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
    });

    // Calculate trend
    const trendPercentage =
      yesterdayRegistrations > 0
        ? Math.round(
            ((todayRegistrations - yesterdayRegistrations) /
              yesterdayRegistrations) *
              100
          )
        : 0;

    // Total confirmed bookings
    const totalConfirmed = await BookingModel.countDocuments({
      status: "confirmed",
    });

    // Total checked in
    const checkedIn = await BookingModel.countDocuments({
      status: "checked-in",
    });

    // Upcoming events count
    const upcomingEventsCount = await EventModel.countDocuments({
      date: { $gte: today },
      isActive: true,
    });

    res.json({
      success: true,
      message: "Dashboard overview retrieved successfully",
      data: {
        todayRegistrations,
        totalConfirmed,
        checkedIn,
        upcomingEventsCount,
        trend:
          trendPercentage >= 0
            ? `+${trendPercentage}% vs yesterday`
            : `${trendPercentage}% vs yesterday`,
      },
    });
  } catch (error: any) {
    console.error("Dashboard overview error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard overview",
      error: error.message,
    });
  }
});

// Get today's registrations with demographic data
router.get("/dashboard/todays-registrations", async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);

    // Get today's bookings with user data
    const todayBookings = await BookingModel.find({
      createdAt: { $gte: startOfToday, $lte: endOfToday },
      status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
    }).populate("user", "name email gender ageRange");

    res.json({
      success: true,
      message: "Today's registrations retrieved successfully",
      data: todayBookings,
    });
  } catch (error: any) {
    console.error("Today's registrations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch today's registrations",
      error: error.message,
    });
  }
});

// Get gender distribution for today's registrations
router.get("/dashboard/gender-stats", async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);

    // Get user IDs from today's bookings
    const todayBookings = await BookingModel.find({
      createdAt: { $gte: startOfToday, $lte: endOfToday },
      status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
    }).select("user");

    const userIds = todayBookings.map((booking) => booking.user);

    // Get gender distribution
    const genderStats = await UserModel.aggregate([
      {
        $match: { _id: { $in: userIds } },
      },
      {
        $group: {
          _id: "$gender",
          count: { $sum: 1 },
        },
      },
    ]);

    // Format the data
    const formattedStats = genderStats.map((stat) => ({
      gender: stat._id.charAt(0).toUpperCase() + stat._id.slice(1),
      count: stat.count,
    }));

    res.json({
      success: true,
      message: "Gender statistics retrieved successfully",
      data: formattedStats,
    });
  } catch (error: any) {
    console.error("Gender stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch gender statistics",
      error: error.message,
    });
  }
});

// Get age distribution for today's registrations
router.get("/dashboard/age-stats", async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);

    // Get user IDs from today's bookings
    const todayBookings = await BookingModel.find({
      createdAt: { $gte: startOfToday, $lte: endOfToday },
      status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
    }).select("user");

    const userIds = todayBookings.map((booking) => booking.user);

    // Get age distribution
    const ageStats = await UserModel.aggregate([
      {
        $match: { _id: { $in: userIds } },
      },
      {
        $group: {
          _id: "$ageRange",
          count: { $sum: 1 },
        },
      },
    ]);

    // Format the data
    const formattedStats = ageStats.map((stat) => ({
      ageGroup: stat._id,
      count: stat.count,
    }));

    res.json({
      success: true,
      message: "Age statistics retrieved successfully",
      data: formattedStats,
    });
  } catch (error: any) {
    console.error("Age stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch age statistics",
      error: error.message,
    });
  }
});

// Get upcoming events with booking details
router.get("/dashboard/upcoming-events", async (req, res) => {
  try {
    const today = new Date();

    // Get upcoming events
    const upcomingEvents = await EventModel.find({
      date: { $gte: today },
      isActive: true,
    })
      .sort({ date: 1 })
      .limit(4);

    // Get booking counts for each event
    const eventsWithBookings = await Promise.all(
      upcomingEvents.map(async (event) => {
        const bookingCount = await BookingModel.countDocuments({
          event: event._id,
          status: { $ne: BookingStatus.Cancelled },
        });

        return {
          id: event._id,
          date: event.date,
          time: event.time,
          total_seats: event.totalSeats,
          bookedSeats: bookingCount,
          availableSeats: event.totalSeats - bookingCount,
        };
      })
    );

    res.json({
      success: true,
      message: "Upcoming events retrieved successfully",
      data: eventsWithBookings,
    });
  } catch (error: any) {
    console.error("Upcoming events error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming events",
      error: error.message,
    });
  }
});

// Get all dashboard data in one request (optional - for better performance)
router.get("/dashboard/all", async (req, res) => {
  try {
    const { startDate, endDate, hallId } = req.query;

    let rangeStart: Date;
    let rangeEnd: Date;
    let comparisonStart: Date;
    let comparisonEnd: Date;
    let isCustomRange = false;

    if (startDate && endDate) {
      rangeStart = startOfDay(new Date(startDate as string));
      rangeEnd = endOfDay(new Date(endDate as string));
      isCustomRange = true;

      // Calculate duration in days for the comparison period
      const duration = differenceInCalendarDays(rangeEnd, rangeStart) + 1;
      comparisonStart = startOfDay(subDays(rangeStart, duration));
      comparisonEnd = endOfDay(subDays(rangeEnd, duration));
    } else {
      const today = new Date();
      const yesterday = subDays(today, 1);
      rangeStart = startOfDay(today);
      rangeEnd = endOfDay(today);
      comparisonStart = startOfDay(yesterday);
      comparisonEnd = endOfDay(yesterday);
    }

    const today = new Date(); // still needed for upcoming events reference

    const periodQuery: any = {
      createdAt: { $gte: rangeStart, $lte: rangeEnd },
      status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
    };
    const previousPeriodQuery: any = {
      createdAt: { $gte: comparisonStart, $lte: comparisonEnd },
      status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
    };
    const confirmedQuery: any = { status: "confirmed" };
    const checkedInQuery: any = { status: "checked-in" };
    const eventQuery: any = { date: { $gte: today }, isActive: true };

    if (hallId && hallId !== "all") {
      const hallObjId = new mongoose.Types.ObjectId(hallId as string);
      periodQuery.hall = hallObjId;
      previousPeriodQuery.hall = hallObjId;
      confirmedQuery.hall = hallObjId;
      checkedInQuery.hall = hallObjId;
      eventQuery.hall = hallObjId;
    }

    // Get all data in parallel
    const [
      periodRegistrations,
      previousPeriodRegistrations,
      totalConfirmed,
      checkedIn,
      upcomingEvents,
      periodBookings,
    ] = await Promise.all([
      BookingModel.countDocuments(periodQuery),
      BookingModel.countDocuments(previousPeriodQuery),
      BookingModel.countDocuments(confirmedQuery),
      BookingModel.countDocuments(checkedInQuery),
      EventModel.find(eventQuery)
        .sort({ date: 1 })
        .limit(4),
      BookingModel.find(periodQuery).populate("user", "name email gender ageRange"),
    ]);

    // Calculate trend
    const trendPercentage =
      previousPeriodRegistrations > 0
        ? Math.round(
            ((periodRegistrations - previousPeriodRegistrations) /
              previousPeriodRegistrations) *
              100
          )
        : 0;

    // Get user IDs from period's bookings
    const userIds = periodBookings
      .map((booking) => {
        // If user is populated (User object), use its _id, otherwise use the ObjectId directly
        if (!booking.user) return null;
        return typeof booking.user === "object" && "email" in booking.user
          ? (booking.user as any)._id
          : booking.user;
      })
      .filter((id) => id !== null);

    // Get demographics and loyalty in parallel
    const [genderStats, ageStats, loyaltyData] = await Promise.all([
      UserModel.aggregate([
        { $match: { _id: { $in: userIds } } },
        { $group: { _id: "$gender", count: { $sum: 1 } } },
      ]),
      UserModel.aggregate([
        { $match: { _id: { $in: userIds } } },
        { $group: { _id: "$ageRange", count: { $sum: 1 } } },
      ]),
      // Aggregation for loyalty distribution among active users in the selected period
      BookingModel.aggregate([
        { 
          $match: { 
            user: { $in: userIds },
            status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] }
          } 
        },
        { $group: { _id: "$user", visitCount: { $sum: 1 } } },
        {
          $facet: {
            buckets: [
              {
                $bucket: {
                  groupBy: "$visitCount",
                  boundaries: [1, 2, 6, 11, 31],
                  default: "31+",
                  output: { count: { $sum: 1 } }
                }
              }
            ],
            totals: [
              { $match: { visitCount: { $gt: 1 } } },
              { $group: { _id: null, totalRepeatedVisits: { $sum: "$visitCount" }, repeatUserCount: { $sum: 1 } } }
            ]
          }
        }
      ]),
    ]);

    const loyaltyStatsRaw = loyaltyData[0];

    // Get booking counts for events
    const eventsWithBookings = await Promise.all(
      upcomingEvents.map(async (event) => {
        const bookings = await BookingModel.find({
          event: event._id,
          status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
        }).select("seatNumbers");

        const bookedSeatCount = new Set(bookings.flatMap((b) => b.seatNumbers))
          .size;

        return {
          id: event._id,
          date: event.date,
          time: event.time,
          total_seats: event.totalSeats,
          bookedSeats: bookedSeatCount,
          availableSeats: (event.totalSeats || 0) - bookedSeatCount,
          totalBookings: bookings.length,
        };
      })
    );

    // Format demographics data
    const formattedGenderStats = genderStats.map((stat) => ({
      gender: stat._id ? stat._id.charAt(0).toUpperCase() + stat._id.slice(1) : "Unknown",
      count: stat.count,
    }));

    const ageOrder = ["18-25", "26-35", "36-45", "46-55", "55+"];
    const formattedAgeStats = ageOrder.map((group) => {
      const stat = ageStats.find((s) => s._id === group);
      return {
        ageGroup: group,
        count: stat ? stat.count : 0,
      };
    });

    // Add "Unknown" at the end if there are any unmatched groups
    const otherAges = ageStats
      .filter((s) => s._id && !ageOrder.includes(s._id))
      .map((s) => ({ ageGroup: s._id as string, count: s.count }));
    
    if (otherAges.length > 0) {
      formattedAgeStats.push(...otherAges);
    }
    
    const unknownStat = ageStats.find((s) => !s._id);
    if (unknownStat) {
      formattedAgeStats.push({ ageGroup: "Unknown", count: unknownStat.count });
    }

    // Map bucket boundaries to friendly labels
    const bucketLabels: Record<string, string> = {
      "1": "New (1)",
      "2": "Returning (2-5)",
      "6": "Regular (6-10)",
      "11": "Loyal (11-30)",
      "31+": "VIP (>30)"
    };

    const formattedLoyaltyStats = [1, 2, 6, 11, "31+"].map((boundary) => {
      const bucket = loyaltyStatsRaw.buckets.find((b: any) => b._id === boundary);
      return {
        category: bucketLabels[boundary.toString()],
        count: bucket ? bucket.count : 0
      };
    });

    const repeatMetrics = loyaltyStatsRaw.totals[0] || { totalRepeatedVisits: 0, repeatUserCount: 0 };

    const comparisonText = isCustomRange ? "vs previous period" : "vs yesterday";

    res.json({
      success: true,
      message: "All dashboard data retrieved successfully",
      data: {
        overview: {
          todayRegistrations: periodRegistrations, // Keeping key for compatibility
          totalConfirmed,
          checkedIn,
          upcomingEventsCount: upcomingEvents.length,
          trend:
            trendPercentage >= 0
              ? `+${trendPercentage}% ${comparisonText}`
              : `${trendPercentage}% ${comparisonText}`,
        },
        genderStats: formattedGenderStats,
        ageStats: formattedAgeStats,
        loyaltyStats: formattedLoyaltyStats,
        repeatMetrics,
        upcomingEvents: eventsWithBookings,
        todayRegistrations: periodBookings, // Keeping key for compatibility
      },
    });
  } catch (error: any) {
    console.error("Dashboard all data error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
      error: error.message,
    });
  }
});

// Get the next event
router.get("/next-event", async (req, res) => {
  try {
    const event = await EventModel.findOne({ isActive: true, date: { $gte: new Date() } })
      .sort({ date: 1 })
      .lean();

    if (!event) {
      res.status(200).json({
        success: true,
        message: "No active events found",
        data: null,
      });
      return;
    }

    res.json({
      success: true,
      message: "Next event retrieved successfully",
      data: event,
    });
  } catch (error: any) {
    console.error("Next event error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch next event",
      error: error.message,
    });
  }
});

/**
 * REGISTRATION MANAGEMENT ENDPOINTS
 */

// Get all registrations with filtering options
router.get("/registrations", async (req, res) => {
  try {
    const {
      search,
      gender,
      ageGroup,
      eventDate,
      status,
      hallId,
      page = 1,
      limit = 50,
      sortBy = "createdAt",
      sortOrder = "desc",
      expandSeats,
    } = req.query;

    // Build match query
    let matchQuery: any = {};

    // Status filter (exclude cancelled by default unless specifically requested)
    if (status && status !== "all") {
      matchQuery.status = status;
    } else {
      matchQuery.status = {
        $nin: [BookingStatus.Cancelled, BookingStatus.Voided],
      };
    }

    // Event date filter
    if (eventDate && eventDate !== "all") {
      const date = new Date(eventDate as string);
      const startOfEventDate = startOfDay(date);
      const endOfEventDate = endOfDay(date);
      matchQuery.eventDate = { $gte: startOfEventDate, $lte: endOfEventDate };
    }

    // Hall filter
    if (hallId && hallId !== "all") {
      matchQuery.hall = new mongoose.Types.ObjectId(hallId as string);
    }

    // Build aggregation pipeline
    const pipeline: any[] = [
      { $match: matchQuery },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventInfo",
        },
      },
      {
        $lookup: {
          from: "halls",
          localField: "hall",
          foreignField: "_id",
          as: "hall",
        },
      },
      { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$eventInfo", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$hall", preserveNullAndEmptyArrays: true } },
    ];

    // Add user-based filters
    let userMatchConditions: any = {};

    // Gender filter
    if (gender && gender !== "all") {
      userMatchConditions["userInfo.gender"] = (gender as string).toLowerCase();
    }

    // Age group filter
    if (ageGroup && ageGroup !== "all") {
      userMatchConditions["userInfo.ageRange"] = ageGroup;
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      userMatchConditions.$or = [
        { "userInfo.name": searchRegex },
        { "userInfo.email": searchRegex },
        { "userInfo.phone": searchRegex },
        { ticketId: searchRegex },
      ];
    }

    // Add user match conditions if any
    if (Object.keys(userMatchConditions).length > 0) {
      pipeline.push({ $match: userMatchConditions });
    }

    if (expandSeats === "true") {
      pipeline.push({
        $unwind: {
          path: "$seatNumbers",
          includeArrayIndex: "seatIndex",
          preserveNullAndEmptyArrays: true
        }
      });
      pipeline.push({
        $addFields: {
          singleSeatLabel: {
            $arrayElemAt: ["$seatLabels", "$seatIndex"]
          }
        }
      });
    }

    // Add projection to format the response
    pipeline.push({
      $project: {
        id: "$_id",
        ticket_id: "$ticketId",
        userId: "$userInfo._id",
        full_name: { $ifNull: ["$userInfo.name", "Unknown User"] },
        email: { $ifNull: ["$userInfo.email", "N/A"] },
        phone: { $ifNull: ["$userInfo.phone", "N/A"] },
        age: {
          $switch: {
            branches: [
              { case: { $eq: ["$userInfo.ageRange", "18-25"] }, then: 22 },
              { case: { $eq: ["$userInfo.ageRange", "26-35"] }, then: 30 },
              { case: { $eq: ["$userInfo.ageRange", "36-45"] }, then: 40 },
              { case: { $eq: ["$userInfo.ageRange", "46-55"] }, then: 50 },
              { case: { $eq: ["$userInfo.ageRange", "55+"] }, then: 60 },
            ],
            default: 25,
          },
        },
        ageRange: { $ifNull: ["$userInfo.ageRange", "N/A"] },
        gender: {
          $cond: {
            if: { $and: [{ $ne: ["$userInfo.gender", null] }, { $ne: ["$userInfo.gender", ""] }] },
            then: {
              $concat: [
                { $toUpper: { $substr: ["$userInfo.gender", 0, 1] } },
                { $substr: ["$userInfo.gender", 1, -1] },
              ],
            },
            else: "N/A"
          }
        },
        seat_number: expandSeats === "true" 
          ? "$seatNumbers"
          : {
              $cond: {
                if: { $gt: [{ $size: { $ifNull: ["$seatNumbers", []] } }, 0] },
                then: { $arrayElemAt: ["$seatNumbers", 0] },
                else: null,
              },
            },
        seat_labels: expandSeats === "true"
          ? {
              $cond: {
                if: { $ne: ["$singleSeatLabel", null] },
                then: ["$singleSeatLabel"],
                else: []
              }
            }
          : "$seatLabels",
        event_date: "$eventDate",
        status: "$status",
        created_date: "$createdAt",
        qrCode: "$qrCode",
        eventInfo: {
          time: "$eventInfo.time",
          totalSeats: "$eventInfo.totalSeats",
        },
        hall: {
          _id: "$hall._id",
          name: "$hall.name"
        }
      },
    });

    // Add sorting
    const sortDirection = sortOrder === "desc" ? -1 : 1;
    const sortField =
      sortBy === "name"
        ? "full_name"
        : sortBy === "email"
        ? "email"
        : sortBy === "event_date"
        ? "event_date"
        : "created_date";
    pipeline.push({ $sort: { [sortField]: sortDirection } });

    // Get total count for pagination
    const totalPipeline = [...pipeline, { $count: "total" }];
    const totalResult = await BookingModel.aggregate(totalPipeline);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    // Add pagination
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit as string) });

    // Execute query
    const registrations = await BookingModel.aggregate(pipeline);

    res.json({
      success: true,
      message: "Registrations retrieved successfully",
      data: {
        registrations,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string)),
        },
      },
    });
  } catch (error: any) {
    console.error("Get registrations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch registrations",
      error: error.message,
    });
  }
});

// Get available event dates for filter dropdown
router.get("/registrations/event-dates", async (req, res) => {
  try {
    const eventDates = await BookingModel.distinct("eventDate", {
      status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
    });

    const sortedDates = eventDates
      .map((date) => new Date(date))
      .sort((a, b) => a.getTime() - b.getTime())
      .map((date) => date.toISOString());

    res.json({
      success: true,
      message: "Event dates retrieved successfully",
      data: sortedDates,
    });
  } catch (error: any) {
    console.error("Get event dates error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch event dates",
      error: error.message,
    });
  }
});

// Get registration statistics
router.get("/registrations/stats", async (req, res) => {
  try {
    const { hallId } = req.query;

    const baseMatch: any = {
      status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
    };

    if (hallId && hallId !== "all") {
      baseMatch.hall = new mongoose.Types.ObjectId(hallId as string);
    }

    const [totalCount, statusStats, genderStats, ageStats, hallStats] = await Promise.all([
      // Total registrations (excluding cancelled)
      BookingModel.countDocuments(baseMatch),

      // Status distribution
      BookingModel.aggregate([
        {
          $match: baseMatch,
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Gender distribution
      BookingModel.aggregate([
        {
          $match: baseMatch,
        },
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: "$userInfo" },
        {
          $group: {
            _id: "$userInfo.gender",
            count: { $sum: 1 },
          },
        },
      ]),

      // Age group distribution
      BookingModel.aggregate([
        {
          $match: baseMatch,
        },
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: "$userInfo" },
        {
          $group: {
            _id: "$userInfo.ageRange",
            count: { $sum: 1 },
          },
        },
      ]),

      // Hall distribution (unfiltered by hallId so we always see all halls)
      BookingModel.aggregate([
        {
          $match: {
            status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
          },
        },
        {
          $lookup: {
            from: "halls",
            localField: "hall",
            foreignField: "_id",
            as: "hallInfo",
          },
        },
        { $unwind: { path: "$hallInfo", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { id: "$hallInfo._id", name: "$hallInfo.name" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      message: "Registration statistics retrieved successfully",
      data: {
        totalCount,
        statusStats: statusStats.map((s) => ({
          status: s._id,
          count: s.count,
        })),
        genderStats: genderStats.map((g) => ({
          gender: g._id ? g._id.charAt(0).toUpperCase() + g._id.slice(1) : 'Unknown',
          count: g.count,
        })),
        ageStats: ageStats.map((a) => ({ ageGroup: a._id || 'Unknown', count: a.count })),
        hallStats: hallStats.map((h) => ({
          hallId: h._id.id || null,
          hallName: h._id.name || 'Unassigned',
          count: h.count
        }))
      },
    });
  } catch (error: any) {
    console.error("Get registration stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch registration statistics",
      error: error.message,
    });
  }
});

// Assign seat to registration
router.patch("/registrations/:id/assign-seat", async (req, res) => {
  try {
    const { id } = req.params;
    const { seatNumber, seatLabel } = req.body;

    if (!seatNumber) {
      res.status(400).json({
        success: false,
        message: "Seat number is required",
      });
      return;
    }

    // Check if registration exists
    const registration = await BookingModel.findById(id);
    if (!registration) {
      res.status(404).json({
        success: false,
        message: "Registration not found",
      });
      return;
    }

    // Check if seat is already taken for this event
    const existingSeatBooking = await BookingModel.findOne({
      event: registration.event,
      seatNumbers: seatNumber,
      status: { $nin: ["cancelled", "voided"] },
      _id: { $ne: id },
    });

    if (existingSeatBooking) {
      res.status(400).json({
        success: false,
        message: `Seat ${seatNumber} is already assigned to another registration`,
      });
      return;
    }

    // Update registration with seat assignment
    const updatedRegistration = await BookingModel.findByIdAndUpdate(
      id,
      {
        seatNumbers: [seatNumber],
        seatLabels: [seatLabel || `Seat ${seatNumber}`],
      },
      { new: true }
    );

    res.json({
      success: true,
      message: `Seat ${seatNumber} assigned successfully`,
      data: updatedRegistration,
    });
  } catch (error: any) {
    console.error("Assign seat error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign seat",
      error: error.message,
    });
  }
});

// Void registration
router.patch("/registrations/:id/void", async (req, res) => {
  try {
    const { id } = req.params;

    const registration = await BookingModel.findById(id);
    if (!registration) {
      res.status(404).json({
        success: false,
        message: "Registration not found",
      });
      return;
    }

    if (registration.status === BookingStatus.Voided) {
      res.status(400).json({
        success: false,
        message: "Registration is already voided",
      });
      return;
    }

    // Update registration status to voided
    const updatedRegistration = await BookingModel.findByIdAndUpdate(
      id,
      { status: "voided" },
      { new: true }
    );

    // Update event available seats (add back the seats)
    await EventModel.findByIdAndUpdate(registration.event, {
      $inc: { availableSeats: registration.seatNumbers.length },
    });

    res.json({
      success: true,
      message: "Registration voided successfully",
      data: updatedRegistration,
    });
  } catch (error: any) {
    console.error("Void registration error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to void registration",
      error: error.message,
    });
  }
});

// Check-in registration
router.patch("/registrations/:id/checkin", async (req, res) => {
  try {
    const { id } = req.params;

    const registration = await BookingModel.findById(id);
    if (!registration) {
      res.status(404).json({
        success: false,
        message: "Registration not found",
      });
      return;
    }

    if (registration.status !== BookingStatus.Attending) {
      res.status(400).json({
        success: false,
        message:
          "Registration is not attending. Status: " + registration.status,
      });
      return;
    }

    // check the time too if it's in the past
    const eventDate = new Date(registration.eventDate);
    const now = new Date();

    // Prevent check-in before event start
    if (isBefore(now, eventDate)) {
      res.status(400).json({
        success: false,
        message: "Cannot check-in before event start",
      });
      return;
    }

    // Prevent check-in if event is over (e.g., more than 1 day after event)
    const eventEnd = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000); // assuming event lasts 1 day
    if (isAfter(now, eventEnd)) {
      res.status(400).json({
        success: false,
        message: "Event is over, cannot check-in",
      });
      return;
    }

    const updatedRegistration = await BookingModel.findByIdAndUpdate(
      id,
      { status: BookingStatus.Attended, attendedAt: new Date() },
      { new: true }
    );

    res.json({
      success: true,
      message: "Registration checked-in successfully",
      data: updatedRegistration,
    });
  } catch (error: any) {
    console.error("Check-in registration error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check-in registration",
      error: error.message,
    });
  }
});

// Bulk operations on registrations
router.post("/registrations/bulk-action", async (req, res) => {
  try {
    const { action, registrationIds } = req.body;

    if (!action || !registrationIds || !Array.isArray(registrationIds)) {
      res.status(400).json({
        success: false,
        message: "Action and registration IDs are required",
      });
      return;
    }

    let modifiedCount = 0;
    
    for (const id of registrationIds) {
      const registration = await BookingModel.findById(id);
      if (!registration) continue;
      
      const isVoidOrCancelled = registration.status === BookingStatus.Voided || registration.status === BookingStatus.Cancelled;
      const seatCount = registration.seatNumbers ? registration.seatNumbers.length : 0;
      
      if (action === "void" && !isVoidOrCancelled) {
         await BookingModel.findByIdAndUpdate(id, { status: BookingStatus.Voided });
         if (seatCount > 0) {
            await EventModel.findByIdAndUpdate(registration.event, {
              $inc: { availableSeats: seatCount },
            });
         }
         modifiedCount++;
      } else if (action === "delete") {
         if (!isVoidOrCancelled && seatCount > 0) {
            await EventModel.findByIdAndUpdate(registration.event, {
              $inc: { availableSeats: seatCount },
            });
         }
         await BookingModel.findByIdAndDelete(id);
         modifiedCount++;
      } else if (action === "confirm" && registration.status !== BookingStatus.Attending) {
         await BookingModel.findByIdAndUpdate(id, { status: BookingStatus.Attending });
         modifiedCount++;
      } else if (action === "checkin" && registration.status !== BookingStatus.Attended) {
         await BookingModel.findByIdAndUpdate(id, { status: BookingStatus.Attended, attendedAt: new Date() });
         modifiedCount++;
      }
    }

    res.json({
      success: true,
      message: `${modifiedCount} registrations processed successfully`,
      data: {
        modifiedCount,
        matchedCount: registrationIds.length,
      },
    });
  } catch (error: any) {
    console.error("Bulk action error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform bulk action",
      error: error.message,
    });
  }
});

// Bulk delete by date range
router.post("/registrations/bulk-delete-by-date", async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    return;
    if (!startDate || !endDate) {
      res.status(400).json({ success: false, message: "Start date and end date are required" });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const bookings = await BookingModel.find({
      eventDate: { $gte: start, $lte: end }
    });

    // Calculate how many seats to restore per event
    const eventCapacityIncrements: Record<string, number> = {};

    for (const registration of bookings) {
      const isVoidOrCancelled = registration.status === BookingStatus.Voided || registration.status === BookingStatus.Cancelled;
      const seatCount = registration.seatNumbers ? registration.seatNumbers.length : 0;
      
      if (!isVoidOrCancelled && seatCount > 0) {
        const eventId = registration.event.toString();
        if (!eventCapacityIncrements[eventId]) {
          eventCapacityIncrements[eventId] = 0;
        }
        eventCapacityIncrements[eventId] += seatCount;
      }
    }

    // Bulk update event capacities concurrently
    const updatePromises = Object.keys(eventCapacityIncrements).map(eventId => {
      return EventModel.findByIdAndUpdate(eventId, {
        $inc: { availableSeats: eventCapacityIncrements[eventId] }
      });
    });
    await Promise.all(updatePromises);

    // Perform a single bulk delete operation for all matching bookings
    const result = await BookingModel.deleteMany({
      eventDate: { $gte: start, $lte: end }
    });

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} bookings within the specified date range`,
      data: { modifiedCount: result.deletedCount }
    });
  } catch (error: any) {
    console.error("Bulk delete by date error:", error);
    res.status(500).json({ success: false, message: "Failed to delete bookings", error: error.message });
  }
});

// Delete single registration
router.delete("/registrations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const registration = await BookingModel.findById(id);
    if (!registration) {
      res.status(404).json({ success: false, message: "Registration not found" });
      return;
    }
    
    const isVoidOrCancelled = registration.status === BookingStatus.Voided || registration.status === BookingStatus.Cancelled;
    const seatCount = registration.seatNumbers ? registration.seatNumbers.length : 0;
    
    if (!isVoidOrCancelled && seatCount > 0) {
      await EventModel.findByIdAndUpdate(registration.event, {
        $inc: { availableSeats: seatCount },
      });
    }
    
    await BookingModel.findByIdAndDelete(id);
    res.json({ success: true, message: "Registration deleted successfully" });
  } catch (error: any) {
    console.error("Delete registration error:", error);
    res.status(500).json({ success: false, message: "Failed to delete registration", error: error.message });
  }
});

router.get(
  "/bookings",
  validateRequest(getAllBookingsSchema),
  async (req, res) => {
    try {
      const { page = "1", limit = "10", search = "", status, hallId } = req.query;

      const result = await bookingService.getAllBookings({
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        search: search as string,
        status: status as BookingStatus,
        hallId: hallId as string,
      });

      res.status(200).json(result);
    } catch (error: any) {
      const response: ApiResponse<null> = {
        success: false,
        message: "Internal server error",
        error: error.message,
      };
      res.status(500).json(response);
    }
  }
);

// Get booking by ticket ID
router.get(
  "/bookings/:ticketId",
  validateRequest(ticketIdParamsSchema, "params"),
  async (req, res) => {
    try {
      const result = await bookingService.getBookingByTicketId(
        req.params.ticketId
      );
      const statusCode = result.success ? 200 : 404;
      res.status(statusCode).json(result);
    } catch (error: any) {
      const response: ApiResponse<null> = {
        success: false,
        message: "Internal server error",
        error: error.message,
      };
      res.status(500).json(response);
    }
  }
);

// Cancel/Void booking
router.patch(
  "/bookings/:ticketId/cancel",
  validateRequest(ticketIdParamsSchema, "params"),
  async (req, res) => {
    try {
      const result = await bookingService.adminCancelBooking(
        req.params.ticketId
      );

      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json(result);
    } catch (error: any) {
      const response: ApiResponse<null> = {
        success: false,
        message: "Internal server error",
        error: error.message,
      };
      res.status(500).json(response);
    }
  }
);

// Verify booking (for QR code scanning)
router.get(
  "/bookings/:ticketId/verify",
  validateRequest(ticketIdParamsSchema, "params"),
  async (req, res) => {
    try {
      const result = await bookingService.verifyBooking(req.params.ticketId);
      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json(result);
    } catch (error: any) {
      const response: ApiResponse<null> = {
        success: false,
        message: "Internal server error",
        error: error.message,
      };
      res.status(500).json(response);
    }
  }
);

// Get upcoming events with pagination
router.get(
  "/events/upcoming",
  validateRequest(getAllBookingsSchema),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        includeFullyBooked,
        startDate,
        endDate,
      } = req.query;

      const result = await bookingService.getUpcomingEvents({
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        includeFullyBooked: includeFullyBooked as unknown as boolean,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      res.status(200).json(result);
    } catch (error: any) {
      const response: ApiResponse<null> = {
        success: false,
        message: "Internal server error",
        error: error.message,
      };
      res.status(500).json(response);
    }
  }
);

// Get upcoming events summary (without pagination) - useful for dashboards
router.get("/events/summary", async (req, res) => {
  try {
    const result = await bookingService.getUpcomingEventsSummary();
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch events summary",
      error: error.message,
    });
  }
});

// Resend booking confirmation email
router.post(
  "/bookings/:ticketId/resend-confirmation",
  validateRequest(ticketIdParamsSchema, "params"),
  async (req, res) => {
    try {
      const result = await bookingService.resendBookingConfirmation(
        req.params.ticketId
      );
      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json(result);
    } catch (error: any) {
      const response: ApiResponse<null> = {
        success: false,
        message: "Internal server error",
        error: error.message,
      };
      res.status(500).json(response);
    }
  }
);

/**
 * SETTINGS ROUTES
 */

// Update system settings
router.put("/settings", async (req, res) => {
  try {
    // ✅ Validate request body
    // const validatedData = updateSystemSettingsSchema.parse(req.body);
    const validatedData = req.body;

    const result = await settingsService.updateSettings({
      ...validatedData,
      // Convert strings → Date if your service expects Date
      reservationOpenDate: new Date(validatedData.reservationOpenDate),
      reservationCloseDate: new Date(validatedData.reservationCloseDate),
      blockedDates: validatedData.blockedDates?.map((d: any) => new Date(d)),
      seatCapacityOverrides: Array.isArray(validatedData.seatCapacityOverrides)
        ? validatedData.seatCapacityOverrides.map(
            (o: { date: string; totalSeats: number }) => ({
              date: new Date(o.date),
              totalSeats: o.totalSeats,
            })
          )
        : validatedData.seatCapacityOverrides,
    });

    res.status(200).json(result);
  } catch (error: any) {
    // Zod validation error
    if (error.name === "ZodError") {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update settings",
      error: error.message,
    });
  }
});

// Get system settings
router.get("/settings", async (req, res) => {
  try {
    const result = await settingsService.getSettings();

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
      error: error.message,
    });
  }
});

/**
 * NOTIFICATION ROUTES
 */

// Send bulk notifications
router.post("/notifications/send", async (req, res) => {
  try {
    const {
      message,
      type = "email",
      subject,
      filters = {},
      sendImmediately = false,
    } = req.body;

    // Validate required fields
    if (!message) {
      res.status(400).json({
        success: false,
        message: "Message is required",
      });
      return;
    }

    if (!["email", "sms", "both"].includes(type)) {
      res.status(400).json({
        success: false,
        message: "Type must be email, sms, or both",
      });
      return;
    }

    const notificationService = new NotificationService();

    // Get filtered users
    const recipients = await notificationService.getFilteredUsers(filters);

    if (recipients.length === 0) {
      res.status(404).json({
        success: false,
        message: "No users found matching the specified criteria",
      });
      return;
    }

    if (sendImmediately) {
      // Send immediately in background
      setImmediate(async () => {
        try {
          const result = await notificationService.sendBatchNotifications(
            recipients,
            type,
            message,
            subject
          );
          console.log(
            `Notification sent: ${result.sent} successful, ${result.failed} failed`
          );
        } catch (error) {
          console.error("Background notification error:", error);
        }
      });

      res.json({
        success: true,
        message: `Notification queued for ${recipients.length} recipients`,
        data: {
          totalRecipients: recipients.length,
          status: "queued",
        },
      });
    } else {
      // Send immediately and wait for result
      const result = await notificationService.sendBatchNotifications(
        recipients,
        type,
        message,
        subject
      );

      res.json({
        success: true,
        message: "Notifications sent successfully",
        data: {
          totalRecipients: recipients.length,
          sent: result.sent,
          failed: result.failed,
          errors: result.errors.length > 0 ? result.errors : undefined,
        },
      });
    }
  } catch (error: any) {
    console.error("Notification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send notifications",
      error: error.message,
    });
  }
});

// Preview notification recipients
router.post("/notifications/preview", async (req, res) => {
  try {
    const { filters = {} } = req.body;

    const notificationService = new NotificationService();
    const recipients = await notificationService.getFilteredUsers(filters);

    res.json({
      success: true,
      message: "Recipients preview generated successfully",
      data: {
        totalRecipients: recipients.length,
        recipients: recipients.slice(0, 10), // Show first 10 for preview
        hasMore: recipients.length > 10,
      },
    });
  } catch (error: any) {
    console.error("Preview error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate preview",
      error: error.message,
    });
  }
});

/**
 * EVENT ROUTES
 */

// Get all events
router.get("/events", async (req, res) => {
  try {
    const { page = 1, limit = 10, status, timeframe = 'upcoming' } = req.query;
    const result = await eventService.getEvents({
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      status: status as string,
      timeframe: timeframe as string
    });
    res.status(200).json(result);
  } catch (error: any) {
    const response: ApiResponse<null> = {
      success: false,
      message: "Internal server error",
      error: error.message,
    };
    res.status(500).json(response);
  }
});

// Get event by ID
router.get("/events/:eventId", async (req, res) => {
  try {
    const result = await eventService.getEvent(req.params.eventId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    const response: ApiResponse<null> = {
      success: false,
      message: "Internal server error",
      error: error.message,
    };
    res.status(500).json(response);
  }
});

// Create event manually
router.post("/events", async (req, res) => {
  try {
    const { date, time, totalSeats } = req.body;
    const result = await eventService.createEvent({ date, time, totalSeats });
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    const response: ApiResponse<null> = {
      success: false,
      message: "Internal server error",
      error: error.message,
    };
    res.status(500).json(response);
  }
});

// Update event
router.put("/events/:eventId", async (req, res) => {
  try {
    const { time, totalSeats, isActive } = req.body;

    const result = await eventService.updateEvent({
      eventId: req.params.eventId,
      time,
      totalSeats,
      isActive,
    });
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    const response: ApiResponse<null> = {
      success: false,
      message: "Internal server error",
      error: error.message,
    };
    res.status(500).json(response);
  }
});

// Delete event
router.delete("/events/:eventId", async (req, res) => {
  try {
    const result = await eventService.deleteEvent(req.params.eventId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    const response: ApiResponse<null> = {
      success: false,
      message: "Internal server error",
      error: error.message,
    };
    res.status(500).json(response);
  }
});

// ==========================================
// USER MANAGEMENT ENDPOINTS
// ==========================================

// Get all users (paginated and filtered)
router.get("/users", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = (req.query.search as string) || "";
    
    const skip = (page - 1) * limit;

    // Build the match stage
    const matchStage: any = {};
    if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const totalResult = await UserModel.aggregate([
      { $match: matchStage },
      { $count: 'total' }
    ]);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;
    const totalPages = Math.ceil(total / limit);

    const users = await UserModel.aggregate([
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'user',
          as: 'bookings'
        }
      },
      {
        $addFields: {
          bookingCount: { $size: '$bookings' },
          id: { $toString: '$_id' }
        }
      },
      {
        $project: {
          bookings: 0,
          password: 0,
          verificationOtp: 0,
          resetPasswordToken: 0
        }
      }
    ]);

    res.json({
      success: true,
      message: "Users retrieved successfully",
      data: {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      }
    });
  } catch (error: any) {
    console.error("Get users error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users", error: error.message });
  }
});

// Delete user and cascade their bookings
router.delete("/users/:id", async (req, res) => {
  console.log("DELETE /users/:id HIT with ID:", req.params.id);
  try {
    const { id } = req.params;
    
    // Check if user exists
    const user = await UserModel.findById(id);
    if (!user) {
      console.log("User not found in DB for ID:", id);
      res.status(400).json({ success: false, message: "User not found in database. Please refresh the page." });
      return;
    }

    // Find all bookings for this user to restore seats
    const userBookings = await BookingModel.find({ user: id });
    
    // Calculate how many seats to restore per event
    const eventCapacityIncrements: Record<string, number> = {};

    for (const registration of userBookings) {
      const isVoidOrCancelled = registration.status === BookingStatus.Voided || registration.status === BookingStatus.Cancelled;
      const seatCount = registration.seatNumbers ? registration.seatNumbers.length : 0;
      
      if (!isVoidOrCancelled && seatCount > 0) {
        const eventId = registration.event.toString();
        if (!eventCapacityIncrements[eventId]) {
          eventCapacityIncrements[eventId] = 0;
        }
        eventCapacityIncrements[eventId] += seatCount;
      }
    }

    // Bulk update event capacities concurrently
    const updatePromises = Object.keys(eventCapacityIncrements).map(eventId => {
      return EventModel.findByIdAndUpdate(eventId, {
        $inc: { availableSeats: eventCapacityIncrements[eventId] }
      });
    });
    await Promise.all(updatePromises);

    // Delete bookings
    await BookingModel.deleteMany({ user: id });
    
    // Delete subscription (if any)
    const { SubscriptionModel } = await import('../models/Subscription'); // dynamic import if missing, wait let's check if it is imported at top
    await SubscriptionModel.deleteMany({ userId: id });

    // Finally, delete the user
    await UserModel.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "User and associated data deleted successfully"
    });

  } catch (error: any) {
    console.error("Delete user error:", error);
    res.status(500).json({ success: false, message: "Failed to delete user", error: error.message });
  }
});


/**
 * @swagger
 * /admin/retroactive-billing/{hallId}:
 *   post:
 *     summary: Trigger retroactive billing for multiple day bookings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post("/retroactive-billing/:hallId", async (req, res) => {
  try {
    const { hallId } = req.params;
    
    // 1. Fetch Hall
    const hall = await mongoose.model("Hall").findById(hallId);
    if (!hall || !hall.isPaymentEnabled || !hall.isMultipleDaysBookingEnabled) {
       res.status(400).json({ success: false, message: "Hall does not support retroactive billing." });
       return;
    }

    // 2. Fetch all unpaid bookings for this hall
    const bookings = await BookingModel.find({
      hall: hallId,
      status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
      paymentStatus: { $ne: 'paid' }
    });

    // 3. Group by user
    const userBookings = new Map<string, any[]>();
    for (const booking of bookings) {
      const userId = booking.user.toString();
      if (!userBookings.has(userId)) {
        userBookings.set(userId, []);
      }
      userBookings.get(userId)!.push(booking);
    }

    let processedUsers = 0;
    const paymentService = new (require("../services/BookingPaymentService").BookingPaymentService)();

    // 4. Generate payment links for users with multiple bookings
    for (const [userId, userBookingsList] of userBookings.entries()) {
      if (userBookingsList.length > 1) { // Apply to existing users who booked multiple days
         const bookingIds = userBookingsList.map(b => b._id.toString());
         const linkResult = await paymentService.generatePaymentLink(userId, hallId, bookingIds, true, true); // sendEmail=true, isRetroactive=true

         if (linkResult.success) {
            // Set 1 week expiry for these bookings
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 7);

            await BookingModel.updateMany(
              { _id: { $in: bookingIds } },
              { $set: { paymentExpiresAt: expiryDate } }
            );
            processedUsers++;
         }
      }
    }

    res.json({
      success: true,
      message: `Retroactive billing emails sent to ${processedUsers} users.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;


