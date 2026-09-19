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

/**
 * Computes a smooth chronological gradient color across the events of a day
 * from morning (sapphire blue) -> midday (indigo/violet) -> afternoon (magenta/rose) -> evening (sunset orange).
 */
export function getChronologicalColor(index: number, total: number): string {
  if (total <= 1) return '#2563eb';
  const palette = [
    '#2563eb', // Morning Sapphire Blue
    '#0284c7', // Sky Blue
    '#4f46e5', // Royal Indigo
    '#7c3aed', // Purple
    '#9333ea', // Violet
    '#c026d3', // Fuchsia
    '#e11d48', // Rose
    '#ea580c', // Sunset Amber
  ];
  const t = Math.max(0, Math.min(1, index / (total - 1)));
  const colorIdx = Math.round(t * (palette.length - 1));
  return palette[colorIdx];
}

/**
 * Builds a direct Google Maps native Web Directions URL linking all activities in order.
 * Users can open this URL directly in Google Maps and save it to their saved lists.
 */
export function buildGoogleMapsPlaceUrl(name: string, address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}`)}`;
}

export function buildGoogleMapsDirectionsUrl(activities: Activity[]): string {
  if (activities.length === 0) return 'https://www.google.com/maps';
  if (activities.length === 1) {
    const act = activities[0];
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${act.location.name}, ${act.location.address}`
    )}`;
  }

  const encodedStops = activities.map((a) =>
    encodeURIComponent(`${a.location.name}, ${a.location.address}`)
  );

  return `https://www.google.com/maps/dir/${encodedStops.join('/')}`;
}

/**
 * Builds direct Google Maps native Web Directions URL specifically between two activities.
 */
export function buildGoogleMapsLegDirectionsWebUrl(
  fromActivity: Activity,
  toActivity: Activity,
  mode: TransportationMode | string = 'TRANSIT'
): string {
  const origin = encodeURIComponent(`${fromActivity.location.name}, ${fromActivity.location.address}`);
  const destination = encodeURIComponent(`${toActivity.location.name}, ${toActivity.location.address}`);
  const dirMode = mode.toLowerCase() === 'drive' ? 'driving' : mode.toLowerCase() === 'walk' ? 'walking' : mode.toLowerCase() === 'bicycle' ? 'bicycling' : 'transit';
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${dirMode}`;
}

/**
 * Builds a Google Maps Embed directions URL between two specific activities for a clicked transit route.
 */
export function buildGoogleMapsEmbedLegDirectionsUrl(
  fromActivity: Activity,
  toActivity: Activity,
  mode: TransportationMode | string = 'TRANSIT',
  apiKey: string = '',
  useCloudKey: boolean = false
): string {
  const originStr = encodeURIComponent(`${fromActivity.location.name}, ${fromActivity.location.address}`);
  const destStr = encodeURIComponent(`${toActivity.location.name}, ${toActivity.location.address}`);
  const m = mode.toUpperCase();

  const cloudMode = m === 'DRIVE' ? 'driving' : m === 'WALK' ? 'walking' : m === 'BICYCLE' ? 'bicycling' : 'transit';

  if (useCloudKey && apiKey && apiKey.trim().length > 5) {
    return `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${originStr}&destination=${destStr}&mode=${cloudMode}`;
  }

  // Universal directions embed:
  // dirflg: 'r' for transit, 'd' for driving, 'w' for walking, 'b' for bicycling
  let dirflg = 'r';
  if (m === 'DRIVE') dirflg = 'd';
  else if (m === 'WALK') dirflg = 'w';
  else if (m === 'BICYCLE') dirflg = 'b';

  return `https://maps.google.com/maps?saddr=${originStr}&daddr=${destStr}&dirflg=${dirflg}&output=embed`;
}

/**
 * Builds a Google Maps Embed Area Overview URL showing all places listed for that day.
 */
