import { DateTime } from 'luxon';

// The physical event is held in Nigeria (WAT = Africa/Lagos = UTC+1)
export const EVENT_TIMEZONE = process.env.EVENT_TIMEZONE || 'Africa/Lagos';
export const EVENT_HOUR_WAT = parseInt(process.env.EVENT_TIME_HOUR || '11', 10);
export const EVENT_MINUTE_WAT = parseInt(process.env.EVENT_TIME_MINUTE || '0', 10);

export const getEventStartTime = (): string => {
  return `${String(EVENT_HOUR_WAT).padStart(2, '0')}:${String(EVENT_MINUTE_WAT).padStart(2, '0')}`;
}

export const getEventEndTime = (durationHours: number = 2): string => {
  return `${String((EVENT_HOUR_WAT + durationHours) % 24).padStart(2, '0')}:${String(EVENT_MINUTE_WAT).padStart(2, '0')}`;
}

export const getLagosStartOfDay = (date: Date | string = new Date()): Date => {
  const dt = typeof date === 'string' ? DateTime.fromISO(date) : DateTime.fromJSDate(date);
  return dt.setZone(EVENT_TIMEZONE).startOf('day').toJSDate();
}

export const getLagosEndOfDay = (date: Date | string = new Date()): Date => {
  const dt = typeof date === 'string' ? DateTime.fromISO(date) : DateTime.fromJSDate(date);
  return dt.setZone(EVENT_TIMEZONE).endOf('day').toJSDate();
}

export const formatDate = (date: Date | string): string => {
  try {
    const dt = typeof date === 'string' ? DateTime.fromISO(date) : DateTime.fromJSDate(date);
    if (!dt.isValid) throw new Error("Invalid date");
    return dt.setLocale('en-US').toLocaleString(DateTime.DATE_FULL);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid date";
  }
};

/**
 * Build the absolute UTC Date for the event on a given calendar day.
 */
export const buildEventUtcDate = (calendarDay: Date): Date => {
  // Use Luxon to create a date in Lagos timezone and set the show time
  const dt = DateTime.fromJSDate(calendarDay).setZone(EVENT_TIMEZONE);
  const eventDt = dt.set({
    hour: EVENT_HOUR_WAT,
    minute: EVENT_MINUTE_WAT,
    second: 0,
    millisecond: 0
  });
  
  // This correctly accounts for daylight savings (though WAT doesn't have it)
  // and returns the underlying UTC point in time.
  return eventDt.toJSDate();
}

/**
 * Format an absolute UTC event date into a user's local timezone.
 */
export const formatEventTimeForUser = (eventUtcDate: Date, userTimezone: string): string => {
    try {
        const dt = DateTime.fromJSDate(eventUtcDate).setZone(userTimezone || EVENT_TIMEZONE);
        // Returns e.g. "Tuesday, May 2, 2026, 4:00 PM GMT+1"
        return dt.toLocaleString(DateTime.DATETIME_MED_WITH_WEEKDAY) + ` (${dt.offsetNameShort})`;
    } catch {
        const dt = DateTime.fromJSDate(eventUtcDate).setZone(EVENT_TIMEZONE);
        return dt.toLocaleString(DateTime.DATETIME_MED_WITH_WEEKDAY) + " (WAT)";
    }
}

