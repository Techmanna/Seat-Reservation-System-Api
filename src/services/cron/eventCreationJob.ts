import { EventModel } from '../../models/Event';
import { SubscriptionModel } from '../../models/Subscription';
import { SubscriptionStatus } from '../../types/subscription.type';
import { ZoomService } from '../ZoomService';
import { sendEmail } from '../../utils/email';
import { buildEventUtcDate, EVENT_TIMEZONE, formatEventTimeForUser, getEventEndTime, getEventStartTime, getLagosEndOfDay, getLagosStartOfDay } from '../../utils/formatDate';
import { SeatUtils } from '../../utils/seat';
import { getSystemSettings } from '../SettingsService';
import { DateTime } from 'luxon';
import { parseUserName } from '../../utils/user';
import { NotificationService } from '../NotificationService';
import { NotificationType } from '../../models/Notification';
import { logger } from '../../utils/logger';

const notificationService = new NotificationService();

export async function sendZoomAccessEmail(firstName: string, email: string, localEventTime: string, date: Date): Promise<void> {
    try {
        await sendEmail({
            to: email,
            subject: `Your Zoom Access — The Morayo Show · ${localEventTime}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div style="background: linear-gradient(135deg, #E8593C 0%, #764ba2 100%); padding: 24px; text-align: center; color: white;">
                        <h2 style="margin: 0; font-size: 24px;">The Morayo Show — Live Access</h2>
                    </div>
                    <div style="padding: 24px; background-color: #ffffff;">
                        <p style="font-size: 16px;">Hello ${firstName},</p>
                        <p>You are registered for today's live session. Here are your details:</p>
                        <div style="background-color: #f8f9fa; border-left: 4px solid #E8593C; padding: 16px; margin: 20px 0; border-radius: 4px;">
                            <p style="margin: 6px 0;"><strong>📅 Event Time (your local time):</strong> ${localEventTime}</p>
                            <p style="margin: 6px 0;"><strong>🌍 Also in WAT:</strong> ${formatEventTimeForUser(date, EVENT_TIMEZONE)}</p>
                            <p style="margin: 6px 0;"><strong>🔗 Join URL:</strong><br/>
                                    <a href="${process.env.FRONTEND_URL}/waiting" style="color: #E8593C; word-break: break-all;">${process.env.FRONTEND_URL}/waiting</a>
                            </p>
                        </div>
                        <p style="color: #7f8c8d; font-size: 13px;">
                        If you can no longer make it, you can cancel your subscription on your dashboard.
                        </p>
                    </div>
                </div>
            `
        });
    } catch (error) {
        logger.error(`[CronService] Failed to send email to ${email}:`, error);
    }
}

export async function sendWelcomeEmail(email: string, localEventTime: string): Promise<void> {
    try {
        await sendEmail({
            to: email,
            subject: `Welcome! Your Zoom access for The Morayo Show — ${localEventTime}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 10px; overflow: hidden;">
                    <div style="background: linear-gradient(135deg, #E8593C 0%, #764ba2 100%); padding: 24px; text-align: center; color: white;">
                        <h2 style="margin: 0;">The Morayo Show — You're In!</h2>
                    </div>
                    <div style="padding: 24px; background-color: #ffffff;">
                        <p>Your subscription is active and here is today's join link:</p>
                        <div style="background-color: #f8f9fa; border-left: 4px solid #E8593C; padding: 16px; margin: 20px 0; border-radius: 4px;">
                            <p style="margin: 6px 0;"><strong>📅 Start Time:</strong> ${localEventTime}</p>
                            <p style="margin: 6px 0;"><strong>🔗 Join URL:</strong><br/>
                                <a href="${process.env.FRONTEND_URL}/waiting" style="color: #E8593C; word-break: break-all;">${process.env.FRONTEND_URL}/waiting</a>
                            </p>
                        </div>
                        <p style="color: #7f8c8d; font-size: 13px;">
                            If you can no longer make it, you can cancel your subscription on your dashboard.
                        </p>
                    </div>
                </div>
            `
        });
    } catch (error) {
        logger.error(`[CronService] Failed to send welcome email to ${email}:`, error);
    }
}

