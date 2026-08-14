import { createDailyEventsAndZoom, addSubscriberToUpcomingEvents } from './eventCreationJob';
import { checkAndCleanupExpiredSubscriptions, sendExpirationReminders } from './subscriptionJob';
import { sendHallExpirationReminders } from './hallJob';
import { processWaitlists } from './waitlistJob';

export class CronService {
    public static async addSubscriberToUpcomingEvents(email: string): Promise<void> {
        return addSubscriberToUpcomingEvents(email);
    }

    public static startBackgroundJobs(): void {
        // Run immediately on startup
        createDailyEventsAndZoom();
        checkAndCleanupExpiredSubscriptions();
        processWaitlists();

        // Then re-run every 12 hours
        setInterval(() => {
            createDailyEventsAndZoom();
            checkAndCleanupExpiredSubscriptions();
            sendExpirationReminders();
            sendHallExpirationReminders();
        }, 12 * 60 * 60 * 1000);

        // Run waitlist processing every hour
        setInterval(() => {
            processWaitlists();
        }, 60 * 60 * 1000);
    }
}
