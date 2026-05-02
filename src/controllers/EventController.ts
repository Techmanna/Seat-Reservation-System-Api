import { Request, Response } from 'express';
import { EventModel } from '../models/Event';
import { EventDTO } from '../dtos/event.dto';

export class EventController {
    public static async getNextEvent(req: Request, res: Response): Promise<void> {
        try {
            const now = new Date();

            // Fetch active events from the last 2 days onwards (by date field's date part only).
            // We fetch a wider window and then filter in code using the `time` field,
            // because the actual show time lives in event.time (e.g. "14:00"), not in the
            // time component of the stored ISO date string.
            const twoDaysAgo = new Date(now);
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            twoDaysAgo.setHours(0, 0, 0, 0);

            const candidates = await EventModel.find({
                isActive: true,
                date: { $gte: twoDaysAgo }
            })
                .sort({ date: 1 })
                .limit(10)
                .lean();

            // Reconstruct the real event datetime using the event's date (date part) + time field
            const withRealTime = candidates.map(event => {
                const datePart = new Date(event.date).toISOString().split('T')[0];
                const realEventDate = new Date(`${datePart}T${event.time}:00`);
                return { ...event, _realEventDate: realEventDate };
            });

            // "Current" = started within the last 4 hours and not yet 4 hours past its start time
            const WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours
            const currentEvent = withRealTime.find(e =>
                e._realEventDate.getTime() <= now.getTime() &&
                now.getTime() <= e._realEventDate.getTime() + WINDOW_MS
            ) || null;

            // "Next" = all events strictly in the future (after now)
            const nextEvents = withRealTime.filter(e =>
                e._realEventDate.getTime() > now.getTime()
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
