import { Router } from 'express';
import { BookingService } from '../services/BookingService';
import { ApiResponse } from '../types/index';
import { validateRequest } from '../middleware/validateRequest';
import { bookingSchema, cancelReservationParamsSchema, otpVerificationSchema, ticketIdParamsSchema } from '../dtos/index.dto';

const router = Router();
const bookingService = new BookingService();

// Step 1: Initiate booking with email verification
/**
 * @swagger
 * /bookings/initiate:
 *   post:
 *     summary: Initiate booking with email verification
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               eventDate:
 *                 type: string
 *                 format: date
 *               seatLabels:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Booking initiated
 *       400:
 *         description: Validation error
 */
router.post('/initiate', validateRequest(bookingSchema, 'body'), async (req, res) => {
  try {
    const result = await bookingService.initiateBooking(req.body);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    const response: ApiResponse<null> = {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
    res.status(500).json(response);
  }
});

// Step 2: Verify OTP and complete booking
/**
 * @swagger
 * /bookings/verify:
 *   post:
 *     summary: Verify OTP and complete booking
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       201:
 *         description: Booking completed
 *       400:
 *         description: Invalid OTP or data
 */
router.post('/verify', validateRequest(otpVerificationSchema, 'body'), async (req, res) => {
  try {
    const result = await bookingService.verifyOTPAndCompleteBooking(req.body);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    const response: ApiResponse<null> = {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
    res.status(500).json(response);
  }
});

// Resend OTP
/**
 * @swagger
 * /bookings/resend-otp:
 *   post:
 *     summary: Resend OTP to email
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP resent
 *       400:
 *         description: Missing email or error
 */
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required'
      });
      return
    }

    const result = await bookingService.resendOTP(email);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    const response: ApiResponse<null> = {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
    res.status(500).json(response);
  }
});

// Get available seats for a specific date
/**
 * @swagger
 * /bookings/seats/{date}:
 *   get:
 *     summary: Get available seats for a date
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Available seats returned
 *       400:
 *         description: Invalid date or error
 */
router.get('/seats/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { hallId } = req.query;
    const result = await bookingService.getAvailableSeats(date, hallId as string);

    const statusCode = result.success ? 200 : 400;

    res.status(statusCode).json(result);
  } catch (error: any) {
    const response: ApiResponse<null> = {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
    res.status(500).json(response);
  }
});

// Cancel/Void booking
/**
 * @swagger
 * /bookings/cancel:
 *   post:
 *     summary: Cancel/Void booking
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ticketId:
 *                 type: string
 *               reservationToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Booking cancelled
 *       400:
 *         description: Validation error
 */
router.post('/cancel', validateRequest(cancelReservationParamsSchema, 'body'), async (req, res) => {
  try {
    const { ticketId, reservationToken } = req.body;
    const result = await bookingService.cancelBooking({
      ticketId,
      reservationToken
    });

    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);

  } catch (error: any) {
    const response: ApiResponse<null> = {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
    res.status(500).json(response);
  }
});

// Manage Booking OTP
router.post('/otp/send', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }
    const result = await bookingService.sendManageBookingOTP(email);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/otp/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      res.status(400).json({ success: false, message: 'Email and OTP are required' });
      return;
    }
    const result = await bookingService.verifyManageBookingOTP(email, otp);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/modify-unpaid', async (req, res) => {
  try {
    const { email, hallId, newEventDates } = req.body;
    if (!email || !hallId || !newEventDates || !Array.isArray(newEventDates)) {
      res.status(400).json({ success: false, message: 'Invalid payload' });
      return;
    }
    const result = await bookingService.modifyUnpaidBookings({ email, hallId, newEventDates });
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;