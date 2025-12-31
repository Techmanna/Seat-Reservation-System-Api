import config from '../config/environment';
import { User, Booking, NotificationFilter, NotificationJob } from '../types/index';
import { sendEmail } from '../utils/email';
import { EmailTemplateBuilder } from '../utils/emailTemplates';
import { logger } from '../utils/logger';
import { sendSMS } from '../utils/sms';
import { BookingModel } from '../models/Booking';
import { startOfDay, endOfDay } from 'date-fns';

export class NotificationService {

  async sendBookingConfirmationEmail(user: User, booking: Booking, event: any): Promise<void> {
    const emailTemplates = new EmailTemplateBuilder();
    const html = emailTemplates.generateBookingConfirmation(booking);

    const mailOptions = {
      from: config.mail.from,
      to: user.email,
      subject: 'Booking Confirmation - Event Hall Reservation',
      html,
    };

    await sendEmail(mailOptions);
  }

  async sendTicketSMS(phone: string, ticketId: string): Promise<void> {
    const message = `Your event hall booking is confirmed! Ticket ID: ${ticketId}. Please keep this for verification at the event.`;

    await sendSMS(phone, message);
  }

  async sendBulkNotification(users: User[], message: string, type: 'sms' | 'email' = 'email'): Promise<void> {
    if (type === 'email') {
      const promises = users.map(user => {
        const mailOptions = {
          from: process.env.FROM_EMAIL || 'noreply@eventhall.com',
          to: user.email,
          subject: 'Event Hall Notification',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Event Hall Notification</h2>
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
      const phoneNumbers = users.map(user => user.phone);
      await sendSMS(phoneNumbers, message);
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

  async sendCancellationConfirmationEmail(booking: Booking): Promise<void> { }

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
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Event Hall Notification</h1>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Dear ${recipientName},</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
            <p style="font-size: 16px; line-height: 1.6; color: #333; margin: 0;">${message}</p>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            Best regards,<br>
            <strong>Event Hall Team</strong>
          </p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
          <p style="font-size: 12px; color: #999; margin: 0;">
            This is an automated message. Please do not reply to this email.
          </p>
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
   * Process notification job in background
   */
  async processNotificationJob(jobData: NotificationJob): Promise<void> {
    try {
      logger.info(`Starting notification job for ${jobData.totalRecipients} recipients`);
      
      const result = await this.sendBatchNotifications(
        jobData.recipients,
        jobData.type,
        jobData.message,
        jobData.subject
      );

      logger.info(`Notification job completed: ${result.sent} sent, ${result.failed} failed`);
      
      if (result.errors.length > 0) {
        logger.warn('Notification errors:', result.errors);
      }

    } catch (error: any) {
      logger.error('Notification job failed:', error);
      throw error;
    }
  }
}