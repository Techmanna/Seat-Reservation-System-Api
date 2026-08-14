import { Request, Response } from "express";
import { BookingPaymentService } from "../services/BookingPaymentService";
import { BookingPaymentModel } from "../models/BookingPayment";
import mongoose from "mongoose";
import { ApiResponse } from "../types";
import { logger } from "../utils/logger";

const paymentService = new BookingPaymentService();

export class BookingPaymentController {

  /**
   * Admin: Generate a payment link for a user's unpaid bookings in a hall
   */
  async generatePaymentLink(req: Request, res: Response): Promise<void> {
    try {
      const { userId, hallId, bookingIds } = req.body;

      if (!userId || !hallId || !bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "userId, hallId, and bookingIds (array) are required"
        });
        return;
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
  async getHallPayments(req: Request, res: Response): Promise<void> {
    try {
      const { hallId } = req.params;
      const { status } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const filter: any = {};
      if (hallId && hallId !== "all") {
        filter.hall = hallId;
      }
      if (status) {
        filter.status = status;
      }

      const total = await BookingPaymentModel.countDocuments(filter);
      
      const payments = await BookingPaymentModel.find(filter)
        .populate("user", "name email phone")
        .populate("bookings", "ticketId seatLabels status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      res.status(200).json({
        success: true,
        data: payments,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      logger.error("getHallPayments error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  /**
   * Proxy for checkout link to check expiration before redirecting to Paystack
   */
  async checkoutProxy(req: Request, res: Response): Promise<void> {
    try {
      const { reference } = req.params;
      const result = await paymentService.checkoutProxy(reference);

      if (!result.success) {
        res.status(400).send(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h2>Checkout Error</h2>
              <p>${result.message}</p>
              <a href="${process.env.FRONTEND_URL || 'https://app.themorayobrownshow.com'}" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #000; color: #fff; text-decoration: none; border-radius: 5px;">Return to Site</a>
            </body>
          </html>
        `);
        return;
      }

      // Redirect to the Paystack authorization URL
      res.redirect(result.data?.paymentLink);
    } catch (error: any) {
      logger.error("checkoutProxy error:", error);
      res.status(500).send("Internal server error");
    }
  }

  /**
   * Verify Payment (can be called by webhook or frontend return url)
   */
  async verifyPayment(req: Request, res: Response): Promise<void> {
    try {
      const { reference } = req.body;
      if (!reference) {
        res.status(400).json({
          success: false,
          message: "Payment reference is required"
        });
        return;
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

  /**
   * Admin: Get Payment Stats
   */
  async getPaymentStats(req: Request, res: Response): Promise<void> {
    try {
      const { hallId } = req.query;
      const filter: any = {};
      if (hallId && hallId !== "all") {
        filter.hall = new mongoose.Types.ObjectId(hallId as string);
      }

      const stats = await BookingPaymentModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$status",
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 }
          }
        }
      ]);

      const formattedStats = {
        successful: { amount: 0, count: 0 },
        pending: { amount: 0, count: 0 },
        failed: { amount: 0, count: 0 },
        total: { amount: 0, count: 0 }
      };

      stats.forEach(stat => {
        const status = stat._id as keyof typeof formattedStats;
        if (formattedStats[status]) {
          formattedStats[status].amount = stat.totalAmount;
          formattedStats[status].count = stat.count;
        }
        formattedStats.total.amount += stat.totalAmount;
        formattedStats.total.count += stat.count;
      });

      res.status(200).json({
        success: true,
        data: formattedStats
      });
    } catch (error: any) {
      logger.error("getPaymentStats error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
}
