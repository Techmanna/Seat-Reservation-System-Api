import mongoose, { Document, Types } from "mongoose";
import { Request } from 'express';

export interface User {
    _id?: string;
    name: string;
    email: string;
    phone: string;
    gender: 'male' | 'female' | 'other';
    ageRange: '18-25' | '26-35' | '36-45' | '46-55' | '55+';
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Event {
    _id?: string;
    date: Date;
    time: string;
    totalSeats: number;
    availableSeats: number;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    location?:string;
    sessionName?:string;
}

export enum BookingStatus {
    Attending = 'attending',
    Cancelled = 'cancelled',
    Attended = 'attended',
    Voided = 'voided',
}

export interface Booking {
    _id?: string;
    ticketId: string;
    user: mongoose.Schema.Types.ObjectId | User;
    event: mongoose.Schema.Types.ObjectId | Event;
    eventDate: Date;
    seatNumbers: number[];
    seatLabels: String[],
    status: BookingStatus;
    qrCode: string;
    reservationToken: string;
    createdAt?: Date;
    updatedAt?: Date;
    cancelledAt?:Date;
    calendarLink?: string;
    attendedAt?: Date;
}

// export interface Admin {
//     _id?: string;
//     username: string;
//     email: string;
//     password: string;
//     role: 'admin' | 'superadmin';
//     createdAt?: Date;
//     updatedAt?: Date;
//     lastLogin?: Date;
// }

export interface Admin extends Document {
    _id: Types.ObjectId;

    username: string;
    email: string;
    password: string;
    role: 'admin' | 'superadmin';
    phone?: string;
    isActive: boolean;
    lastLogin?: Date;
    passwordChangedAt?: Date;
    resetPasswordToken?: string;
    resetPasswordExpiry?: Date;
    createdBy?: Types.ObjectId;
    loginAttempts: number;
    lockUntil?: Date;

    // Virtuals
    isLocked: boolean;

    // Methods
    comparePassword(candidatePassword: string): Promise<boolean>;
    incLoginAttempts(): Promise<void>;
    resetLoginAttempts(): Promise<void>;
}

export interface SystemSettings {
    _id?: string;
    reservationOpenDate: Date;
    reservationCloseDate: Date;
    defaultTotalSeats: number;
    seatCapacityOverrides?: {
        date: Date;
        totalSeats: number;
    }[];
    eventTimes: string[];
    workingDays: number[]; // 1-5 for Monday to Friday
    maxSeatsPerUser: number;
    createdAt?: Date;
    updatedAt?: Date;
    blockedDates?: Date[];
    minCancellationHours?: number;
}

export interface BookingRequest {
    eventDate: string|Date;
    seatNumbers: number[];
    name: string;
    email: string;
    phone: string;
    gender: 'male' | 'female' | 'other';
    ageRange: '18-25' | '26-35' | '36-45' | '46-55' | '55+';
    seatLabels: string[];
    reservationToken: string;
}

export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
    meta?: Record<string, any>
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface CreateAdminRequest {
    username: string;
    email: string;
    password: string;
    role: 'admin' | 'superadmin';
    phone?: string;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export interface ResetPasswordRequest {
    token: string;
    newPassword: string;
}

export interface ForgotPasswordRequest {
    email: string;
}

export interface AdminLoginRequest {
    username: string;
    password: string;
}

export interface AuthRequest extends Request {
    admin?: any;
}

export interface PendingBooking {
    tempId: string;
    bookingData: BookingRequest;
    createdAt: Date;
    expiresAt: Date;
}

export interface OTPVerificationRequest {
    email: string;
    otp: string;
    tempId: string;
    reservationToken: string;
}

export interface CancelBookingRequest {
    ticketId: string;
    reservationToken: string;
    email?: string; // Optional for additional validation
}

export interface NotificationFilter {
    eventDate?: string;
    ageRange?: '18-25' | '26-35' | '36-45' | '46-55' | '55+';
    gender?: 'male' | 'female' | 'other';
    status?: BookingStatus[];
}

export interface NotificationRequest {
    type: 'email' | 'sms' | 'both';
    subject?: string; // For email notifications
    message: string;
    filters: NotificationFilter;
    sendImmediately?: boolean;
}

export interface NotificationJob {
    _id?: string;
    type: 'email' | 'sms' | 'both';
    subject?: string;
    message: string;
    recipients: {
        userId: string;
        name: string;
        email?: string;
        phone?: string;
    }[];
    status: 'pending' | 'processing' | 'completed' | 'failed';
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    createdAt?: Date;
    updatedAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
}