export async function createDailyEventsAndZoom(): Promise<void> {
    if (process.env.NODE_ENV === 'development') return;
    try {
        // Look ahead 2 days: ensure events exist for today, tomorrow, and the day after
        for (let i = 0; i <= 2; i++) {
            const targetDay = DateTime.now().setZone(EVENT_TIMEZONE).plus({ days: i }).toJSDate();
            const dayStart = getLagosStartOfDay(targetDay);
            const dayEnd = getLagosEndOfDay(targetDay);

            // Absolute UTC start for this event (11:00 WAT = 10:00 UTC)
            const eventUtcDate = buildEventUtcDate(dayStart);

            const title = `The Morayo Show Live - ${eventUtcDate.toDateString()}`;

            const settings = await getSystemSettings();

            // Validation boundaries
            const targetLuxon = DateTime.fromJSDate(targetDay).setZone(EVENT_TIMEZONE);
            const isWithinRange = targetDay >= settings.reservationOpenDate && targetDay <= settings.reservationCloseDate;
            const isWorkingDay = settings.workingDays.includes(targetLuxon.weekday);
            const isBlocked = settings.blockedDates?.some(bd =>
                getLagosStartOfDay(bd).getTime() === dayStart.getTime()
            );

            if (!isWithinRange || !isWorkingDay || isBlocked) {
                logger.info(`[CronService] Skipping event creation for ${targetLuxon.toISODate()}: Boundary restriction.`);
                continue;
            }

            // Find or create the event
            let event = await EventModel.findOne({
                hall: settings._id,
                date: { $gte: dayStart, $lte: dayEnd }
            });

            const currentTotalSeats = SeatUtils.resolveTotalSeats(settings as any, dayStart);

            if (!event) {
                event = await EventModel.create({
                    hall: settings._id,
                    date: eventUtcDate,
                    time: getEventStartTime(),
                    endTime: getEventEndTime(),
                    totalSeats: currentTotalSeats,
                    availableSeats: currentTotalSeats,
                    isActive: true,
                    title
                });
            } else if (event.totalSeats !== currentTotalSeats) {
                const diff = currentTotalSeats - event.totalSeats;
                event.totalSeats = currentTotalSeats;
                event.availableSeats += diff;
                await event.save();
            }

            if (!event.endTime || (event.date.getUTCHours() === 0 && event.date.getUTCMinutes() === 0)) {
                // Backfill legacy events or fix incorrect midnight UTC dates
                event.date = eventUtcDate;
                event.endTime = getEventEndTime();
                await event.save();
            }

            // Create Zoom meeting if missing
            if (!event.zoomMeetingId) {
                try {
                    const zoomData = await ZoomService.createMeeting(
                        title,
                        eventUtcDate,
                        EVENT_TIMEZONE
                    );
                    event.zoomMeetingId = zoomData.id;
                    event.zoomMeetingUrl = zoomData.join_url;
                    event.zoomPassword = zoomData.password;
                    await event.save();

                    // Notify all active subscribers about the new event
                    // We do this for the next day's event if created
                    const activeSubs = await SubscriptionModel.find({ status: SubscriptionStatus.ACTIVE });
                    for (const sub of activeSubs) {
                        notificationService.notify(
                            sub.userId.toString(),
                            NotificationType.EVENT,
                            'New Event Scheduled',
                            `A new event "${event.title || 'The Morayo Show'}" has been scheduled for ${eventUtcDate.toDateString()}.`,
                            { eventId: event._id }
                        );
                    }
                } catch (zoomError) {
                    logger.error(`[CronService] Zoom creation failed for ${eventUtcDate}:`, zoomError);
                    continue;
                }
            }

            // Only register attendees and send emails for TODAY's event
            if (i === 0) {
                const activeSubscriptions = await SubscriptionModel.find({
                    status: SubscriptionStatus.ACTIVE,
                    currentPeriodEnd: { $gte: targetDay }
                }).populate('user', 'name'); // <-- Populate the user document

                for (const sub of activeSubscriptions) {
                    // Skip if already registered for this specific meeting (idempotent guard)
                    if (sub.lastZoomMeetingId === event.zoomMeetingId) continue;

                    try {
                        const { firstName, lastName } = parseUserName((sub as any).user?.name);

                        const zoomRegistrant = await ZoomService.registerMeetingAttendee(
                            event.zoomMeetingId!,
                            sub.email,
                            firstName,
                            lastName
                        );

                        // sub.zoomJoinUrl = zoomRegistrant.join_url;
                        sub.zoomRegistrantId = zoomRegistrant.registrant_id;
                        sub.lastZoomMeetingId = event.zoomMeetingId;
                        await sub.save();

                        // Record Event Registration History
                        try {
                            const { EventRegistrationModel } = require('../../models/EventRegistration');
                            await EventRegistrationModel.findOneAndUpdate(
                                { userId: sub.userId, eventId: event._id },
                                {
                                    email: sub.email,
                                    zoomMeetingId: event.zoomMeetingId,
                                    zoomRegistrantId: zoomRegistrant.registrant_id,
                                    zoomJoinUrl: zoomRegistrant.join_url,
                                    registrationType: 'daily_meeting'
                                },
                                { upsert: true, new: true }
                            );
                        } catch (historyError) {
                            logger.error("[CronService] Failed to record registration history:", historyError);
                        }

                        // Build localised time string for this subscriber
                        const userTz = sub.timezone || EVENT_TIMEZONE;
                        const localEventTime = formatEventTimeForUser(event.date, userTz);

                        // Send Zoom Access Email
                        await sendZoomAccessEmail(firstName, sub.email, localEventTime, event.date);
                    } catch (regError) {
                        logger.error(`[CronService] Attendee mapping failed for ${sub.email}:`, regError);
                    }
                }
            }
        }
    } catch (error) {
        logger.error('[CronService] Background sync execution failed:', error);
    }
}

