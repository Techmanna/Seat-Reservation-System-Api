import { NotificationType } from '../models/Notification';

export interface NotificationResponseDto {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
    isRead: boolean;
    createdAt: string;
}

export interface NotificationListDto {
    notifications: NotificationResponseDto[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
}

export interface UpdateNotificationPreferenceDto {
    reminders?: {
        inApp?: boolean;
        email?: boolean;
        sms?: boolean;
    };
    events?: {
        inApp?: boolean;
        email?: boolean;
        sms?: boolean;
    };
    billing?: {
        inApp?: boolean;
        email?: boolean;
        sms?: boolean;
    };
}

export interface NotificationPreferenceResponseDto {
    reminders: {
        inApp: boolean;
        email: boolean;
        sms: boolean;
    };
    events: {
        inApp: boolean;
        email: boolean;
        sms: boolean;
    };
    billing: {
        inApp: boolean;
        email: boolean;
        sms: boolean;
    };
}
