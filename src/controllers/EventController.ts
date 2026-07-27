import { Request, Response } from 'express';
import { EventModel } from '../models/Event';
import { EventDTO } from '../dtos/event.dto';
import { DateTime } from 'luxon';

export class EventController {
    public static async getNextEvent(req: Request, res: Response): Promise<void> {
        try {
            const LAGOS_ZONE = 'Africa/Lagos';
            const now = DateTime.now().setZone(LAGOS_ZONE);

            // Fetch active events from the last 2 days onwards
            const twoDaysAgo = now.minus({ days: 2 }).startOf('day').toJSDate();

            const candidates = await EventModel.find({
                isActive: true,
                date: { $gte: twoDaysAgo }
            })
                .sort({ date: 1 })
                .limit(10)
                .lean();

            // Reconstruct the real event datetimes in Lagos timezone
            const withRealTime = candidates.map(event => {
                // Get the date part based on Lagos timezone
                const datePart = DateTime.fromJSDate(new Date(event.date), { zone: LAGOS_ZONE }).toFormat('yyyy-MM-dd');
                
                // Reconstruct start and end times in Lagos context
                const startDateTime = DateTime.fromISO(`${datePart}T${event.time}`, { zone: LAGOS_ZONE });
                
                // Use endTime if exists, otherwise fallback to 4 hours after start
                const endDateTime = event.endTime 
                    ? DateTime.fromISO(`${datePart}T${event.endTime}`, { zone: LAGOS_ZONE })
                    : startDateTime.plus({ hours: 4 });

                return { 
                    ...event, 
                    _startDateTime: startDateTime.toJSDate(),
                    _endDateTime: endDateTime.toJSDate()
                };
            });

            const nowJs = now.toJSDate();

            // "Current" = now is between start and end time
            const currentEvent = withRealTime.find(e =>
                nowJs >= e._startDateTime && nowJs < e._endDateTime
            ) || null;

            // "Next" = all events starting after now, excluding the current one if it exists
            const nextEvents = withRealTime.filter(e =>
                e._startDateTime > nowJs && e._id.toString() !== currentEvent?._id?.toString()
            );

            res.json({
                success: true,
                message: "Events retrieved successfully",
                data: {
                    currentEvent: currentEvent ? EventDTO.toResponse(currentEvent) : null,
                    nextEvents: nextEvents.map(e => EventDTO.toResponse(e)),
                },
            });
        } catch (error: any) {
            console.error("Get events error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch events",
                error: error.message,
            });
        }
    }
}
