import { Request, Response } from "express";
import { BookingPaymentService } from "../services/BookingPaymentService";
import { BookingPaymentModel } from "../models/BookingPayment";
import { ApiResponse } from "../types";
import { logger } from "../utils/logger";

const paymentService = new BookingPaymentService();

export class BookingPaymentController {

  /**
   * Admin: Generate a payment link for a user's unpaid bookings in a hall
   */
  async generatePaymentLink(req: Request, res: Response) {
    try {
      const { userId, hallId, bookingIds } = req.body;

      if (!userId || !hallId || !bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "userId, hallId, and bookingIds (array) are required"
        });
      }

      const result = await paymentService.generatePaymentLink(userId, hallId, bookingIds, true, true);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      logger.error("generatePaymentLink error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  /**
   * Admin: Fetch payments for a hall
   */
  async getHallPayments(req: Request, res: Response) {
    try {
      const { hallId } = req.params;
      const { status } = req.query;

      const filter: any = { hall: hallId };
      if (status) {
        filter.status = status;
      }

      const payments = await BookingPaymentModel.find(filter)
        .populate("user", "name email phone")
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: payments
      });
    } catch (error: any) {
      logger.error("getHallPayments error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  /**
   * Verify Payment (can be called by webhook or frontend return url)
   */
  async verifyPayment(req: Request, res: Response) {
    try {
      const { reference } = req.body;
      if (!reference) {
        res.status(400).json({
          success: false,
          message: "Payment reference is required"
        });
      }

      const result = await paymentService.verifyPayment(reference);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      logger.error("verifyPayment error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
}