export async function addSubscriberToUpcomingEvents(email: string): Promise<void> {
    try {
        const subscription = await SubscriptionModel.findOne({ email, status: SubscriptionStatus.ACTIVE }).populate('user', 'name');;
        if (!subscription) return;

        const today = DateTime.now().setZone(EVENT_TIMEZONE).toJSDate();
        const dayStart = getLagosStartOfDay(today);
        const dayEnd = getLagosEndOfDay(today);
        const eventUtcDate = buildEventUtcDate(dayStart);

        const settings = await getSystemSettings();
        const currentTotalSeats = SeatUtils.resolveTotalSeats(settings as any, dayStart);

        let event = await EventModel.findOne({
            hall: settings._id,
            date: { $gte: dayStart, $lte: dayEnd }
        });

        if (!event) {
            event = await EventModel.create({
                hall: settings._id,
                date: eventUtcDate,
                time: getEventStartTime(),
                endTime: getEventEndTime(),
                totalSeats: currentTotalSeats,
                availableSeats: currentTotalSeats,
                isActive: true
            });
        } else if (event.totalSeats !== currentTotalSeats) {
            const diff = currentTotalSeats - event.totalSeats;
            event.totalSeats = currentTotalSeats;
            event.availableSeats += diff;
            await event.save();
        }

        if (!event.zoomMeetingId) {
            const zoomData = await ZoomService.createMeeting(
                `The Morayo Show Live - ${eventUtcDate.toDateString()}`,
                eventUtcDate,
                EVENT_TIMEZONE
            );
            event.zoomMeetingId = zoomData.id;
            event.zoomMeetingUrl = zoomData.join_url;
            event.zoomPassword = zoomData.password;
            await event.save();
        }

        const { firstName, lastName } = parseUserName((subscription as any).user?.name);

        const zoomRegistrant = await ZoomService.registerMeetingAttendee(
            event.zoomMeetingId!,
            email,
            firstName,
            lastName
        );

        subscription.zoomJoinUrl = zoomRegistrant.join_url;
        subscription.zoomRegistrantId = zoomRegistrant.registrant_id;
        subscription.lastZoomMeetingId = event.zoomMeetingId;
        await subscription.save();

        // Record Event Registration History
        try {
            const { EventRegistrationModel } = require('../../models/EventRegistration');
            await EventRegistrationModel.findOneAndUpdate(
                { userId: subscription.userId, eventId: event._id },
                {
                    email: subscription.email,
                    zoomMeetingId: event.zoomMeetingId,
                    zoomRegistrantId: zoomRegistrant.registrant_id,
                    zoomJoinUrl: zoomRegistrant.join_url,
                    registrationType: 'daily_meeting'
                },
                { upsert: true, new: true }
            );
        } catch (historyError) {
            logger.error("[CronService] Failed to record registration history:", historyError);
        }

        const userTz = subscription.timezone || EVENT_TIMEZONE;
        const localEventTime = formatEventTimeForUser(event.date, userTz);

        // Send Welcome Email
        await sendWelcomeEmail(email, localEventTime);
    } catch (error) {
        logger.error(`[CronService] Immediate subscriber addition failed for ${email}:`, error);
    }
}
