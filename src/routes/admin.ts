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
const notificationService = new NotificationService();
const bookingService = new BookingService();
const settingsService = new SettingsService();
const eventService = new EventService();

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
      status: { $ne: "cancelled" },
    });

    // Yesterday's registrations for comparison
    const yesterdayRegistrations = await BookingModel.countDocuments({
      createdAt: { $gte: startOfYesterday, $lte: endOfYesterday },
      status: { $ne: "cancelled" },
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
      status: { $ne: "cancelled" },
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
      status: { $ne: "cancelled" },
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
      status: { $ne: "cancelled" },
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
          status: { $ne: "cancelled" },
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
    const today = new Date();
    const yesterday = subDays(today, 1);
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);
    const startOfYesterday = startOfDay(yesterday);
    const endOfYesterday = endOfDay(yesterday);

    // Get all data in parallel
    const [
      todayRegistrations,
      yesterdayRegistrations,
      totalConfirmed,
      checkedIn,
      upcomingEvents,
      todayBookings,
    ] = await Promise.all([
      BookingModel.countDocuments({
        createdAt: { $gte: startOfToday, $lte: endOfToday },
        status: { $ne: "cancelled" },
      }),
      BookingModel.countDocuments({
        createdAt: { $gte: startOfYesterday, $lte: endOfYesterday },
        status: { $ne: "cancelled" },
      }),
      BookingModel.countDocuments({ status: "confirmed" }),
      BookingModel.countDocuments({ status: "checked-in" }),
      EventModel.find({
        date: { $gte: today },
        isActive: true,
      })
        .sort({ date: 1 })
        .limit(4),
      BookingModel.find({
        createdAt: { $gte: startOfToday, $lte: endOfToday },
        status: { $ne: "cancelled" },
      }).populate("user", "name email gender ageRange"),
    ]);

    // Calculate trend
    const trendPercentage =
      yesterdayRegistrations > 0
        ? Math.round(
            ((todayRegistrations - yesterdayRegistrations) /
              yesterdayRegistrations) *
              100
          )
        : 0;

    // Get user IDs from today's bookings
    const userIds = todayBookings.map((booking) => {
      // If user is populated (User object), use its _id, otherwise use the ObjectId directly
      return typeof booking.user === "object" && "email" in booking.user
        ? booking.user._id
        : booking.user;
    });

    // Get demographics in parallel
    const [genderStats, ageStats] = await Promise.all([
      UserModel.aggregate([
        { $match: { _id: { $in: userIds } } },
        { $group: { _id: "$gender", count: { $sum: 1 } } },
      ]),
      UserModel.aggregate([
        { $match: { _id: { $in: userIds } } },
        { $group: { _id: "$ageRange", count: { $sum: 1 } } },
      ]),
    ]);

    // Get booking counts for events
    const eventsWithBookings = await Promise.all(
      upcomingEvents.map(async (event) => {
        const bookingCount = await BookingModel.countDocuments({
          event: event._id,
          status: { $ne: "cancelled" },
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

    // Format demographics data
    const formattedGenderStats = genderStats.map((stat) => ({
      gender: stat._id.charAt(0).toUpperCase() + stat._id.slice(1),
      count: stat.count,
    }));

    const formattedAgeStats = ageStats.map((stat) => ({
      ageGroup: stat._id,
      count: stat.count,
    }));

    res.json({
      success: true,
      message: "All dashboard data retrieved successfully",
      data: {
        overview: {
          todayRegistrations,
          totalConfirmed,
          checkedIn,
          upcomingEventsCount: upcomingEvents.length,
          trend:
            trendPercentage >= 0
              ? `+${trendPercentage}% vs yesterday`
              : `${trendPercentage}% vs yesterday`,
        },
        genderStats: formattedGenderStats,
        ageStats: formattedAgeStats,
        upcomingEvents: eventsWithBookings,
        todayRegistrations: todayBookings,
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
    const event = await EventModel.findOne({ isActive: true })
      .sort({ date: 1 })
      .lean();

    if (!event) {
      res.status(404).json({
        success: false,
        message: "No active events found",
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
      page = 1,
      limit = 50,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build match query
    let matchQuery: any = {};

    // Status filter (exclude cancelled by default unless specifically requested)
    if (status && status !== "all") {
      matchQuery.status = status;
    } else {
      matchQuery.status = { $ne: "cancelled" };
    }

    // Event date filter
    if (eventDate && eventDate !== "all") {
      const date = new Date(eventDate as string);
      const startOfEventDate = startOfDay(date);
      const endOfEventDate = endOfDay(date);
      matchQuery.eventDate = { $gte: startOfEventDate, $lte: endOfEventDate };
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
      { $unwind: "$userInfo" },
      { $unwind: "$eventInfo" },
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

    // Add projection to format the response
    pipeline.push({
      $project: {
        id: "$_id",
        ticket_id: "$ticketId",
        full_name: "$userInfo.name",
        email: "$userInfo.email",
        phone: "$userInfo.phone",
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
        ageRange: "$userInfo.ageRange",
        gender: {
          $concat: [
            { $toUpper: { $substr: ["$userInfo.gender", 0, 1] } },
            { $substr: ["$userInfo.gender", 1, -1] },
          ],
        },
        seat_number: {
          $cond: {
            if: { $gt: [{ $size: "$seatNumbers" }, 0] },
            then: { $arrayElemAt: ["$seatNumbers", 0] },
            else: null,
          },
        },
        seat_labels: "$seatLabels",
        event_date: "$eventDate",
        status: "$status",
        created_date: "$createdAt",
        qrCode: "$qrCode",
        eventInfo: {
          time: "$eventInfo.time",
          totalSeats: "$eventInfo.totalSeats",
        },
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
      status: { $ne: "cancelled" },
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
    const [totalCount, statusStats, genderStats, ageStats] = await Promise.all([
      // Total registrations (excluding cancelled)
      BookingModel.countDocuments({ status: { $ne: "cancelled" } }),

      // Status distribution
      BookingModel.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Gender distribution
      BookingModel.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
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
        { $match: { status: { $ne: "cancelled" } } },
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
          gender: g._id.charAt(0).toUpperCase() + g._id.slice(1),
          count: g.count,
        })),
        ageStats: ageStats.map((a) => ({ ageGroup: a._id, count: a.count })),
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

    let updateData = {};
    let message = "";

    switch (action) {
      case "void":
        updateData = { status: BookingStatus.Voided };
        message = `${registrationIds.length} registrations voided successfully`;
        break;
      case "confirm":
        updateData = { status: BookingStatus.Attending };
        message = `${registrationIds.length} registrations confirmed successfully`;
        break;
      case "checkin":
        updateData = { status: BookingStatus.Attended };
        message = `${registrationIds.length} registrations checked-in successfully`;
        break;
      default:
        res.status(400).json({
          success: false,
          message: "Invalid bulk action",
        });
        return;
    }

    const result = await BookingModel.updateMany(
      {
        _id: { $in: registrationIds },
        status: { $ne: BookingStatus.Voided }, // Don't update already voided registrations
      },
      updateData
    );

    res.json({
      success: true,
      message,
      data: {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount,
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

router.get(
  "/bookings",
  validateRequest(getAllBookingsSchema),
  async (req, res) => {
    try {
      const { page = "1", limit = "10", search = "", status } = req.query;

      const result = await bookingService.getAllBookings({
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        search: search as string,
        status: status as BookingStatus,
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
      blockedDates: validatedData.blockedDates?.map((d:any) => new Date(d)),
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
    const { page = 1, limit = 10 } = req.query;
    const result = await eventService.getEvents({
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
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

export default router;
