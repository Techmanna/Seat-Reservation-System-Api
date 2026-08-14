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
            display: none;
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
            padding-right: 4px;
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
          strong {
            padding: 0 4px;
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

  getLogo = () =>
    "https://app.themorayobrownshow.com/tmas-logo.png";

  getIcon(type: "success" | "warning" | "error" | "info") {
    return "";
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


  // Grouped Booking Confirmation Template
  generateGroupedBookingConfirmation(bookings: any[]) {
    if (!bookings || bookings.length === 0) return "";
    const firstBooking = bookings[0];
    const { ticketId, qrCode, user } = firstBooking;
    const h = firstBooking.hall as any;
    const u = user as any;

    let datesListHtml = '';
    bookings.forEach(b => {
      datesListHtml += `
      <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #e5e7eb;">
        <div class="detail-row">
          <span class="detail-label">Date </span>
          <span class="detail-value">${" "}${formatDate(b.eventDate)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Seat(s)</span>
          <span class="detail-value">
            ${" "}${Array.isArray(b.seatLabels) ? b.seatLabels.join(", ") : b.seatLabels}
          </span>
        </div>
      </div>
      `;
    });

    const content = `
    <div class="header">
      <img src="${this.getLogo()}" alt="Logo" class="logo">
    </div>

    <h1 class="title">Hello!</h1>

    <p class="subtitle">
      Thank you for registering to be part of the live audience on
      <strong>The Morayo Show</strong>. We’re excited to have you with us.
    </p>

    <div class="details-section">
      <h2 class="details-title">Event Details</h2>
      
      ${datesListHtml}

      <div class="detail-row" style="margin-top: 15px;">
        <span class="detail-label">Call Time </span>
        <span class="detail-value">${" "}9:00am prompt</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Booking ID</span>
        <span class="detail-value" style="font-family: monospace;">
          ${" "}${ticketId}
        </span>
      </div>
    </div>

    <div class="details-section">
      <h2 class="details-title">📍 Venue</h2>
      <p class="detail-value">
        ${h?.name || "MAB Studios"},<br/>
        ${h?.address || "3, Worship Center, Off Etal Avenue, Kudirat Abiola Way"},<br/>
        ${h?.city || "Oregun"}, ${h?.state || "Lagos"}.
      </p>
    </div>

    <div class="info-section">
      <div class="info-header">
        <span class="info-title">Important Notice</span>
      </div>
      <ul class="info-list">
        <li><span class="info-bullet"></span>
          This production will start${" "}<strong> strictly on time</strong>.
        </li>
        <li><span class="info-bullet"></span>
          Please do${" "}<strong> NOT </strong>${" "}keep African time — entry will not be allowed after 9:00am.
        </li>
        <li><span class="info-bullet"></span>
          Dress code: Please dress nicely and appropriately for a studio recording.
        </li>
      </ul>
    </div>

    ${
      qrCode
        ? `
      <div class="qr-section">
        <img src="${qrCode}" alt="QR Code" class="qr-code">
        <p style="margin-top: 10px; color: #6b7280; font-size: 14px;">
          Please present this QR code at the venue
        </p>
      </div>
    `
        : ""
    }

    <div class="details-section">
      <p class="detail-value">
        For enquiries please contact:
        <strong>+234 904 833 1499</strong>
      </p>
    </div>

    <div class="footer">
      <p>Warm regards,<br/><strong>The Morayo Show Team</strong></p>
      ${u?.email ? `<p>This email was sent to ${u.email}</p>` : ""}
    </div>
  `;

    return this.generateBaseTemplate(content);
  }

  // Booking Confirmation Template
  generateBookingConfirmation(data: Booking) {
    const { eventDate, seatLabels, ticketId, qrCode, event, user } = data;

    const u = user as User;
    const e = event as Event;
    const h = data.hall as any;

    const content = `
    <div class="header">
      <img src="${this.getLogo()}" alt="Logo" class="logo">
    </div>

    <h1 class="title">Hello!</h1>

    <p class="subtitle">
      Thank you for registering to be part of the live audience on
      <strong>The Morayo Show</strong>. We’re excited to have you with us.
    </p>

    <div class="details-section">
      <h2 class="details-title">Event Details</h2>

      <div class="detail-row">
        <span class="detail-label">Date </span>
        <span class="detail-value">${" "}${formatDate(
      eventDate
    )}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Call Time </span>
        <span class="detail-value">${" "}9:00am prompt</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Seat(s)</span>
        <span class="detail-value">
          ${" "}${
      Array.isArray(seatLabels) ? seatLabels.join(", ") : seatLabels
    }
        </span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Booking ID</span>
        <span class="detail-value" style="font-family: monospace;">
          ${" "}${ticketId}
        </span>
      </div>
    </div>

    <div class="details-section">
      <h2 class="details-title">📍 Venue</h2>
      <p class="detail-value">
        ${h?.name || "MAB Studios"},<br/>
        ${h?.address || "3, Worship Center, Off Etal Avenue, Kudirat Abiola Way"},<br/>
        ${h?.city || "Oregun"}, ${h?.state || "Lagos"}.
      </p>
    </div>

    <div class="info-section">
      <div class="info-header">
        <span class="info-title">Important Notice</span>
      </div>
      <ul class="info-list">
        <li><span class="info-bullet"></span>
          This production will start${" "}<strong> strictly on time</strong>.
        </li>
        <li><span class="info-bullet"></span>
          Please do${" "}<strong> NOT </strong>${" "}keep African time — entry will not be allowed after 9:00am.
        </li>
        <li><span class="info-bullet"></span>
          Dress code: Please dress nicely and appropriately for a studio recording.
        </li>
      </ul>
    </div>

    ${
      qrCode
        ? `
      <div class="qr-section">
        <img src="${qrCode}" alt="QR Code" class="qr-code">
        <p style="margin-top: 10px; color: #6b7280; font-size: 14px;">
          Please present this QR code at the venue
        </p>
      </div>
    `
        : ""
    }

    <div class="details-section">
      <p class="detail-value">
        For enquiries please contact:
        <strong>+234 904 833 1499</strong>
      </p>
    </div>

    <div class="footer">
      <p>Warm regards,<br/><strong>The Morayo Show Team</strong></p>
      ${u.email ? `<p>This email was sent to ${u.email}</p>` : ""}
    </div>
  `;

    return this.generateBaseTemplate(content);
  }

  // Booking Cancellation Template
  generateBookingCancellation(data: Booking, reason = "Customer request") {
    const {
      eventDate,
      seatLabels,
      ticketId,
      status = "confirmed",
      qrCode,
      event,
      user,
    } = data;

    const u = user as User;
    const e = event as Event;

    const content = `
        <div class="header">
          <img src="${this.getLogo()}" alt="Logo" class="logo">
        </div>
  
        <div class="status-iconerror">
          <div>${this.getIcon("error")} </div> 
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
            <span class="detail-value">${formatDate(
              eventDate
            )}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Arrival</span>
            <span class="detail-value">${e.time ?? "9:00AM"}</span>
          </div>
           <div class="detail-row">
            <span class="detail-label">Live</span>
            <span class="detail-value">${e.time ?? "11:00AM"}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Seat(s)</span>
            <span class="detail-value">${
              Array.isArray(seatLabels) ? seatLabels.join(", ") : seatLabels
            }</span>
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
  generateOTPEmail(data: {
    userName?: "" | string;
    otpCode: any;
    expiryTime?: "10 minutes" | undefined;
    purpose?: "verify your account" | undefined;
    userEmail: any;
    companyName?: "Your Company" | undefined;
  }) {
    const {
      userName = "",
      otpCode,
      expiryTime = "10 minutes",
      purpose = "verify your account",
      userEmail,
      companyName = "Your Company",
    } = data;

    const content = `
      <div class="header">
       <img src="${this.getLogo()}" alt="Logo" class="logo">
      </div>

      <div class="status-iconinfo">
        <div>${this.getIcon("info")}</div> 
     </div>

      <h1 class="title">Verification Code</h1>
      <p class="subtitle">Please use the following code to ${purpose}</p>

      ${
        userName
          ? `<p style="text-align: center; margin: 20px 0; color: #374151;">Hello ${userName},</p>`
          : ""
      }

      <div class="otp-section" style="text-align: center; margin: 40px 0; padding: 30px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px;">
        <p style="color: #64748b; font-size: 14px; margin-bottom: 10px; font-weight: 500;">YOUR VERIFICATION CODE</p>
        <div class="otp-code" style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e293b; font-family: 'Courier New', monospace; background: #ffffff; padding: 15px 25px; border-radius: 8px; display: inline-block; border: 1px solid #e2e8f0;">${otpCode}</div>
        <p style="color: #64748b; font-size: 12px; margin-top: 10px;">This code will expire in ${expiryTime}</p>
      </div>

      <div class="info-section">
        <div class="info-header">
         <!-- <div>${this.getIcon("warning")}</div>-->
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

  // Waitlist Confirmation Template
  generateWaitlistConfirmation(data: Booking) {
    const { eventDate, ticketId, event, user } = data;
    const u = user as User;
    const e = event as Event;

    const content = `
    <div class="header">
      <img src="${this.getLogo()}" alt="Logo" class="logo">
    </div>

    <h1 class="title">You're on the Waiting List</h1>

    <p class="subtitle">
      The general allocation for this session is currently full. We've placed you on the waiting list for 
      <strong>The Morayo Show</strong> on ${formatDate(eventDate)}.
    </p>

    <div class="details-section">
      <h2 class="details-title">Waiting List Details</h2>
      <div class="detail-row">
        <span class="detail-label">Date </span>
        <span class="detail-value">${formatDate(eventDate)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Booking ID</span>
        <span class="detail-value" style="font-family: monospace;">${ticketId}</span>
      </div>
    </div>

    <div class="info-section">
      <div class="info-header">
        <span class="info-title">What happens next?</span>
      </div>
      <ul class="info-list">
        <li><span class="info-bullet"></span>
          If a seat becomes available, we will notify you immediately via email.
        </li>
        <li><span class="info-bullet"></span>
          12 hours before the event, any remaining priority slots will be automatically allocated to users on the waiting list.
        </li>
        <li><span class="info-bullet"></span>
          Please note that your original seat selection is not guaranteed.
        </li>
      </ul>
    </div>

    <div class="footer">
      <p>Warm regards,<br/><strong>The Morayo Show Team</strong></p>
      ${u.email ? `<p>This email was sent to ${u.email}</p>` : ""}
    </div>
  `;

    return this.generateBaseTemplate(content);
  }

  // Booking Rejection Template (Capacity Full)
  generateBookingRejection(user: User, eventDate: Date, reason: string) {
    const content = `
    <div class="header">
      <img src="${this.getLogo()}" alt="Logo" class="logo">
    </div>

    <h1 class="title" style="color: #ef4444;">Capacity Reached</h1>

    <p class="subtitle">
      We're sorry, but we couldn't complete your booking for 
      <strong>The Morayo Show</strong> on ${formatDate(eventDate)}.
    </p>

    <div class="details-section" style="border-left: 4px solid #ef4444;">
      <h2 class="details-title">Reason</h2>
      <p class="detail-value">${reason}</p>
    </div>

    <div class="info-section">
      <p style="font-size: 14px; color: #374151;">
        The event has reached full capacity and our waiting list is also full. 
        We encourage you to try booking for a different date or follow our social media for updates on future sessions.
      </p>
    </div>

    <div class="footer">
      <p>Warm regards,<br/><strong>The Morayo Show Team</strong></p>
      <p>This email was sent to ${user.email}</p>
    </div>
  `;

    return this.generateBaseTemplate(content);
  }

  // Waitlist Approved Template
  generateWaitlistApproved(data: Booking) {
    const { eventDate, seatLabels, ticketId, qrCode, user } = data;
    const u = user as User;

    const content = `
    <div class="header">
      <img src="${this.getLogo()}" alt="Logo" class="logo">
    </div>

    <h1 class="title" style="color: #10b981;">You're Confirmed!</h1>

    <p class="subtitle">
      Great news! You've been moved from the waiting list to a confirmed attendee for 
      <strong>The Morayo Show</strong>.
    </p>

    <div class="details-section">
      <h2 class="details-title">New Booking Details</h2>
      <div class="detail-row">
        <span class="detail-label">Date </span>
        <span class="detail-value">${formatDate(eventDate)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Seat(s)</span>
        <span class="detail-value">${Array.isArray(seatLabels) ? seatLabels.join(", ") : seatLabels}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Booking ID</span>
        <span class="detail-value" style="font-family: monospace;">${ticketId}</span>
      </div>
    </div>

    ${
      qrCode
        ? `
      <div class="qr-section">
        <img src="${qrCode}" alt="QR Code" class="qr-code">
        <p style="margin-top: 10px; color: #6b7280; font-size: 14px;">
          Please present this QR code at the venue
        </p>
      </div>
    `
        : ""
    }

    <div class="footer">
      <p>We look forward to seeing you!<br/><strong>The Morayo Show Team</strong></p>
      ${u.email ? `<p>This email was sent to ${u.email}</p>` : ""}
    </div>
  `;

    return this.generateBaseTemplate(content);
  }

  // Payment Link Email Template
  generatePaymentLinkEmail(user: { name: string; email: string }, priceNGN: number, priceUSD: number, paymentLinkNGN: string | undefined, paymentLinkUSD: string | undefined, eventDates: Date[], extraDetails?: { hallName?: string, originalPriceNGN?: number, numBookings?: number }) {
    const datesStr = eventDates.map(d => formatDate(d)).join(", ");
    
    let paymentDetailsHtml = '';
    
    if (extraDetails?.hallName) {
      paymentDetailsHtml += `
      <div class="detail-row" style="margin-top: 15px;">
        <span class="detail-label">Hall / Location</span>
        <span class="detail-value">${extraDetails.hallName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Number of Bookings</span>
        <span class="detail-value">${extraDetails.numBookings || eventDates.length}</span>
      </div>
      `;
    }

    if (priceNGN > 0 && paymentLinkNGN) {
      if (extraDetails?.originalPriceNGN && extraDetails.originalPriceNGN > priceNGN) {
        paymentDetailsHtml += `
        <div class="detail-row" style="margin-top: 15px;">
          <span class="detail-label">Original Price (NGN)</span>
          <span class="detail-value" style="text-decoration: line-through; color: #ef4444;">₦ ${extraDetails.originalPriceNGN.toLocaleString()}</span>
        </div>
        `;
      }
      paymentDetailsHtml += `
      <div class="detail-row" style="margin-top: 15px; font-weight: bold;">
        <span class="detail-label">Amount Due (NGN)</span>
        <span class="detail-value" style="color: #10b981;">₦ ${priceNGN.toLocaleString()}</span>
      </div>
      <div class="info-section" style="text-align: center; margin-top: 10px;">
        <a href="${paymentLinkNGN}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
          Pay with Paystack (NGN)
        </a>
        <p style="margin-top: 10px; font-size: 12px; color: #6b7280; word-break: break-all;">
          Or copy link: <a href="${paymentLinkNGN}" style="color: #3b82f6;">${paymentLinkNGN}</a>
        </p>
      </div>
      `;
    }

    // if (priceUSD > 0 && paymentLinkUSD) {
    //   paymentDetailsHtml += `
    //   <div class="detail-row" style="margin-top: 15px;">
    //     <span class="detail-label">Amount Due (USD)</span>
    //     <span class="detail-value">$ ${priceUSD.toLocaleString()}</span>
    //   </div>
    //   <div class="info-section" style="text-align: center; margin-top: 10px;">
    //     <a href="${paymentLinkUSD}" style="display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
    //       Pay with Flutterwave (USD)
    //     </a>
    //     <p style="margin-top: 10px; font-size: 12px; color: #6b7280; word-break: break-all;">
    //       Or copy link: <a href="${paymentLinkUSD}" style="color: #f59e0b;">${paymentLinkUSD}</a>
    //     </p>
    //   </div>
    //   `;
    // }

    const content = `
    <div class="header">
      <img src="${this.getLogo()}" alt="Logo" class="logo">
    </div>

    <p style="font-size: 16px; color: #374151;">Hi ${user.name.split(' ')[0]},</p>

    <p style="font-size: 16px; color: #374151;">
      Thank you for registering for the Morayo Show Tour!
    </p>
    
    <p style="font-size: 16px; color: #374151;">
      Congratulations! 🎉 You are one of our Early Bird Registrants, which means you’ve been offered an exclusive discount on your ticket.
    </p>

    <p style="font-size: 16px; color: #374151;">
      Your early bird offer is currently reserved for you. To confirm your attendance and secure your seat, please complete your payment using the link below:
    </p>

    <div class="details-section" style="margin-top: 20px;">
      <h2 class="details-title">Booking Details</h2>
      <div class="detail-row">
        <span class="detail-label">Date(s)</span>
        <span class="detail-value">${datesStr}</span>
      </div>
      ${paymentDetailsHtml}
    </div>

    <div class="info-section" style="margin-top: 20px;">
      <p style="font-size: 14px; color: #ef4444; font-weight: bold;">
        Please note that your payment link will remain active for 7 days. If payment is not completed within this period, your early bird offer and registration may be forfeited, and your seat will no longer be guaranteed.
      </p>
    </div>

    <p style="font-size: 16px; color: #374151; margin-top: 20px;">
      We can’t wait to have you join us for the Morayo Show Tour.
    </p>

    <div class="footer" style="margin-top: 30px;">
      <p>See you there!<br/><strong>The Morayo Show Tour Team</strong></p>
      <p>This email was sent to ${user.email}</p>
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

  // Payment Expiration Email Template
  generatePaymentExpirationEmail(user: { name: string; email: string }, eventDates: Date[]) {
    const datesStr = eventDates.map(d => formatDate(d)).join(", ");
    
    const content = `
    <div class="header">
      <img src="${this.getLogo()}" alt="Logo" class="logo">
    </div>

    <h1 class="title" style="color: #ef4444;">Reservation Expired</h1>

    <p class="subtitle">
      Hi ${user.name}, your seat reservation for <strong>The Morayo Show</strong> on ${datesStr} has expired.
    </p>

    <div class="info-section">
      <p style="font-size: 14px; color: #4b5563;">
        Because payment was not completed within the 30-minute window, the seats have been released back to the available pool. 
      </p>
      <p style="font-size: 14px; color: #4b5563; margin-top: 15px;">
        If you would still like to attend, please visit our website to start a new reservation.
      </p>
    </div>

    <div class="footer">
      <p>Need help? <a href="mailto:info@mabstudios.com">Contact our support team</a>.</p>
      <p>&copy; ${new Date().getFullYear()} The Morayo Show. All rights reserved.</p>
    </div>
    `;
    
    return this.generateBaseTemplate(content);
  }
}

// Usage Examples and Export
const emailTemplates = new EmailTemplateBuilder();

module.exports = {
  EmailTemplateBuilder,
  emailTemplates,
};
