import { Activity, BusinessHours, BusinessHoursValidation, TransportationMode, TravelLeg } from '../types';

/**
 * Calculates straight-line distance in kilometers using the Haversine formula
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Estimates travel duration based on mode and road network curvature factor,
 * including detailed transit (buses, subways) routing metadata.
 */
export function estimateTravelLeg(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  mode: TransportationMode = 'DRIVE',
  fromName?: string,
  toName?: string
): TravelLeg {
  const straightDistance = calculateDistanceKm(fromLat, fromLng, toLat, toLng);
  
  // Real world route distance factor (urban road network factor ~1.25x - 1.4x)
  const routeFactor = mode === 'WALK' ? 1.2 : 1.35;
  const actualKm = Math.max(0.2, Math.round(straightDistance * routeFactor * 10) / 10);

  let minutes = 0;
  let summary = '';
  let transitDetails: TravelLeg['transitDetails'];

  const originName = fromName || 'Current Location';
  const destName = toName || 'Next Destination';

  switch (mode) {
    case 'DRIVE':
      minutes = Math.max(5, Math.round((actualKm / 32) * 60 + 4));
      summary = `${actualKm} km drive via main avenue`;
      break;
    case 'TRANSIT': {
      minutes = Math.max(8, Math.round((actualKm / 24) * 60 + 7));
      const busLines = ['Bus 02 (City Loop)', 'Bus 42 Express', 'Bus 08 (East-West)', 'Bus 16 MetroLink'];
      const pickedBus = busLines[Math.abs(Math.round(fromLat * 100 + toLng * 100)) % busLines.length];
      const stops = Math.max(2, Math.round(actualKm * 1.8));

      summary = `${pickedBus} (${stops} stops, ${minutes}m)`;
      transitDetails = {
        lineName: pickedBus,
        lineNumber: pickedBus.split(' ')[1] || '02',
        vehicleType: 'BUS',
        departureStop: `${originName} Stop`,
        arrivalStop: `${destName} Station`,
        numStops: stops,
        headwayMinutes: 8,
        operator: 'Metropolitan Transit Bus',
        fare: '$2.25 (Standard fare)',
        steps: [
          `Walk 2 mins (~140m) to ${originName} Bus Stop`,
          `Board ${pickedBus} toward ${destName}`,
          `Ride for ${stops} stops (~${Math.max(5, minutes - 4)} mins)`,
          `Alight at ${destName} Station`,
          `Walk 2 mins (~120m) to ${destName}`,
        ],
      };
      break;
    }
    case 'WALK':
      minutes = Math.max(3, Math.round((actualKm / 4.5) * 60));
      summary = `${actualKm} km scenic walk`;
      break;
    case 'BICYCLE':
      minutes = Math.max(4, Math.round((actualKm / 15) * 60 + 2));
      summary = `${actualKm} km bike path`;
      break;
  }

  const distanceText = actualKm < 1 ? `${Math.round(actualKm * 1000)} m` : `${actualKm} km`;

  return {
    mode,
    durationMinutes: minutes,
    distanceKm: actualKm,
    distanceText,
    summary,
    transitDetails,
  };
}

/**
 * Converts "HH:mm" string to minutes from midnight
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Converts minutes from midnight to "HH:mm" string
 */
export function minutesToTimeString(totalMinutes: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Formats "HH:mm" into a friendly 12-hour string (e.g. "9:30 AM", "4:15 PM")
 */
export function formatTime12h(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m.toString().padStart(2, '0');
  return `${displayH}:${displayM} ${period}`;
}

/**
 * Formats minutes into hours & mins (e.g. 90 -> "1h 30m")
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Validates whether an activity duration and time slot falls within the allowable business hours
 */
export function validateBusinessHours(activity: Activity, dayOfWeekIndex?: number): BusinessHoursValidation {
  const { businessHours, startTime, durationMinutes } = activity;

  if (!businessHours || businessHours.is24Hours) {
    return {
      isConflict: false,
      startsBeforeOpen: false,
      endsAfterClose: false,
      isClosedDay: false,
      overflowMinutes: 0,
    };
  }

  // Check if closed on this specific day of week if specified
  if (
    dayOfWeekIndex !== undefined &&
    businessHours.daysOpen &&
    !businessHours.daysOpen.includes(dayOfWeekIndex)
  ) {
    return {
      isConflict: true,
      startsBeforeOpen: false,
      endsAfterClose: false,
      isClosedDay: true,
      message: `Location is closed on this day of the week. (${businessHours.rawText || 'Check schedule'})`,
      overflowMinutes: durationMinutes,
    };
  }

  const startM = timeStringToMinutes(startTime);
  const endM = startM + durationMinutes;

  const openM = timeStringToMinutes(businessHours.open);
  const closeM = timeStringToMinutes(businessHours.close);

  const startsBeforeOpen = startM < openM;
  const endsAfterClose = endM > closeM;

  if (!startsBeforeOpen && !endsAfterClose) {
    return {
      isConflict: false,
      startsBeforeOpen: false,
      endsAfterClose: false,
      isClosedDay: false,
      overflowMinutes: 0,
    };
  }

  let overflow = 0;
  const messages: string[] = [];

  if (startsBeforeOpen) {
    const earlyBy = openM - startM;
    overflow += earlyBy;
    messages.push(`Starts ${formatDuration(earlyBy)} before opening (${formatTime12h(businessHours.open)})`);
  }

  if (endsAfterClose) {
    const lateBy = endM - closeM;
    overflow += lateBy;
    messages.push(`Extends ${formatDuration(lateBy)} past closing (${formatTime12h(businessHours.close)})`);
  }

  // Suggest allowable slot: fit within open - close
  const maxAllowableDuration = Math.max(30, closeM - openM);
  const suggestedStart = startsBeforeOpen ? businessHours.open : minutesToTimeString(Math.min(startM, closeM - 30));
  const suggestedDuration = Math.min(durationMinutes, maxAllowableDuration);

  return {
    isConflict: true,
    startsBeforeOpen,
    endsAfterClose,
    isClosedDay: false,
    message: messages.join(' & '),
    overflowMinutes: overflow,
    suggestedStartTime: suggestedStart,
    suggestedDurationMinutes: suggestedDuration,
  };
}
