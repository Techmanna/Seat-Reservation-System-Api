// import { z } from "zod";

// export const updateSystemSettingsSchema = z
//   .object({
//     reservationOpenDate: z
//       .string()
//       .datetime({ message: "Reservation open date must be a valid ISO date" }),

//     reservationCloseDate: z
//       .string()
//       .datetime({ message: "Reservation close date must be a valid ISO date" }),

//     defaultTotalSeats: z
//       .number()
//       .int()
//       .min(1, "Total Ssats must be at least 1"),

//     eventTimes: z
//       .array(z.string().min(1))
//       .min(1, "At least one event time is required"),

//     workingDays: z
//       .array(z.number().int().min(0).max(6))
//       .min(1, "At least one working day is required"),

//     maxSeatsPerUser: z.number().int().min(1).max(10),

//     blockedDates: z
//       .array(
//         z.string().datetime({
//           message: "Blocked dates must be valid ISO dates",
//         })
//       )
//       .optional(),
//   })
//   .refine(
//     (data) =>
//       new Date(data.reservationOpenDate) <= new Date(data.reservationCloseDate),
//     {
//       message: "Reservation open date must be before reservation close date",
//       path: ["reservationCloseDate"],
//     }
//   );
