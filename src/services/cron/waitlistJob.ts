import { EventModel } from '../../models/Event';
import { getSystemSettings } from '../SettingsService';
import { EVENT_TIMEZONE } from '../../utils/formatDate';
import { DateTime } from 'luxon';
import { logger } from '../../utils/logger';

export async function processWaitlists(): Promise<void> {
    try {
        const settings = await getSystemSettings();
        if (!settings.prioritySystemEnabled) return;

        const now = DateTime.now().setZone(EVENT_TIMEZONE);
        const targetTime = now.plus({ hours: settings.autoAllocationHoursBeforeEvent });
        
        // Find all upcoming events that start within the auto-allocation window
        const events = await EventModel.find({
            date: { 
                $gt: now.toJSDate(), 
                $lte: targetTime.toJSDate() 
            }
        });

        if (events.length === 0) return;

        // Import BookingService dynamically to avoid circular dependency
        const { BookingService } = require('../BookingService');
        const bookingService = new BookingService();

        for (const event of events) {
            logger.info(`[CronService] Auto-allocating waitlist for event: ${event.title} (${event.date})`);
            await bookingService.allocateFromWaitlist(event._id.toString());
        }
    } catch (error) {
        logger.error('[CronService] Waitlist processing failed:', error);
    }
}
