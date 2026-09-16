import { Trip } from '../types';

const STORAGE_KEY_PREFIX = 'trip_planner_';
const ACTIVE_TRIP_KEY = `${STORAGE_KEY_PREFIX}active_id`;
const ALL_TRIPS_INDEX_KEY = `${STORAGE_KEY_PREFIX}all_trips_index`;
const OFFLINE_CACHE_PREFIX = `${STORAGE_KEY_PREFIX}offline_cache_`;
const OFFLINE_MAP_TILES_PREFIX = `${STORAGE_KEY_PREFIX}map_tiles_`;

export function saveTripToLocalStorage(trip: Trip): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}trip_${trip.id}`;
    localStorage.setItem(key, JSON.stringify(trip));
    localStorage.setItem(ACTIVE_TRIP_KEY, trip.id);

    // Update all trips index
    const allIds = getStoredTripIds();
    if (!allIds.includes(trip.id)) {
      localStorage.setItem(ALL_TRIPS_INDEX_KEY, JSON.stringify([...allIds, trip.id]));
    }
  } catch (err) {
    console.error('Failed to save trip to localStorage:', err);
  }
}

export function getStoredTripIds(): string[] {
  try {
    const raw = localStorage.getItem(ALL_TRIPS_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function loadAllTrips(defaultTrips: Trip[] = []): Trip[] {
  try {
    const ids = getStoredTripIds();
    if (ids.length === 0) {
      // Initialize with default trips
      defaultTrips.forEach((t) => saveTripToLocalStorage(t));
      localStorage.setItem(ALL_TRIPS_INDEX_KEY, JSON.stringify(defaultTrips.map((t) => t.id)));
      return defaultTrips;
    }

    const loadedTrips: Trip[] = [];
    for (const id of ids) {
      const trip = loadTripFromLocalStorage(id);
      if (trip) loadedTrips.push(trip);
    }

    if (loadedTrips.length === 0) {
      return defaultTrips;
    }
    return loadedTrips;
  } catch {
    return defaultTrips;
  }
}

export function deleteTripFromLocalStorage(tripId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}trip_${tripId}`);
    localStorage.removeItem(`${OFFLINE_CACHE_PREFIX}${tripId}`);
    const ids = getStoredTripIds().filter((id) => id !== tripId);
    localStorage.setItem(ALL_TRIPS_INDEX_KEY, JSON.stringify(ids));
  } catch (err) {
    console.error('Failed to delete trip from localStorage:', err);
  }
}

export function loadTripFromLocalStorage(tripId: string): Trip | null {
  try {
    const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}trip_${tripId}`);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Failed to load trip from localStorage:', err);
    return null;
  }
}

export function getActiveTripId(): string | null {
  return localStorage.getItem(ACTIVE_TRIP_KEY);
}

/**
 * Saves full offline itinerary package including pins, places, travel calculations, and static map cache info
 */
export function saveTripForOfflineUse(trip: Trip): { success: boolean; cachedAt: string; itemCount: number } {
  try {
    const cachedAt = new Date().toISOString();
    const offlineTrip: Trip = {
      ...trip,
      offlineSaved: true,
      offlineCachedAt: cachedAt,
    };

    saveTripToLocalStorage(offlineTrip);

    // Save dedicated offline bundle with precomputed bounds and coordinates
    const offlinePackage = {
      trip: offlineTrip,
      cachedAt,
      version: 1,
      totalActivities: offlineTrip.days.reduce((acc, d) => acc + d.activities.length, 0),
    };

    localStorage.setItem(`${OFFLINE_CACHE_PREFIX}${trip.id}`, JSON.stringify(offlinePackage));

    return {
      success: true,
      cachedAt,
      itemCount: offlinePackage.totalActivities,
    };
  } catch (err) {
    console.error('Failed to save trip for offline:', err);
    return {
      success: false,
      cachedAt: '',
      itemCount: 0,
    };
  }
}

export function getOfflinePackage(tripId: string): { trip: Trip; cachedAt: string; totalActivities: number } | null {
  try {
    const raw = localStorage.getItem(`${OFFLINE_CACHE_PREFIX}${tripId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
