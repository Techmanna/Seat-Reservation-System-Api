import { format as formatTz, fromZonedTime, toZonedTime } from 'date-fns-tz';

// The physical event is held in Nigeria (WAT = Africa/Lagos = UTC+1)
// All event dates are stored in UTC. The CronService converts to WAT to build the
// absolute event start timestamp, then stores it in UTC so every client on earth
// can derive their own local time from the single ISO string.
export const EVENT_TIMEZONE = process.env.EVENT_TIMEZONE || 'Africa/Lagos';
export const EVENT_HOUR_WAT = parseInt(process.env.EVENT_TIME_HOUR || '11', 10);
export const EVENT_MINUTE_WAT = parseInt(process.env.EVENT_TIME_MINUTE || '0', 10);

export const getEventStartTime = (): string => {
  return `${String(EVENT_HOUR_WAT).padStart(2, '0')}:${String(EVENT_MINUTE_WAT).padStart(2, '0')}`;
}

export const getEventEndTime = (durationHours: number = 2): string => {
  return `${String((EVENT_HOUR_WAT + durationHours) % 24).padStart(2, '0')}:${String(EVENT_MINUTE_WAT).padStart(2, '0')}`;
}


export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date");
    }
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid date";
  }
};


/**
 * Build the absolute UTC Date for the event on a given calendar day.
 * Example: 2026-04-29 with 11:00 WAT  →  2026-04-29T10:00:00Z
 */
export const buildEventUtcDate = (calendarDay: Date): Date => {
  // 1. Get the date part (YYYY-MM-DD) for the given day in the target timezone
  const datePart = formatTz(calendarDay, 'yyyy-MM-dd', { timeZone: EVENT_TIMEZONE });

  // 2. Combine with the target event time
  const timePart = `${String(EVENT_HOUR_WAT).padStart(2, '0')}:${String(EVENT_MINUTE_WAT).padStart(2, '0')}:00`;

  // 3. Convert this local "wall clock" time to an absolute UTC Date
  // This is much safer than manual offset math which depends on the server's local time.
  return fromZonedTime(`${datePart} ${timePart}`, EVENT_TIMEZONE);
}

/**
 * Format an absolute UTC event date into a user's local timezone with a friendly label.
 * e.g.  "Tuesday, 6:00 AM (EST)"  or  "Tuesday, 11:00 AM (WAT)"
 */
export const formatEventTimeForUser = (eventUtcDate: Date, userTimezone: string): string => {
    try {
        const fmt = 'EEEE, h:mm a';
        const zoneAbbr = new Intl.DateTimeFormat('en-US', { timeZone: userTimezone, timeZoneName: 'short' })
            .formatToParts(eventUtcDate)
            .find(p => p.type === 'timeZoneName')?.value || userTimezone;
        const localDate = toZonedTime(eventUtcDate, userTimezone);
        return `${formatTz(localDate, fmt, { timeZone: userTimezone })} (${zoneAbbr})`;
    } catch {
        // Fall back to WAT if the stored timezone is invalid
        const localDate = toZonedTime(eventUtcDate, EVENT_TIMEZONE);
        return `${formatTz(localDate, 'EEEE, h:mm a', { timeZone: EVENT_TIMEZONE })} (WAT)`;
    }
}
