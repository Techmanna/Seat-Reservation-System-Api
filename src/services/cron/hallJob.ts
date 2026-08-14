import { HallModel } from '../../models/Hall';
import { sendEmail } from '../../utils/email';
import { logger } from '../../utils/logger';

export async function sendHallExpirationReminders(): Promise<void> {
    try {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Find halls where reservationCloseDate is between now and 24 hours from now
        const expiringHalls = await HallModel.find({
            reservationCloseDate: {
                $gt: now,
                $lte: tomorrow
            }
        });

        for (const hall of expiringHalls) {
            // Here we might want to check if a reminder has already been sent, 
            // but for simplicity, we'll just send an email. In a robust system, 
            // we'd add a flag like 'expirationReminderSent' to the Hall model.
            await sendEmail({
                to: 'info@mabstudios.org',
                subject: `Urgent: Hall Reservation Closing Soon - ${hall.name}`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>Hall Reservation Closing Soon</h2>
                        <p>The reservation period for the hall <strong>${hall.name}</strong> is scheduled to close within 24 hours.</p>
                        <p><strong>Close Date:</strong> ${hall.reservationCloseDate.toLocaleString()}</p>
                        <p>Please log in to the admin dashboard to review or extend the reservation period if necessary.</p>
                    </div>
                `
            });
            logger.info(`[CronService] Sent expiration reminder for hall ${hall.name}`);
        }
    } catch (error) {
        logger.error('[CronService] Hall expiration reminder failed:', error);
    }
}
