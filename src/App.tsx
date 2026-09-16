import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Companion, TravelLeg, Trip, TripDay } from './types';
import { INITIAL_TRIPS } from './data/defaultTrips';
import { 
  loadTripFromLocalStorage, 
  saveTripToLocalStorage, 
  loadAllTrips, 
  deleteTripFromLocalStorage 
} from './utils/storage';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { Navbar } from './components/Navbar';
import { GoogleMapView } from './components/Map/GoogleMapView';
import { TimelineView } from './components/Timeline/TimelineView';
import { ActivityModal } from './components/ActivityModal';
import { FinalizeExportModal } from './components/FinalizeExportModal';
import { ShareModal } from './components/ShareModal';
import { OfflineManagerModal } from './components/OfflineManager';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ApiKeyModal } from './components/ApiKeyModal';
import { TripSelectorModal } from './components/TripSelectorModal';
import { TransitDetailsModal } from './components/TransitDetailsModal';
import { Map, Calendar, Plus } from 'lucide-react';

const SESSION_ID = `sess-${Math.random().toString(36).substring(2, 9)}`;

export default function App() {
  const { isOnline, isSimulatedOffline, setOfflineSimulated } = useOnlineStatus();

  // All available trips (seeded from defaults and loaded from localStorage)
  const [allTrips, setAllTrips] = useState<Trip[]>(() => loadAllTrips(INITIAL_TRIPS));

  // Load initial trip: check URL query param first, then localStorage, then default
  const [trip, setTrip] = useState<Trip>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTripId = params.get('trip');
    if (urlTripId) {
      const cached = loadTripFromLocalStorage(urlTripId);
      if (cached) return cached;
    }
    const defaultCached = loadTripFromLocalStorage(INITIAL_TRIPS[0].id);
    return defaultCached || INITIAL_TRIPS[0];
  });

  const [activeDayId, setActiveDayId] = useState<string>(trip.days[0]?.id || 'day-1');
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    trip.days[0]?.activities[0]?.id || null
  );

  // Responsive mobile view tab switcher (timeline vs map)
  const [mobileTab, setMobileTab] = useState<'timeline' | 'map'>('timeline');

  // Modals state
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isTripSelectorOpen, setIsTripSelectorOpen] = useState(false);

  // Transit Details Modal state
  const [transitModalData, setTransitModalData] = useState<{
    isOpen: boolean;
    fromActivity: Activity | null;
    toActivity: Activity | null;
    leg: TravelLeg | null;
  }>({
    isOpen: false,
    fromActivity: null,
    toActivity: null,
    leg: null,
  });

  // Google Maps API Key handling
  const [apiKey, setApiKey] = useState<string>(() => {
    const fromEnv = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
    const stored = localStorage.getItem('trip_planner_gmap_key');
    return stored || fromEnv;
  });

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('trip_planner_gmap_key', key);
  };

  // Synchronize trip changes to localStorage and backend API for real-time companion sharing
  const syncTrip = useCallback((newTrip: Trip) => {
    setTrip(newTrip);
    saveTripToLocalStorage(newTrip);

    // Also update allTrips array
    setAllTrips((prev) => {
      const idx = prev.findIndex((t) => t.id === newTrip.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newTrip;
        return copy;
      }
      return [...prev, newTrip];
    });

    // If online, broadcast to backend API for real-time companion sync
    if (isOnline) {
      fetch(`/api/trips/${newTrip.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip: newTrip, sessionId: SESSION_ID }),
      }).catch(() => {
        // Silently ignore if running client-only
      });
    }
  }, [isOnline]);

  // Real-time Server-Sent Events (SSE) companion sync listener
  useEffect(() => {
    if (!isOnline) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/trips/${trip.id}/stream`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'TRIP_UPDATED' && data.senderSessionId !== SESSION_ID) {
            if (data.trip) {
              setTrip(data.trip);
              saveTripToLocalStorage(data.trip);
            }
          }
        } catch (e) {
          // ignore parsing error
        }
      };
    } catch (err) {
      // SSE not available or offline
    }

    return () => {
      eventSource?.close();
    };
  }, [trip.id, isOnline]);

  // Active day lookup
  const activeDay = trip.days.find((d) => d.id === activeDayId) || trip.days[0];

  // Handler to update an activity
  const handleUpdateActivity = (updatedAct: Activity) => {
    const updatedDays = trip.days.map((day) => {
      if (day.id !== activeDay.id) return day;
      return {
        ...day,
        activities: day.activities.map((a) => (a.id === updatedAct.id ? updatedAct : a)),
      };
    });

    syncTrip({
      ...trip,
      days: updatedDays,
      updatedAt: new Date().toISOString(),
    });
  };

  // Handler to delete an activity from current day
  const handleDeleteActivity = (activityId: string) => {
    const updatedDays = trip.days.map((day) => {
      if (day.id !== activeDay.id) return day;
      return {
        ...day,
        activities: day.activities.filter((a) => a.id !== activityId),
      };
    });

    syncTrip({
      ...trip,
      days: updatedDays,
      updatedAt: new Date().toISOString(),
    });

    if (selectedActivityId === activityId) {
      setSelectedActivityId(null);
    }
  };

  // Add activity directly into the Activity Shelf
  const handleAddToShelf = (newActivity: Activity) => {
    const currentShelf = trip.shelfActivities || [];
    const updatedTrip: Trip = {
      ...trip,
      shelfActivities: [newActivity, ...currentShelf],
      updatedAt: new Date().toISOString(),
    };
    syncTrip(updatedTrip);
  };

  // Drag or schedule an activity from the shelf onto the active day's agenda
  const handleDropFromShelf = (activity: Activity, targetStartTime: string) => {
    const currentShelf = trip.shelfActivities || [];
    const remainingShelf = currentShelf.filter((a) => a.id !== activity.id);

    const scheduledActivity: Activity = {
      ...activity,
      startTime: targetStartTime,
    };

    const updatedDays = trip.days.map((day) => {
      if (day.id !== activeDay.id) return day;
      return {
        ...day,
        activities: [...day.activities, scheduledActivity],
      };
    });

    syncTrip({
      ...trip,
      days: updatedDays,
      shelfActivities: remainingShelf,
      updatedAt: new Date().toISOString(),
    });

    setSelectedActivityId(scheduledActivity.id);
  };

  // Move a scheduled activity back to the Activity Shelf (unschedule)
  const handleMoveToShelf = (activityId: string) => {
    const act = activeDay.activities.find((a) => a.id === activityId);
    if (!act) return;

    const updatedDays = trip.days.map((day) => {
      if (day.id !== activeDay.id) return day;
      return {
        ...day,
        activities: day.activities.filter((a) => a.id !== activityId),
      };
    });

    const shelfAct: Activity = {
      ...act,
      startTime: '',
    };

    const currentShelf = trip.shelfActivities || [];

    syncTrip({
      ...trip,
      days: updatedDays,
      shelfActivities: [shelfAct, ...currentShelf],
      updatedAt: new Date().toISOString(),
    });

    if (selectedActivityId === activityId) {
      setSelectedActivityId(null);
    }
  };

  // Remove activity from shelf
  const handleDeleteShelfActivity = (activityId: string) => {
    const currentShelf = trip.shelfActivities || [];
    const remainingShelf = currentShelf.filter((a) => a.id !== activityId);
    syncTrip({
      ...trip,
      shelfActivities: remainingShelf,
      updatedAt: new Date().toISOString(),
    });
  };

  // Add new day to trip
  const handleAddDay = () => {
    const nextDayNum = trip.days.length + 1;
    const newDay: TripDay = {
      id: `day-${Date.now()}`,
      dayNumber: nextDayNum,
      date: `2026-10-${12 + nextDayNum - 1}`,
      title: `Day ${nextDayNum} Itinerary`,
      activities: [],
    };

    const updatedTrip = {
      ...trip,
      days: [...trip.days, newDay],
    };
    syncTrip(updatedTrip);
    setActiveDayId(newDay.id);
  };

  // Add companion
  const handleAddCompanion = (companion: Companion) => {
    const updatedTrip = {
      ...trip,
      companions: [...trip.companions, companion],
    };
    syncTrip(updatedTrip);
  };

  // Trip selection and creation handlers
  const handleSelectTrip = (selected: Trip) => {
    setTrip(selected);
    setActiveDayId(selected.days[0]?.id || 'day-1');
    setSelectedActivityId(selected.days[0]?.activities[0]?.id || null);
    saveTripToLocalStorage(selected);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('trip', selected.id);
    window.history.pushState({}, '', newUrl.toString());
  };

  const handleCreateTrip = (newTrip: Trip) => {
    saveTripToLocalStorage(newTrip);
    setAllTrips((prev) => [newTrip, ...prev]);
    handleSelectTrip(newTrip);
  };

  const handleDeleteTrip = (tripId: string) => {
    deleteTripFromLocalStorage(tripId);
    setAllTrips((prev) => prev.filter((t) => t.id !== tripId));
    if (trip.id === tripId) {
      const remaining = allTrips.filter((t) => t.id !== tripId);
      if (remaining.length > 0) {
        handleSelectTrip(remaining[0]);
      } else {
        handleSelectTrip(INITIAL_TRIPS[0]);
      }
    }
  };

  // Open Transit Route Modal
  const handleOpenTransitModal = (fromActivity: Activity, toActivity: Activity, leg: TravelLeg) => {
    setTransitModalData({
      isOpen: true,
      fromActivity,
      toActivity,
      leg,
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <Navbar
        trip={trip}
        activeDayId={activeDay.id}
        onSelectDay={(dayId) => {
          setActiveDayId(dayId);
          const targetDay = trip.days.find((d) => d.id === dayId);
          if (targetDay && targetDay.activities.length > 0) {
            setSelectedActivityId(targetDay.activities[0].id);
          }
        }}
        onAddDay={handleAddDay}
        onOpenFinalizeModal={() => setIsFinalizeModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenOfflineModal={() => setIsOfflineModalOpen(true)}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        onOpenTripSelector={() => setIsTripSelectorOpen(true)}
        isOnline={isOnline}
        hasGoogleApiKey={Boolean(apiKey)}
      />

      {/* Mobile Day Selector Bar (below header on small screens) */}
      <div className="md:hidden flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {trip.days.map((day) => {
            const isActive = day.id === activeDay.id;
            return (
              <button
                key={day.id}
                onClick={() => setActiveDayId(day.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Day {day.dayNumber}
              </button>
            );
          })}
          <button
            onClick={handleAddDay}
            className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile View Toggle: Timeline vs Map */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setMobileTab('timeline')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
              mobileTab === 'timeline'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Timeline</span>
          </button>
          <button
            onClick={() => setMobileTab('map')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
              mobileTab === 'map'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span>Map</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Split-view on desktop, tabs on mobile */}
      <div className="flex-1 relative overflow-hidden flex flex-col md:grid md:grid-cols-12">
        {/* Left Column: 12 AM - 11:59 PM Timeline + Activity Shelf */}
        <div
          className={`h-full md:col-span-6 lg:col-span-5 flex flex-col overflow-hidden ${
            mobileTab === 'timeline' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <TimelineView
            day={activeDay}
            shelfActivities={trip.shelfActivities || []}
            selectedActivityId={selectedActivityId}
            onSelectActivity={(id) => setSelectedActivityId(id)}
            onUpdateActivity={handleUpdateActivity}
            onDeleteActivity={handleDeleteActivity}
            onAddActivityClick={() => setIsActivityModalOpen(true)}
            onDropFromShelf={handleDropFromShelf}
            onMoveToShelf={handleMoveToShelf}
            onDeleteShelfActivity={handleDeleteShelfActivity}
            onOpenTransitModal={handleOpenTransitModal}
          />
        </div>

        {/* Right Column: Google Maps View with Native Transit Connections (no bottom agenda) */}
        <div
          className={`h-full md:col-span-6 lg:col-span-7 flex flex-col overflow-hidden ${
            mobileTab === 'map' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <GoogleMapView
            apiKey={apiKey}
            activities={activeDay.activities}
            selectedActivityId={selectedActivityId}
            onSelectActivity={(id) => setSelectedActivityId(id)}
            isOffline={!isOnline}
            destinationName={trip.destination}
            center={trip.center}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
            onOpenTransitModal={handleOpenTransitModal}
          />
        </div>
      </div>

      {/* Floating Offline Mode Indicator Banner */}
      <OfflineIndicator
        isOnline={isOnline}
        onManageOffline={() => setIsOfflineModalOpen(true)}
      />

      {/* Modals */}
      <ActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        onAddToShelf={handleAddToShelf}
        tripDestination={trip.destination}
        tripCenter={trip.center}
        apiKey={apiKey}
        isOffline={!isOnline}
      />

      <TransitDetailsModal
        isOpen={transitModalData.isOpen}
        onClose={() => setTransitModalData((prev) => ({ ...prev, isOpen: false }))}
        fromActivity={transitModalData.fromActivity}
        toActivity={transitModalData.toActivity}
        leg={transitModalData.leg}
        apiKey={apiKey}
        isOffline={!isOnline}
      />

      <TripSelectorModal
        isOpen={isTripSelectorOpen}
        onClose={() => setIsTripSelectorOpen(false)}
        currentTripId={trip.id}
        trips={allTrips}
        onSelectTrip={handleSelectTrip}
        onCreateTrip={handleCreateTrip}
        onDeleteTrip={handleDeleteTrip}
      />

      <FinalizeExportModal
        isOpen={isFinalizeModalOpen}
        onClose={() => setIsFinalizeModalOpen(false)}
        trip={trip}
        onOpenShareModal={() => setIsShareModalOpen(true)}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        trip={trip}
        onAddCompanion={handleAddCompanion}
      />

      <OfflineManagerModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        trip={trip}
        isOnline={isOnline}
        isSimulatedOffline={isSimulatedOffline}
        onToggleSimulatedOffline={setOfflineSimulated}
        onTripOfflineSaved={(updated) => setTrip(updated)}
      />

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        currentApiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
      />
    </div>
  );
}
