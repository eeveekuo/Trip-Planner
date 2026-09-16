import { Activity, Trip } from '../types';
import { formatTime12h, timeStringToMinutes } from './geo';

/**
 * Formats a Date and "HH:mm" time string into standard iCalendar UTC/Local timestamp format: YYYYMMDDTHHMMSS
 */
function toICalDate(dateStr: string, timeStr: string): string {
  // dateStr is "YYYY-MM-DD", timeStr is "HH:mm"
  const cleanDate = dateStr.replace(/-/g, '');
  const cleanTime = timeStr.replace(/:/g, '') + '00';
  return `${cleanDate}T${cleanTime}`;
}

/**
 * Calculates end time string from start time and duration
 */
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const startM = timeStringToMinutes(startTime);
  const endM = startM + durationMinutes;
  const hours = Math.floor(endM / 60);
  const minutes = endM % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Generates an .ics file string from a finalized Trip
 */
export function generateICS(trip: Trip): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Google AI Studio//Trip Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${trip.title}`,
    `X-WR-TIMEZONE:UTC`,
  ];

  trip.days.forEach((day) => {
    day.activities.forEach((activity) => {
      const endTime = calculateEndTime(activity.startTime, activity.durationMinutes);
      const dtStart = toICalDate(day.date, activity.startTime);
      const dtEnd = toICalDate(day.date, endTime);
      const uid = `act-${activity.id}-${day.date}@tripplanner.app`;

      const desc = [
        `Trip: ${trip.title} (Day ${day.dayNumber})`,
        `Location: ${activity.location.name}`,
        `Address: ${activity.location.address}`,
        activity.notes ? `Notes: ${activity.notes}` : '',
        activity.businessHours ? `Hours: ${activity.businessHours.open} - ${activity.businessHours.close}` : '',
        activity.travelToNext ? `Next stop travel: ${activity.travelToNext.durationMinutes}m (${activity.travelToNext.mode})` : '',
      ]
        .filter(Boolean)
        .join('\\n');

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
      lines.push(`SUMMARY:${activity.title} - ${trip.destination}`);
      lines.push(`LOCATION:${activity.location.name}, ${activity.location.address}`);
      lines.push(`DESCRIPTION:${desc}`);
      if (activity.location.lat && activity.location.lng) {
        lines.push(`GEO:${activity.location.lat};${activity.location.lng}`);
      }
      lines.push('STATUS:CONFIRMED');
      lines.push('END:VEVENT');
    });
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Triggers a browser download for the .ics file
 */
export function downloadICS(trip: Trip): void {
  const icsData = generateICS(trip);
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.setAttribute('download', `${trip.title.replace(/\s+/g, '_')}_itinerary.ics`);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Generates a direct Google Calendar Web link for an individual activity
 */
export function createGoogleCalendarUrl(activity: Activity, dateStr: string, tripTitle: string): string {
  const endTime = calculateEndTime(activity.startTime, activity.durationMinutes);
  const startStamp = toICalDate(dateStr, activity.startTime);
  const endStamp = toICalDate(dateStr, endTime);

  const text = encodeURIComponent(`${activity.title} (${tripTitle})`);
  const dates = `${startStamp}/${endStamp}`;
  const details = encodeURIComponent(
    `${activity.notes || ''}\n\nVenue: ${activity.location.name}\nBusiness Hours: ${activity.businessHours.open} - ${activity.businessHours.close}`
  );
  const location = encodeURIComponent(`${activity.location.name}, ${activity.location.address}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
}
