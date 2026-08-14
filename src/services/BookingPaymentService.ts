import { Types } from "mongoose";
import { BookingPaymentModel } from "../models/BookingPayment";
import { BookingModel } from "../models/Booking";
import { HallModel } from "../models/Hall";
import { UserModel } from "../models/User";
import { PaymentService } from "./PaymentService";
import { NotificationService } from "./NotificationService";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";
import { BookingStatus } from "../types";
import config from "../config/environment";
import { QRService } from "./QRService";
import { EventModel } from "../models/Event";

export class BookingPaymentService {
  private notificationService: NotificationService;
  private qrService: QRService;

  constructor() {
    this.notificationService = new NotificationService();
    this.qrService = new QRService();
  }

  /**
   * Generates a payment link for a user's unpaid bookings in a specific hall.
   * Can be used for a single new booking or multiple retroactive bookings.
   */
  async generatePaymentLink(
    userId: string,
    hallId: string,
    bookingIds: string[],
    sendEmail: boolean = false,
    isRetroactive: boolean = false
  ): Promise<{ success: boolean; paymentLinkNGN?: string; paymentLinkUSD?: string; message: string; priceNGN?: number; priceUSD?: number }> {
    try {
      const hall = await HallModel.findById(hallId);
      if (!hall || !hall.isPaymentEnabled) {
        return { success: false, message: "Payment is not enabled for this hall." };
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        return { success: false, message: "User not found." };
      }

      const bookings = await BookingModel.find({
        _id: { $in: bookingIds },
        user: userId,
        hall: hallId,
        status: { $nin: [BookingStatus.Cancelled, BookingStatus.Voided] },
        paymentStatus: { $ne: 'paid' } // Only unpaid ones
      });

      if (bookings.length === 0) {
        return { success: true, message: "Bookings are already paid or cancelled. Ignoring silently." };
      }

      const numBookings = bookings.length;
      let priceNGN = (hall.paymentPriceNGN || 0) * numBookings;
      let priceUSD = (hall.paymentPriceUSD || 0) * numBookings;

      // Special pricing for existing users (retroactive)
      if (isRetroactive && hall.discountConfig?.existingUserPriceNGN) {
        priceNGN = (hall.discountConfig.existingUserPriceNGN || 0) * numBookings;
        priceUSD = (hall.discountConfig.existingUserPriceUSD || 0) * numBookings;
      } 
      // Discount for multiple days booking (new users)
      else if (hall.isMultipleDaysBookingEnabled && hall.discountConfig?.minDays && numBookings >= hall.discountConfig.minDays) {
        priceNGN -= (hall.discountConfig.discountAmountNGN || 0);
        priceUSD -= (hall.discountConfig.discountAmountUSD || 0);
        
        if (priceNGN < 0) priceNGN = 0;
        if (priceUSD < 0) priceUSD = 0;
      }

      let paymentLinkNGN: string | undefined;
      let paymentLinkUSD: string | undefined;
      let referenceNGN: string | undefined;
      let referenceUSD: string | undefined;

      const baseReference = `BKG-${uuidv4().replace(/-/g, '').substring(0, 10)}`;

      if (priceNGN > 0) {
        referenceNGN = `${baseReference}-NGN`;
        const callbackUrl = `${config.url}/payment/verify?reference=${referenceNGN}`;
        const payload = {
          email: user.email,
          amount: priceNGN * 100, // Paystack expects kobo
          reference: referenceNGN,
          callback_url: callbackUrl,
          metadata: {
            bookingIds: bookings.map(b => b._id),
            userId,
            hallId,
            type: 'booking_payment'
          }
        };
        const response = await PaymentService.initializePaystackPayment(payload);
        paymentLinkNGN = response.authorization_url;

        await new BookingPaymentModel({
          user: userId,
          hall: hallId,
          bookings: bookings.map(b => b._id),
          amount: priceNGN,
          currency: 'NGN',
          status: 'pending',
          paymentReference: referenceNGN,
          paymentLink: paymentLinkNGN,
          provider: 'paystack'
        }).save();
      }

      if (priceUSD > 0) {
        referenceUSD = `${baseReference}-USD`;
        const callbackUrl = `${config.url}/payment/verify?reference=${referenceUSD}`;
        const payload = {
          tx_ref: referenceUSD,
          amount: priceUSD,
          currency: 'USD',
          redirect_url: callbackUrl,
          customer: { email: user.email, name: user.name, phone: user.phone },
          meta: {
            userId,
            hallId,
            type: 'booking_payment'
          }
        };
        const response = await PaymentService.initializeFlutterwavePayment(payload);
        paymentLinkUSD = response.link;

        await new BookingPaymentModel({
          user: userId,
          hall: hallId,
          bookings: bookings.map(b => b._id),
          amount: priceUSD,
          currency: 'USD',
          status: 'pending',
          paymentReference: referenceUSD,
          paymentLink: paymentLinkUSD,
          provider: 'flutterwave'
        }).save();
      }

      if (!paymentLinkNGN && !paymentLinkUSD) {
         return { success: false, message: "No pricing configured for this hall." };
      }

      // Update bookings to reference the pending payment state
      await BookingModel.updateMany(
        { _id: { $in: bookings.map(b => b._id) } },
        { 
          $set: { 
            paymentStatus: 'pending'
            // We omit setting a single paymentReference on the booking since there might be two
          } 
        }
      );

      if (sendEmail) {
        // Run asynchronously in the background so the API responds instantly
        (async () => {
          try {
            const events = await EventModel.find({ _id: { $in: bookings.map(b => b.event) } });
            const eventDates = events.map(e => e.date).filter(d => !!d) as Date[];
            const proxyLinkNGN = paymentLinkNGN ? `${config.apiUrl}/api/payments/checkout/${referenceNGN}` : undefined;
            const proxyLinkUSD = paymentLinkUSD ? `${config.apiUrl}/api/payments/checkout/${referenceUSD}` : undefined;

            await this.notificationService.sendPaymentLinkEmail(
              user as any,
              priceNGN,
              priceUSD,
              proxyLinkNGN,
              proxyLinkUSD,
              eventDates,
              {
                hallName: hall.name,
                originalPriceNGN: (hall.paymentPriceNGN || 0) * numBookings,
                numBookings: numBookings
              }
            );
          } catch (e: any) {
            logger.error("[BookingPaymentService] Failed to send payment email in background:", e);
          }
        })();
      }

      const proxyLinkNGN = paymentLinkNGN ? `${config.apiUrl}/api/payments/checkout/${referenceNGN}` : undefined;
      const proxyLinkUSD = paymentLinkUSD ? `${config.apiUrl}/api/payments/checkout/${referenceUSD}` : undefined;

      return {
        success: true,
        paymentLinkNGN: proxyLinkNGN,
        paymentLinkUSD: proxyLinkUSD,
        priceNGN,
        priceUSD,
        message: "Payment links generated successfully."
      };

    } catch (error: any) {
      logger.error("[BookingPaymentService] generatePaymentLink error:", error);
      return { success: false, message: error.message || "Failed to generate payment link." };
    }
  }

