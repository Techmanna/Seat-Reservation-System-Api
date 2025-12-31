// emailTemplates.js - Reusable Email Template System

import { Booking, User, Event } from "../types";
import { formatDate } from "./formatDate";
import config from "../config/environment";

export class EmailTemplateBuilder {
  private readonly baseStyles: string;

  constructor() {
    this.baseStyles = `
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #374151;
            background: linear-gradient(135deg, #f0fdf4 0%, #f9fafb 100%);
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            margin-top: 20px;
            margin-bottom: 20px;
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 3px solid #10b981;
            margin-bottom: 30px;
          }
          .logo {
            max-width: 150px;
            height: auto;
          }
          .status-icon {
            // display: inline-flex;
            display: hidden;
            align-items: center;
            justify-content: center;
            width: 64px;
            height: 64px;
            border-radius: 50%;
            margin: 20px auto;
          }
          .success { background-color: #10b981; }
          .warning { background-color: #f59e0b; }
          .error { background-color: #ef4444; }
          .info { background-color: #3b82f6; }
          
          .status-icon svg {
            width: 32px;
            height: 32px;
            fill: white;
          }
          .title {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin: 10px 0;
            text-align: center;
          }
          .subtitle {
            color: #6b7280;
            text-align: center;
            margin-bottom: 30px;
          }
          .details-section {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 24px;
            margin: 20px 0;
          }
          .details-title {
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 20px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 500;
            color: #6b7280;
          }
          .detail-value {
            color: #374151;
            font-weight: 500;
          }
          .badge {
            background: #e5e7eb;
            color: #374151;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
          }
          .badge.confirmed { background: #d1fae5; color: #065f46; }
          .badge.cancelled { background: #fee2e2; color: #991b1b; }
          .badge.pending { background: #fef3c7; color: #92400e; }
          
          .button {
            display: inline-block;
            padding: 12px 24px;
            border-radius: 25px;
            text-decoration: none;
            font-weight: 600;
            text-align: center;
            margin: 10px 5px;
          }
          .button-primary {
            background: #000000;
            color: white;
          }
          .button-primary:hover {
            background: #1f2937;
          }
          .button-secondary {
            background: transparent;
            color: #374151;
            border: 2px solid #d1d5db;
          }
          .button-danger {
            background: red;
            color: white;
          }
          .info-section {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
          }
          .info-header {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
          }
          .info-title {
            color: #1e40af;
            font-weight: 600;
            margin-left: 8px;
          }
          .info-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .info-list li {
            display: flex;
            align-items: flex-start;
            margin-bottom: 10px;
            color: #1d4ed8;
            font-size: 14px;
          }
          .info-bullet {
            width: 6px;
            height: 6px;
            background: #1d4ed8;
            border-radius: 50%;
            margin-top: 8px;
            margin-right: 12px;
            flex-shrink: 0;
          }
          .qr-section {
            text-align: center;
            padding: 20px;
            margin: 20px 0;
          }
          .qr-code {
            max-width: 200px;
            height: auto;
            border-radius: 8px;
          }
          .footer {
            text-align: center;
            padding: 20px 0;
            color: #6b7280;
            font-size: 14px;
            border-top: 1px solid #e5e7eb;
            margin-top: 30px;
          }
          @media only screen and (max-width: 600px) {
            .container {
              margin: 10px;
              padding: 15px;
            }
            .detail-row {
              flex-direction: column;
              align-items: flex-start;
              gap: 5px;
            }
          }
        </style>
      `;
  }

  getLogo() {
    return "data:image/png;base64,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";
  }
  
  getIcon(type: 'success' | 'warning' | 'error' | 'info') {
    return '';
    // const icons = {
    //   success: `<svg viewBox="0 0 24 24"><path d="M9 16.17L5.53 12.7c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l4.18 4.18c.39.39 1.02.39 1.41 0L20.29 6.71c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0L9 16.17z"  width="16" height="16"/></svg>`,
    //   warning: `<svg viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16h2v2h-2zm0-6h2v4h-2z"  width="16" height="16"/></svg>`,
    //   error: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"  width="16" height="16"/></svg>`,
    //   info: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"  width="16" height="16"/></svg>`
    // };
    // // return icons[type] || icons.info;
    // return icons.info;
  }