export function buildGoogleMapsEmbedAreaOverviewUrl(
  activities: Activity[],
  destinationName: string = '',
  apiKey: string = '',
  useCloudKey: boolean = false
): string {
  if (activities.length === 0) {
    const q = encodeURIComponent(destinationName || 'Tokyo, Japan');
    return useCloudKey && apiKey && apiKey.trim().length > 5
      ? `https://www.google.com/maps/embed/v1/search?key=${apiKey}&q=${q}`
      : `https://maps.google.com/maps?q=${q}&output=embed`;
  }

  if (activities.length === 1) {
    const act = activities[0];
    const q = encodeURIComponent(`${act.location.name}, ${act.location.address}`);
    return useCloudKey && apiKey && apiKey.trim().length > 5
      ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${q}`
      : `https://maps.google.com/maps?q=${q}&output=embed`;
  }

  // Combine top places or create search query for the day's places
  const placeNames = activities.map((a) => a.location.name).slice(0, 4).join(' ');
  const query = `${placeNames} ${destinationName}`.trim();
  const q = encodeURIComponent(query);

  if (useCloudKey && apiKey && apiKey.trim().length > 5) {
    return `https://www.google.com/maps/embed/v1/search?key=${apiKey}&q=${q}`;
  }
  return `https://maps.google.com/maps?q=${q}&output=embed`;
}

/**
 * Builds a Google Maps Embed directions URL.
 * By default (useCloudKey = false), generates a Universal Google Maps Embed URL
 * which requires NO Google Cloud Console API activations and will never fail with "API is not activated".
 * If useCloudKey = true and a valid API key is present, uses the Google Cloud Embed API v1.
 */
export function buildGoogleMapsEmbedDirectionsUrl(
  activities: Activity[],
  apiKey: string = '',
  mode: string = 'transit',
  useCloudKey: boolean = false
): string {
  if (activities.length === 0) {
    return useCloudKey && apiKey && apiKey.trim().length > 5
      ? `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=35.6762,139.6503&zoom=13`
      : `https://maps.google.com/maps?q=Tokyo&output=embed`;
  }

  if (activities.length === 1) {
    const act = activities[0];
    const q = encodeURIComponent(`${act.location.name}, ${act.location.address}`);
    return useCloudKey && apiKey && apiKey.trim().length > 5
      ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${q}`
      : `https://maps.google.com/maps?q=${q}&output=embed`;
  }

  const origin = activities[0];
  const destination = activities[activities.length - 1];
  const waypoints = activities.slice(1, -1);

  const originStr = encodeURIComponent(`${origin.location.name}, ${origin.location.address}`);
  const destStr = encodeURIComponent(`${destination.location.name}, ${destination.location.address}`);

  if (useCloudKey && apiKey && apiKey.trim().length > 5) {
    let url = `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${originStr}&destination=${destStr}&mode=${mode}`;
    if (waypoints.length > 0) {
      const waypointsStr = waypoints
        .slice(0, 8)
        .map((w) => encodeURIComponent(`${w.location.name}, ${w.location.address}`))
        .join('|');
      url += `&waypoints=${waypointsStr}`;
    }
    return url;
  }

  // Universal Google Maps embed directions (100% active, no cloud API enablement required)
  return `https://maps.google.com/maps?saddr=${originStr}&daddr=${destStr}&output=embed`;
}

/**
 * Builds a Google Maps Embed single place URL
 */
export function buildGoogleMapsEmbedPlaceUrl(
  name: string,
  address: string,
  apiKey: string = '',
  useCloudKey: boolean = false
): string {
  const q = encodeURIComponent(`${name}, ${address}`);
  if (useCloudKey && apiKey && apiKey.trim().length > 5) {
    return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${q}`;
  }
  return `https://maps.google.com/maps?q=${q}&output=embed`;
}

/**
 * Builds a Google Maps Embed search URL
 */
export function buildGoogleMapsEmbedSearchUrl(
  query: string, 
  apiKey: string = '',
  useCloudKey: boolean = false
): string {
  const q = encodeURIComponent(query);
  if (useCloudKey && apiKey && apiKey.trim().length > 5) {
    return `https://www.google.com/maps/embed/v1/search?key=${apiKey}&q=${q}`;
  }
  return `https://maps.google.com/maps?q=${q}&output=embed`;
}