  /**
   * Verify payment callback/webhook
   */
  async verifyPayment(reference: string): Promise<{ success: boolean; message: string }> {
    try {
      const paymentRecord = await BookingPaymentModel.findOne({ paymentReference: reference });
      if (!paymentRecord) {
        return { success: false, message: "Payment record not found." };
      }

      if (paymentRecord.status === 'successful') {
        return { success: true, message: "Payment already verified." };
      }

      // Verify with provider
      let isSuccessful = false;
      if (paymentRecord.provider === 'paystack') {
        const data = await PaymentService.verifyPaystackTransaction(reference);
        isSuccessful = data.status === 'success';
      } else {
        const data = await PaymentService.verifyFlutterwaveTransaction(reference);
        isSuccessful = data.status === 'successful'; // Flutterwave success status
      }

      if (isSuccessful) {
        // --- SAFEGUARD: Check if the booking has already expired (cancelled by cron) ---
        const relatedBookings = await BookingModel.find({ _id: { $in: paymentRecord.bookings } });
        const hasExpiredBookings = relatedBookings.some(b => b.status === BookingStatus.Cancelled || b.status === BookingStatus.Voided);

        if (hasExpiredBookings) {
          logger.warn(`[BookingPaymentService] Payment received for EXPIRED booking. Ref: ${reference}. Initiating automatic refund.`);
          
          if (paymentRecord.provider === 'paystack') {
             try {
                await PaymentService.refundPaystackTransaction(reference);
                logger.info(`[BookingPaymentService] Successfully refunded Paystack transaction ${reference}. Manual review may still be necessary.`);
             } catch (refundErr: any) {
                logger.error(`[BookingPaymentService] CRITICAL: Automatic Paystack refund failed for ${reference}. Manual refund required! Error: ${refundErr.message}`);
             }
          } else {
             logger.warn(`[BookingPaymentService] Automatic refund not implemented for Flutterwave yet. Manual refund required for ${reference}.`);
          }

          // Mark payment as refunded (since the payment was successful, but we can't assign seats)
          await BookingPaymentModel.findByIdAndUpdate(paymentRecord._id, { $set: { status: 'refunded' } });
          
          return { success: false, message: "Payment was successful but reservation had expired. Payment has been automatically refunded. Please contact support if you need assistance." };
        }
        // --- END SAFEGUARD ---

        // Use atomic update to prevent race conditions (e.g. webhook and frontend hitting this simultaneously)
        const updated = await BookingPaymentModel.findOneAndUpdate(
          { _id: paymentRecord._id, status: 'pending' },
          { $set: { status: 'successful' } },
          { new: true }
        );

        if (!updated) {
           return { success: true, message: "Payment verified and tickets already sent by another process." };
        }

        // Mark bookings as paid
        await BookingModel.updateMany(
          { _id: { $in: paymentRecord.bookings } },
          { $set: { paymentStatus: 'paid' } }
        );

        // Send ticket emails for all confirmed bookings
        const bookings = await BookingModel.find({ _id: { $in: paymentRecord.bookings } }).populate('hall').populate('event').populate('user');
        const user = await UserModel.findById(paymentRecord.user);

        if (user) {
          const confirmedBookings = [];
          for (const booking of bookings) {
            if (booking.status !== BookingStatus.Waitlisted) {
              const event = await EventModel.findById(booking.event);
              if (event) {
                // Ensure QR code is generated if missing
                if (!booking.qrCode) {
                   booking.qrCode = await this.qrService.generateQRCode(booking);
                   await booking.save();
                }
                confirmedBookings.push(booking);
              }
            }
          }
          
          if (confirmedBookings.length > 0) {
            await this.notificationService.sendGroupedBookingConfirmationEmail(user, confirmedBookings as any);
            if (user.phone) {
              await this.notificationService.sendTicketSMS(user.phone, confirmedBookings[0].ticketId);
            }
          }
        }
        
        return { success: true, message: "Payment verified and tickets sent." };
      } else {
        paymentRecord.status = 'failed';
        await paymentRecord.save();
        return { success: false, message: "Payment was not successful." };
      }

    } catch (error: any) {
      logger.error("[BookingPaymentService] verifyPayment error:", error);
      return { success: false, message: error.message || "Failed to verify payment." };
    }
  }

  /**
   * Proxy to check if a booking is expired before forwarding to the payment provider.
   */
  async checkoutProxy(reference: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const paymentRecord = await BookingPaymentModel.findOne({ paymentReference: reference });
      if (!paymentRecord) {
        return { success: false, message: "Payment record not found." };
      }

      if (paymentRecord.status === 'successful') {
        return { success: false, message: "This payment has already been successfully processed." };
      }
      
      if (paymentRecord.status === 'refunded') {
        return { success: false, message: "This payment has been refunded." };
      }

      const bookings = await BookingModel.find({ _id: { $in: paymentRecord.bookings } });
      const hasExpiredBookings = bookings.some(b => b.status === BookingStatus.Cancelled || b.status === BookingStatus.Voided);

      if (hasExpiredBookings || bookings.length === 0) {
        return { success: false, message: "Sorry, this reservation has expired and the seats have been released. Please start a new booking." };
      }

      return {
        success: true,
        message: "Valid checkout link.",
        data: { paymentLink: paymentRecord.paymentLink }
      };
    } catch (error: any) {
      logger.error("[BookingPaymentService] checkoutProxy error:", error);
      return { success: false, message: "An error occurred while validating the checkout link." };
    }
  }
}