  // Base template structure
  generateBaseTemplate(content: string) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Notification</title>
        ${this.baseStyles}
      </head>
      <body>
        <div class="container">
          ${content}
        </div>
      </body>
      </html>
      `;
  }

  // Booking Confirmation Template
  generateBookingConfirmation(data: Booking) {
    const {
      eventDate,
      seatLabels,
      ticketId,
      status = 'confirmed',
      qrCode,
      event,
      user,
      calendarLink,
      reservationToken
    } = data;

    const u = user as User;
    const e = event as Event;

    const content = `
        <div class="header">
           <img src="${this.getLogo()}" alt="Logo" class="logo">
        </div>
  
        <div class="status-iconsuccess">
          <div>${this.getIcon('success')}</div>
        </div>
  
        <h1 class="title">Booking Successful!</h1>
        <p class="subtitle">Your seat has been reserved successfully</p>
  
        <div class="details-section">
          <h2 class="details-title">Booking Summary</h2>
          <div class="detail-row">
            <span class="detail-label">Session</span>
            <span class="detail-value">${'The Nigerian Family Space'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date</span>
            <span class="detail-value">${formatDate(eventDate.toString())}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Time</span>
            <span class="detail-value">${'4:00PM'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status</span>
            <span class="badge confirmed">${status.toUpperCase()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Seat(s)</span>
            <span class="detail-value badge">${Array.isArray(seatLabels) ? seatLabels.join(', ') : seatLabels}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Location</span>
            <span class="detail-value">${e?.location ?? "Conference Hall A"}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Booking ID</span>
            <span class="detail-value" style="font-family: monospace;">${ticketId}</span>
          </div>
        </div>
  
        ${qrCode ? `
        <div class="qr-section">
          <img src="${qrCode}" alt="QR Code" class="qr-code">
          <p style="margin-top: 10px; color: #6b7280; font-size: 14px;">Scan this QR code at the venue</p>
        </div>
        ` : ''}
  
        <div style="text-align: center; margin: 30px 0;">
          <a href="#" class="button button-primary">View Details</a>
          <a href="${calendarLink}" class="button button-secondary">Add to Calendar</a>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${config.app.frontendUrl}/cancel/${ticketId}/${reservationToken}" class="button button-danger">Cancel Booking</a>
        </div>
  
        <div class="info-section">
          <div class="info-header">
            <!--<div>${this.getIcon('info')}</div>-->
            <span class="info-title">Important Information</span>
          </div>
          <ul class="info-list">
            <li><span class="info-bullet"></span>Please arrive 15 minutes before the session starts</li>
            <li><span class="info-bullet"></span>Bring a valid ID for verification</li>
            <li><span class="info-bullet"></span>Session materials will be provided</li>
            <li><span class="info-bullet"></span>Contact info@mabstudios.com for any queries</li>
          </ul>
        </div>
  
        <div class="footer">
          <p>Thank you for booking with us! We look forward to seeing you at the event.</p>
          ${u.email ? `<p>This email was sent to ${u.email}</p>` : ''}
        </div>
      `;

    return this.generateBaseTemplate(content);
  }

  // Booking Cancellation Template
  generateBookingCancellation(data: Booking, reason = 'Customer request') {
    const {
      eventDate,
      seatLabels,
      ticketId,
      status = 'confirmed',
      qrCode,
      event,
      user

    } = data;

    const u = user as User;
    const e = event as Event;

    const content = `
        <div class="header">
          <img src="${this.getLogo()}" alt="Logo" class="logo">
        </div>
  
        <div class="status-iconerror">
          <div>${this.getIcon('error')} </div> 
      </div>
  
        <h1 class="title">Booking Cancelled</h1>
        <p class="subtitle">Your booking has been successfully cancelled</p>
  
        <div class="details-section">
          <h2 class="details-title">Cancellation Details</h2>
          <div class="detail-row">
            <span class="detail-label">Session</span>
            <span class="detail-value">${e.sessionName ?? ""}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date</span>
            <span class="detail-value">${formatDate(eventDate.toString())}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Time</span>
            <span class="detail-value">${e.time ?? "4:00PM"}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Seat(s)</span>
            <span class="detail-value">${Array.isArray(seatLabels) ? seatLabels.join(', ') : seatLabels}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Booking ID</span>
            <span class="detail-value" style="font-family: monospace;">${ticketId}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Reason</span>
            <span class="detail-value">${reason}</span>
          </div>
        </div>
  
        <div style="text-align: center; margin: 30px 0;">
          <a href="#" class="button button-primary">Browse Other Events</a>
          <a href="#" class="button button-secondary">Contact Support</a>
        </div>
  
        <div class="footer">
          <p>We're sorry to see you go. We hope to serve you again in the future.</p>
          <p>This email was sent to ${u.email}</p>
        </div>
      `;

    return this.generateBaseTemplate(content);
  }

  // OTP Email Template
  generateOTPEmail(data: { userName?: "" | string; otpCode: any; expiryTime?: "10 minutes" | undefined; purpose?: "verify your account" | undefined; userEmail: any; companyName?: "Your Company" | undefined; }) {
    const {
      userName = '',
      otpCode,
      expiryTime = '10 minutes',
      purpose = 'verify your account',
      userEmail,
      companyName = 'Your Company'
    } = data;

    const content = `
      <div class="header">
       <img src="${this.getLogo()}" alt="Logo" class="logo">
      </div>

      <div class="status-iconinfo">
        <div>${this.getIcon('info')}</div> 
     </div>

      <h1 class="title">Verification Code</h1>
      <p class="subtitle">Please use the following code to ${purpose}</p>

      ${userName ? `<p style="text-align: center; margin: 20px 0; color: #374151;">Hello ${userName},</p>` : ''}

      <div class="otp-section" style="text-align: center; margin: 40px 0; padding: 30px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px;">
        <p style="color: #64748b; font-size: 14px; margin-bottom: 10px; font-weight: 500;">YOUR VERIFICATION CODE</p>
        <div class="otp-code" style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e293b; font-family: 'Courier New', monospace; background: #ffffff; padding: 15px 25px; border-radius: 8px; display: inline-block; border: 1px solid #e2e8f0;">${otpCode}</div>
        <p style="color: #64748b; font-size: 12px; margin-top: 10px;">This code will expire in ${expiryTime}</p>
      </div>

      <div class="info-section">
        <div class="info-header">
         <!-- <div>${this.getIcon('warning')}</div>-->
          <span class="info-title">Security Notice</span>
        </div>
        <ul class="info-list">
          <li><span class="info-bullet"></span>This code is valid for ${expiryTime} only</li>
          <li><span class="info-bullet"></span>Never share this code with anyone</li>
          <li><span class="info-bullet"></span>If you didn't request this code, please ignore this email</li>
          <li><span class="info-bullet"></span>Contact support if you have any concerns</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0; padding: 20px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <p style="color: #92400e; margin: 0; font-size: 14px;">
          <strong>Having trouble?</strong> If you're unable to use the code above, please contact our support team at 
          <a href="mailto:info@mabstudios.com" style="color: #d97706; text-decoration: none;">info@mabstudios.com</a>
        </p>
      </div>

      <div class="footer">
        <p>This verification code was requested for ${userEmail}</p>
        <p>© ${new Date().getFullYear()}. All rights reserved.</p>
      </div>
    `;

    return this.generateBaseTemplate(content);
  }

  // Welcome Email Template
  // generateWelcomeEmail(data) {
  //   const {
  //     logoUrl = '',
  //     userName,
  //     userEmail,
  //     welcomeMessage = 'Welcome to our platform!',
  //     features = []
  //   } = data;

  //   const content = `
  //       <div class="header">
  //         ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo">` : ''}
  //       </div>

  //       <div class="status-icon info">
  //         <div>${this.getIcon('info')}

  //       <h1 class="title">Welcome, ${userName}!</h1>
  //       <p class="subtitle">${welcomeMessage}</p>

  //       <div class="details-section">
  //         <h2 class="details-title">Get Started</h2>
  //         <p style="margin-bottom: 20px;">Here's what you can do with your account:</p>

  //         ${features.length > 0 ? `
  //         <ul class="info-list">
  //           ${features.map(feature => `
  //             <li><span class="info-bullet"></span>${feature}</li>
  //           `).join('')}
  //         </ul>
  //         ` : `
  //         <ul class="info-list">
  //           <li><span class="info-bullet"></span>Browse and book events</li>
  //           <li><span class="info-bullet"></span>Manage your bookings</li>
  //           <li><span class="info-bullet"></span>Receive event notifications</li>
  //           <li><span class="info-bullet"></span>Access exclusive content</li>
  //         </ul>
  //         `}
  //       </div>

  //       <div style="text-align: center; margin: 30px 0;">
  //         <a href="#" class="button button-primary">Complete Profile</a>
  //         <a href="#" class="button button-secondary">Browse Events</a>
  //       </div>

  //       <div class="info-section">
  //         <div class="info-header">
  //           <div>${this.getIcon('info')}
  //         </div>
  //         <ul class="info-list">
  //           <li><span class="info-bullet"></span>Check our FAQ section</li>
  //           <li><span class="info-bullet"></span>Contact support at info@mabstudios.com</li>
  //           <li><span class="info-bullet"></span>Join our community forum</li>
  //         </ul>
  //       </div>

  //       <div class="footer">
  //         <p>Thank you for joining us! We're excited to have you on board.</p>
  //         <p>This email was sent to ${userEmail}</p>
  //       </div>
  //     `;

  //   return this.generateBaseTemplate(content);
  // }

  // General Notification Template
  // generateNotification(data) {
  //   const {
  //     logoUrl = '',
  //     title,
  //     message,
  //     type = 'info', // success, warning, error, info
  //     actionButton,
  //     userEmail,
  //     details = []
  //   } = data;

  //   const content = `
  //       <div class="header">
  //         ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo">` : ''}
  //       </div>

  //       <div class="status-icon ${type}">
  //         <div>${this.getIcon(type)}
  //</div>       </div>

  //       <h1 class="title">${title}</h1>
  //       <p class="subtitle">${message}</p>

  //       ${details.length > 0 ? `
  //       <div class="details-section">
  //         <h2 class="details-title">Details</h2>
  //         ${details.map(detail => `
  //           <div class="detail-row">
  //             <span class="detail-label">${detail.label}</span>
  //             <span class="detail-value">${detail.value}</span>
  //           </div>
  //         `).join('')}
  //       </div>
  //       ` : ''}

  //       ${actionButton ? `
  //       <div style="text-align: center; margin: 30px 0;">
  //         <a href="${actionButton.url}" class="button button-primary">${actionButton.text}</a>
  //       </div>
  //       ` : ''}

  //       <div class="footer">
  //         <p>This is an automated notification from our system.</p>
  //         <p>This email was sent to ${userEmail}</p>
  //       </div>
  //     `;

  //   return this.generateBaseTemplate(content);
  // }
}

// Usage Examples and Export
const emailTemplates = new EmailTemplateBuilder();

// Example usage in Node.js:
/*
const nodemailer = require('nodemailer');
 
// Configure your email transporter
const transporter = nodemailer.createTransporter({
  // your email config
});
 
// Send booking confirmation
const bookingData = {
  logoUrl: 'https://your-domain.com/logo.png',
  sessionName: 'The Nigerian Family Space',
  date: 'Thursday, July 18, 2023',
  time: '4:00 PM - 6:00 PM',
  seats: ['46C'],
  location: 'Conference Hall A',
  bookingId: '#BK-2023-001234',
  status: 'confirmed',
  qrCode: 'https://your-qr-code-url.com/qr.png',
  userEmail: 'user@example.com'
};
 
const htmlContent = emailTemplates.generateBookingConfirmation(bookingData);
 
await transporter.sendMail({
  from: 'noreply@yourcompany.com',
  to: bookingData.userEmail,
  subject: 'Booking Confirmation - ' + bookingData.sessionName,
  html: htmlContent
});
*/

module.exports = {
  EmailTemplateBuilder,
  emailTemplates
};