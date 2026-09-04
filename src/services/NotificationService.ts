import config from '../config/environment';
import { User, Booking, NotificationFilter, NotificationJob } from '../types/index';
import { sendEmail } from '../utils/email';
import { EmailTemplateBuilder } from '../utils/emailTemplates';
import { logger } from '../utils/logger';
import { sendSMS } from '../utils/sms';
import { BookingModel } from '../models/Booking';
import { startOfDay, endOfDay } from 'date-fns';
import { NotificationType } from '../models/Notification';
import { NotificationPreferenceModel } from '../models/NotificationPreference';
import { InAppNotificationService } from './InAppNotificationService';
import { NotificationJobModel } from '../models/NotificationJob';
import fs from 'fs';

const inAppService = new InAppNotificationService();

export class NotificationService {

  /**
   * Unified notification method that respects user preferences
   */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data: any = {}
  ): Promise<void> {
    try {
      const prefs = await inAppService.getPreferences(userId);
      let categoryPrefs;

      switch (type) {
        case NotificationType.REMINDER:
          categoryPrefs = prefs.reminders;
          break;
        case NotificationType.EVENT:
          categoryPrefs = prefs.events;
          break;
        case NotificationType.BILLING:
          categoryPrefs = prefs.billing;
          break;
        default:
          categoryPrefs = { inApp: true, email: true, sms: false };
      }

      // 1. In-App Notification
      if (categoryPrefs.inApp) {
        await inAppService.createNotification(userId, type, title, message, data);
      }

      // 2. Email Notification
      if (categoryPrefs.email) {
        // Find user email
        const { UserModel } = require('../models/User');
        const user = await UserModel.findById(userId);
        if (user && user.email) {
          await sendEmail({
            to: user.email,
            subject: title,
            html: this.createEmailTemplate(message, user.name || 'User')
          });
        }
      }

      // 3. SMS Notification
      if (categoryPrefs.sms) {
        const { UserModel } = require('../models/User');
        const user = await UserModel.findById(userId);
        if (user && user.phone) {
          await sendSMS(user.phone, `${title}: ${message}`);
        }
      }
    } catch (error) {
      logger.error('[NotificationService] notify failed:', error);
    }
  }


  async sendGroupedBookingConfirmationEmail(user: User, bookings: Booking[]): Promise<void> {
    if (!bookings || bookings.length === 0) return;
    const emailTemplates = new EmailTemplateBuilder();
    const html = emailTemplates.generateGroupedBookingConfirmation(bookings);

    const mailOptions = {
      from: config.mail.from,
      to: user.email,
      subject: 'Booking Confirmation - The Morayo Show',
      html,
    };

    await sendEmail(mailOptions);
  }

  async sendBookingConfirmationEmail(user: User, booking: Booking, event: any): Promise<void> {
    const emailTemplates = new EmailTemplateBuilder();
    const html = emailTemplates.generateBookingConfirmation(booking);

    const mailOptions = {
      from: config.mail.from,
      to: user.email,
      subject: 'Booking Confirmation',
      html,
    };

    await sendEmail(mailOptions);
  }

  async sendTicketSMS(phone: string, ticketId: string): Promise<void> {
    const message = `Your booking is confirmed! Ticket ID: ${ticketId}. Please keep this for verification at the event.`;

    await sendSMS(phone, message);
  }

  async sendWaitlistConfirmationEmail(user: User, booking: Booking): Promise<void> {
    const emailTemplates = new EmailTemplateBuilder();
    const html = emailTemplates.generateWaitlistConfirmation(booking);

    await sendEmail({
      to: user.email,
      subject: "You're on the Waiting List",
      html,
    });
  }

  async sendBookingRejectionEmail(user: User, eventDate: Date, reason: string): Promise<void> {
    const emailTemplates = new EmailTemplateBuilder();
    const html = emailTemplates.generateBookingRejection(user, eventDate, reason);

    await sendEmail({
      to: user.email,
      subject: "Booking Capacity Reached",
      html,
    });
  }

  async sendWaitlistApprovedEmail(user: User, booking: Booking): Promise<void> {
    const emailTemplates = new EmailTemplateBuilder();
    const html = emailTemplates.generateWaitlistApproved(booking);

    await sendEmail({
      to: user.email,
      subject: "Your Booking has been Confirmed!",
      html,
    });
  }

  async sendPaymentLinkEmail(user: any, priceNGN: number, priceUSD: number, paymentLinkNGN: string | undefined, paymentLinkUSD: string | undefined, eventDates: Date[], extraDetails?: { hallName?: string, originalPriceNGN?: number, numBookings?: number }): Promise<void> {
    const emailTemplates = new EmailTemplateBuilder();
    const html = emailTemplates.generatePaymentLinkEmail(user, priceNGN, priceUSD, paymentLinkNGN, paymentLinkUSD, eventDates, extraDetails);

    await sendEmail({
      to: user.email,
      subject: "Complete your Booking Payment",
      html,
    });
  }

  async sendBookingExpirationEmail(user: any, eventDates: Date[]): Promise<void> {
    const emailTemplates = new EmailTemplateBuilder();
    const html = emailTemplates.generatePaymentExpirationEmail(user, eventDates);

    await sendEmail({
      to: user.email,
      subject: "Reservation Expired - The Morayo Show",
      html,
    });
  }

  async sendBulkNotification(users: User[], message: string, type: 'sms' | 'email' = 'email'): Promise<void> {
    if (type === 'email') {
      const promises = users.map(user => {
        const mailOptions = {
          from: process.env.FROM_EMAIL || 'noreply@eventhall.com',
          to: user.email,
          subject: 'The Morayo Show',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">The Morayo Show</h2>
              <p>Dear ${user.name},</p>
              <p>${message}</p>
              <hr style="margin: 30px 0;">
              <p style="font-size: 12px; color: #666;">
                This is an automated message. Please do not reply to this email.
              </p>
            </div>
          `
        };
        return sendEmail(mailOptions);
      });
      await Promise.all(promises);
    } else {
      const phoneNumbers = users.map(user => user.phone).filter((p): p is string => !!p);
      if (phoneNumbers.length > 0) {
        await sendSMS(phoneNumbers, message);
      }
    }
  }

  async sendOTPEmail(email: string, otp: string, name: string): Promise<void> {
    const emailTemplates = new EmailTemplateBuilder();

    try {
      const subject = 'Verify Your Email - Booking Confirmation';

      const html = emailTemplates.generateOTPEmail(
        {
          userEmail: email,
          otpCode: otp,
          userName: name,
        }
      );
      await sendEmail({ to: email, subject, html });
    } catch (error) {
      logger.error('Failed to send OTP email2:', error);
    }
  }

  // Send OTP via SMS
  async sendOTPSMS(phone: string, otp: string, name: string): Promise<void> {
    const message = `MAB Studios, Your OTP code is: ${otp}. It is valid for 10 minutes.`;
    await sendSMS(phone, message);
  }

  // Send welcome email
  async sendWelcomeEmail(admin: any, tempPassword: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Admin Panel</h2>
        <p>Hello ${admin.username},</p>
        <p>Your admin account has been created successfully. Here are your login details:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Username:</strong> ${admin.username}</p>
          <p><strong>Email:</strong> ${admin.email}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <p><strong>Role:</strong> ${admin.role}</p>
        </div>
        <p style="color: #e74c3c;"><strong>Important:</strong> Please change your password after first login for security.</p>
        <p>Best regards,<br>Admin Team</p>
      </div>
    `;

    await sendEmail({
      to: admin.email,
      subject: 'Welcome to Admin Panel - Account Created',
      html
    });
  }

  // Send password reset email
  async sendPasswordResetEmail(admin: any, resetToken: string): Promise<void> {
    const resetLink = `${config.app.frontendUrl}/admin/reset-password?token=${resetToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello ${admin.username},</p>
        <p>You requested to reset your password. Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetLink}</p>
        <p style="color: #e74c3c;">This link will expire in 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>Admin Team</p>
      </div>
    `;

    await sendEmail({
      to: admin.email,
      subject: 'Password Reset Request',
      html
    });
  }

  // Send password change notification
  async sendPasswordChangeNotification(admin: any): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Changed Successfully</h2>
        <p>Hello ${admin.username},</p>
        <p>Your password has been changed successfully.</p>
        <p><strong>Changed at:</strong> ${new Date().toLocaleString()}</p>
        <p>If you didn't make this change, please contact support immediately.</p>
        <p>Best regards,<br>Admin Team</p>
      </div>
    `;

    await sendEmail({
      to: admin.email,
      subject: 'Password Changed Successfully',
      html
    });
  }

  // Send password reset confirmation
  async sendPasswordResetConfirmation(admin: any): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">Password Reset Successful</h2>
        <p>Hello ${admin.username},</p>
        <p>Your password has been reset successfully.</p>
        <p><strong>Reset at:</strong> ${new Date().toLocaleString()}</p>
        <p>You can now login with your new password.</p>
        <p>Best regards,<br>Admin Team</p>
      </div>
    `;

    await sendEmail({
      to: admin.email,
      subject: 'Password Reset Successful',
      html
    });
  }

  async sendCancellationConfirmationEmail(booking: Booking): Promise<void> {
    const emailTemplates = new EmailTemplateBuilder();
    const html = emailTemplates.generateBookingCancellation(booking);
    const user = booking.user as User;
    await sendEmail({
      to: user.email,
      subject: 'Booking Cancelled',
      html
    });
  }

  /**
   * Get filtered users based on notification criteria
   */
  async getFilteredUsers(filters: NotificationFilter): Promise<any[]> {
    const pipeline: any[] = [];

    // Build match query for bookings
    let matchQuery: any = {};

    // Filter by event date
    if (filters.eventDate) {
      const date = new Date(filters.eventDate);
      const startOfEventDate = startOfDay(date);
      const endOfEventDate = endOfDay(date);
      matchQuery.eventDate = { $gte: startOfEventDate, $lte: endOfEventDate };
    }

    // Filter by booking status
    if (filters.status && filters.status.length > 0) {
      matchQuery.status = { $in: filters.status };
    }

    pipeline.push({ $match: matchQuery });

    // Lookup user information
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userInfo'
      }
    });

    pipeline.push({ $unwind: '$userInfo' });

    // Add user-based filters
    let userMatchConditions: any = {};

    if (filters.gender) {
      userMatchConditions['userInfo.gender'] = filters.gender;
    }

    if (filters.ageRange) {
      userMatchConditions['userInfo.ageRange'] = filters.ageRange;
    }

    if (Object.keys(userMatchConditions).length > 0) {
      pipeline.push({ $match: userMatchConditions });
    }

    // Group by user to avoid duplicates
    pipeline.push({
      $group: {
        _id: '$userInfo._id',
        name: { $first: '$userInfo.name' },
        email: { $first: '$userInfo.email' },
        phone: { $first: '$userInfo.phone' },
        gender: { $first: '$userInfo.gender' },
        ageRange: { $first: '$userInfo.ageRange' }
      }
    });

    const users = await BookingModel.aggregate(pipeline);
    return users.map(user => ({
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone
    }));
  }

  /**
   * Create email template with custom message
   */
  private createEmailTemplate(message: string, recipientName: string): string {
    return `
     <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f5f5f5; color: #333;">
      <div style="background: #ffffff; border: 1px solid #e0e0e0;">
        <div style="padding: 28px;">
          <div style="background: #f7f7f7; border: 1px solid #e5e5e5; padding: 18px; margin: 20px 0;">
            <p style="font-size: 15px; line-height: 1.7; color: #444; margin: 0;">
              ${message}
            </p>
          </div>
        </div>
        <div style="padding: 18px 28px; background: #fafafa; border-top: 1px solid #e5e5e5;">
          <p style="font-size: 12px; line-height: 1.5; color: #999; margin: 0;">
            This is an automated message.
          </p>
        </div>
      </div>
    </div>
    `;
  }

  /**
   * Send notifications in batches
   */
  async sendBatchNotifications(
    recipients: any[],
    type: 'email' | 'sms' | 'both',
    message: string,
    subject?: string,
    batchSize: number = 20
  ): Promise<{ sent: number; failed: number; errors: string[] }> {
    let totalSent = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    // Process recipients in batches
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      try {
        if (type === 'email' || type === 'both') {
          const emailPromises = batch
            .filter(recipient => recipient.email)
            .map(async (recipient) => {
              try {
                const html = this.createEmailTemplate(message, recipient.name);
                await sendEmail({
                  to: recipient.email,
                  subject: subject || 'Event Hall Notification',
                  html
                });
                return { success: true };
              } catch (error: any) {
                errors.push(`Email failed for ${recipient.email}: ${error.message}`);
                return { success: false };
              }
            });

          const emailResults = await Promise.allSettled(emailPromises);
          const emailSent = emailResults.filter(result =>
            result.status === 'fulfilled' && result.value.success
          ).length;
          const emailFailed = emailResults.length - emailSent;

          totalSent += emailSent;
          totalFailed += emailFailed;
        }

        if (type === 'sms' || type === 'both') {
          const smsPromises = batch
            .filter(recipient => recipient.phone)
            .map(async (recipient) => {
              try {
                await sendSMS(recipient.phone, message);
                return { success: true };
              } catch (error: any) {
                errors.push(`SMS failed for ${recipient.phone}: ${error.message}`);
                return { success: false };
              }
            });

          const smsResults = await Promise.allSettled(smsPromises);
          const smsSent = smsResults.filter(result =>
            result.status === 'fulfilled' && result.value.success
          ).length;
          const smsFailed = smsResults.length - smsSent;

          totalSent += smsSent;
          totalFailed += smsFailed;
        }

        // Add delay between batches to avoid rate limiting
        if (i + batchSize < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error: any) {
        logger.error(`Batch processing error:`, error);
        errors.push(`Batch error: ${error.message}`);
        totalFailed += batch.length;
      }
    }

    return { sent: totalSent, failed: totalFailed, errors };
  }

  /**
   * Create a bulk email job and queue it for background processing
   */
  async createBulkEmailJob(
    targetType: string,
    subject: string,
    message: string,
    attachments?: { filename: string; path: string }[],
    filters?: any
  ): Promise<any> {
    try {
      let recipients: { email: string; name: string }[] = [];
      const { UserModel } = require('../models/User');

      if (targetType === 'all') {
        const users = await UserModel.find({ email: { $exists: true, $ne: null } });
        recipients = users.map((u: any) => ({ email: u.email, name: u.name || 'User' }));
      } else if (targetType === 'specific_users' && filters?.userIds) {
        const users = await UserModel.find({ _id: { $in: filters.userIds } });
        recipients = users.map((u: any) => ({ email: u.email, name: u.name || 'User' }));
      } else if (targetType === 'booked_date_range' && filters?.startDate && filters?.endDate) {
        const start = startOfDay(new Date(filters.startDate));
        const end = endOfDay(new Date(filters.endDate));
        const bookings = await BookingModel.find({ eventDate: { $gte: start, $lte: end } }).populate('user');
        const uniqueEmails = new Map();
        bookings.forEach((b: any) => {
          if (b.user && b.user.email) {
            uniqueEmails.set(b.user.email, b.user.name || 'User');
          }
        });
        recipients = Array.from(uniqueEmails, ([email, name]) => ({ email, name }));
      } else if (targetType === 'booked_hall' && filters?.hallId) {
        const bookings = await BookingModel.find({ hall: filters.hallId }).populate('user');
        const uniqueEmails = new Map();
        bookings.forEach((b: any) => {
          if (b.user && b.user.email) {
            uniqueEmails.set(b.user.email, b.user.name || 'User');
          }
        });
        recipients = Array.from(uniqueEmails, ([email, name]) => ({ email, name }));
      } else if (targetType === 'not_booked') {
        const usersWithBookings = await BookingModel.distinct('user');
        const nonBookedUsers = await UserModel.find({
          _id: { $nin: usersWithBookings },
          email: { $exists: true, $ne: null }
        });
        recipients = nonBookedUsers.map((u: any) => ({ email: u.email, name: u.name || 'User' }));
      } else if (targetType === 'individual_email' && filters?.emails) {
        recipients = filters.emails.map((e: string) => ({ email: e.trim(), name: 'User' }));
      }

      if (recipients.length === 0) {
        throw new Error("No valid recipients found for the specified target.");
      }

      const job = await NotificationJobModel.create({
        status: 'pending',
        targetType,
        subject,
        message,
        attachments: attachments || [],
        pendingRecipients: recipients,
      });

      return job;
    } catch (error) {
      logger.error('Failed to create bulk email job:', error);
      throw error;
    }
  }

  /**
   * Process a batch of emails from the oldest pending/processing job
   */
  async processBulkEmailBatch(): Promise<void> {
    try {
      // Find the oldest job that is pending or processing
      const job = await NotificationJobModel.findOne({
        status: { $in: ['pending', 'processing'] }
      }).sort({ createdAt: 1 });

      if (!job) {
        return; // No active jobs
      }

      // Mark as processing if it was pending
      if (job.status === 'pending') {
        job.status = 'processing';
        job.startedAt = new Date();
        await job.save();
      }

      // Batch size for Namecheap private email (e.g., limit to 8 per minute)
      const BATCH_SIZE = 8;

      const recipientsToProcess = job.pendingRecipients.slice(0, BATCH_SIZE);
      if (recipientsToProcess.length === 0) {
        job.status = 'completed';
        job.completedAt = new Date();

        // Delete attachments after job completion for history/auditing logic
        if (job.attachments && job.attachments.length > 0) {
          job.attachments.forEach(att => {
            if (fs.existsSync(att.path)) {
              fs.unlinkSync(att.path);
            }
          });
        }

        await job.save();
        logger.info(`Bulk email job ${job._id} completed.`);
        return;
      }

      // Send emails
      const promises = recipientsToProcess.map(async (recipient) => {
        try {
          const html = this.createEmailTemplate(job.message, recipient.name);
          await sendEmail({
            to: recipient.email,
            subject: job.subject,
            html,
            attachments: job.attachments?.map(a => ({ filename: a.filename, path: a.path }))
          });
          return { success: true, email: recipient.email };
        } catch (error: any) {
          return { success: false, email: recipient.email, error: error.message };
        }
      });

      const results = await Promise.allSettled(promises);

      let sentInBatch = 0;
      let failedInBatch = 0;
      const newErrors: string[] = [];

      results.forEach((res) => {
        if (res.status === 'fulfilled') {
          if (res.value.success) {
            sentInBatch++;
          } else {
            failedInBatch++;
            newErrors.push(`Failed sending to ${res.value.email}: ${res.value.error}`);
          }
        } else {
          failedInBatch++;
          newErrors.push(`Promise rejected: ${res.reason}`);
        }
      });

      // Update the job: remove processed recipients and update stats
      job.pendingRecipients = job.pendingRecipients.slice(BATCH_SIZE) as any;
      job.sentCount += sentInBatch;
      job.failedCount += failedInBatch;
      if (newErrors.length > 0) {
        job.errorLogs = [...job.errorLogs, ...newErrors];
      }

      // If no more pending recipients, complete it immediately
      if (job.pendingRecipients.length === 0) {
        job.status = 'completed';
        job.completedAt = new Date();
        // Delete attachments after job completion
        if (job.attachments && job.attachments.length > 0) {
          job.attachments.forEach(att => {
            if (fs.existsSync(att.path)) {
              fs.unlinkSync(att.path);
            }
          });
        }
        logger.info(`Bulk email job ${job._id} completed.`);
      }

      await job.save();

    } catch (error) {
      logger.error('Error in processBulkEmailBatch:', error);
    }
  }
}