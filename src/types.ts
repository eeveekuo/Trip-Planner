export type TransportationMode = 'DRIVE' | 'TRANSIT' | 'WALK' | 'BICYCLE';

export interface TransitDetails {
  lineName: string; // e.g. "Bus 02", "Toei Bus 都02", "Tokyo Metro Ginza Line"
  lineNumber?: string; // e.g. "02", "G"
  vehicleType: 'BUS' | 'SUBWAY' | 'TRAIN' | 'TRAM' | 'FERRY';
  departureStop: string;
  arrivalStop: string;
  numStops: number;
  headwayMinutes?: number; // frequency e.g. every 8 mins
  departureTime?: string;
  arrivalTime?: string;
  steps?: string[];
  operator?: string;
  fare?: string;
}

export interface BusinessHours {
  open: string; // "09:00" in 24h
  close: string; // "18:00" in 24h
  isOpenToday: boolean;
  is24Hours?: boolean;
  rawText?: string;
  daysOpen?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

export interface LocationInfo {
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
  rating?: number;
  userRatingCount?: number;
  photoUrl?: string;
  phone?: string;
  website?: string;
  googleMapsUrl?: string;
}

export interface TravelLeg {
  mode: TransportationMode;
  durationMinutes: number;
  distanceKm: number;
  distanceText: string;
  summary?: string;
  transitDetails?: TransitDetails;
}

export interface Activity {
  id: string;
  title: string;
  category: 'sightseeing' | 'dining' | 'culture' | 'shopping' | 'relaxation' | 'entertainment' | 'transport';
  location: LocationInfo;
  businessHours: BusinessHours;
  startTime: string; // "09:30" (24h format HH:mm), empty if on shelf
  durationMinutes: number; // e.g. 90 (1.5 hours)
  notes?: string;
  costEstimate?: string;
  color?: string;
  travelToNext?: TravelLeg;
}

export interface TripDay {
  id: string;
  dayNumber: number;
  date: string; // "YYYY-MM-DD"
  title: string;
  activities: Activity[];
}

export interface Companion {
  id: string;
  name: string;
  email?: string;
  avatar: string;
  color: string;
  isOnline: boolean;
  lastActive: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  center: {
    lat: number;
    lng: number;
  };
  zoom: number;
  startDate: string;
  endDate: string;
  days: TripDay[];
  shelfActivities?: Activity[]; // Shared across various days
  companions: Companion[];
  isFinalized: boolean;
  finalizedAt?: string;
  offlineSaved?: boolean;
  offlineCachedAt?: string;
  updatedAt: string;
}

export interface GoogleMapsList {
  id: string; // 'shelf' | day.id
  title: string;
  type: 'shelf' | 'day';
  dayId?: string;
  dayNumber?: number;
  activityCount: number;
  activities: Activity[];
  googleMapsUrl: string;
}

export interface BusinessHoursValidation {
  isConflict: boolean;
  startsBeforeOpen: boolean;
  endsAfterClose: boolean;
  isClosedDay: boolean;
  message?: string;
  overflowMinutes: number;
  suggestedStartTime?: string;
  suggestedDurationMinutes?: number;
}

export interface SelectedTransitRoute {
  fromActivity: Activity;
  toActivity: Activity;
  leg: TravelLeg;
  dayId?: string;
}
