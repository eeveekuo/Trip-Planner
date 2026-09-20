import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, Companion, TransportationMode, TravelLeg, Trip, TripDay, SelectedTransitRoute } from './types';
import { INITIAL_TRIPS } from './data/defaultTrips';
import { 
  loadTripFromLocalStorage, 
  saveTripToLocalStorage, 
  loadAllTrips, 
  deleteTripFromLocalStorage 
} from './utils/storage';
import { estimateTravelLeg, timeStringToMinutes, minutesToTimeString } from './utils/geo';
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
import { ShelfListView } from './components/Shelf/ShelfListView';
import { Map, Calendar, Plus, Layers, GripVertical } from 'lucide-react';

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
  const [activeListId, setActiveListId] = useState<string>(trip.days[0]?.id || 'day-1');
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    trip.days[0]?.activities[0]?.id || null
  );

  // Responsive mobile view tab switcher (timeline vs map)
  const [mobileTab, setMobileTab] = useState<'timeline' | 'map'>('timeline');

  // Modals state
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityModalTargetList, setActivityModalTargetList] = useState<string>('shelf');
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

  // Selected transit route to adjust the map and show turn-by-turn directions
  const [selectedTransitRoute, setSelectedTransitRoute] = useState<SelectedTransitRoute | null>(null);

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

  // Slideable split-view state (percentage width of schedule column on desktop)
  const containerRef = useRef<HTMLDivElement>(null);
  const [scheduleWidthPercent, setScheduleWidthPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('trip_planner_schedule_width');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 20 && val <= 75) {
          return val;
        }
      }
    } catch {
      // ignore
    }
    return 42; // default: 42% schedule / 58% map
  });
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);

  // Desktop media query check for responsive layout
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const updateMatches = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktop(e.matches);
    };
    updateMatches(mediaQuery);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateMatches);
      return () => mediaQuery.removeEventListener('change', updateMatches);
    } else {
      mediaQuery.addListener(updateMatches);
      return () => mediaQuery.removeListener(updateMatches);
    }
  }, []);

  // Window drag event listeners for the divider
  useEffect(() => {
    if (!isDraggingDivider) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      if (totalWidth <= 0) return;

      const offsetX = e.clientX - rect.left;
      const rawPercent = (offsetX / totalWidth) * 100;

      // Keep within bounds: min 280px left, min 340px right, and between 20% and 75%
      const minPercent = Math.max(20, (280 / totalWidth) * 100);
      const maxPercent = Math.min(75, ((totalWidth - 340) / totalWidth) * 100);
      const clamped = Math.min(Math.max(rawPercent, minPercent), maxPercent);

      setScheduleWidthPercent(clamped);
    };

    const handlePointerUp = () => {
      setIsDraggingDivider(false);
      setScheduleWidthPercent((prev) => {
        try {
          localStorage.setItem('trip_planner_schedule_width', String(Math.round(prev)));
        } catch {
          // ignore
        }
        return prev;
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDraggingDivider]);

  const handleResetDivider = () => {
    setScheduleWidthPercent(42);
    try {
      localStorage.setItem('trip_planner_schedule_width', '42');
    } catch {
      // ignore
    }
  };

  const handleDividerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setScheduleWidthPercent((prev) => {
        const next = Math.max(20, prev - 2);
        try { localStorage.setItem('trip_planner_schedule_width', String(Math.round(next))); } catch {}
        return next;
      });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setScheduleWidthPercent((prev) => {
        const next = Math.min(75, prev + 2);
        try { localStorage.setItem('trip_planner_schedule_width', String(Math.round(next))); } catch {}
        return next;
      });
    } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Home') {
      e.preventDefault();
      handleResetDivider();
    }
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

  // Add an activity to a specified Google Maps List (Day List or Activity Shelf List)
  const handleAddActivityToList = (newActivity: Activity, targetListId: string, startTime?: string) => {
    if (targetListId === 'shelf') {
      handleAddToShelf(newActivity);
      return;
    }

    const updatedDays = trip.days.map((day) => {
      if (day.id !== targetListId) return day;
      const actWithTime: Activity = {
        ...newActivity,
        startTime: startTime || '09:30',
      };
      return {
        ...day,
        activities: [...day.activities, actWithTime],
      };
    });

    syncTrip({
      ...trip,
      days: updatedDays,
      updatedAt: new Date().toISOString(),
    });
    setSelectedActivityId(newActivity.id);
  };

  // Move / Transfer an activity between any Google Maps Lists (Drop from list A, Add to list B)
  const handleMoveActivityToList = (activityId: string, fromListId: string, toListId: string) => {
    if (fromListId === toListId) return;

    // Find the source activity
    let foundAct: Activity | undefined;
    if (fromListId === 'shelf') {
      foundAct = (trip.shelfActivities || []).find((a) => a.id === activityId);
    } else {
      const fromDay = trip.days.find((d) => d.id === fromListId);
      foundAct = fromDay?.activities.find((a) => a.id === activityId);
    }

    if (!foundAct) return;

    // 1. Remove from source list
    let updatedShelf = trip.shelfActivities || [];
    let updatedDays = [...trip.days];

    if (fromListId === 'shelf') {
      updatedShelf = updatedShelf.filter((a) => a.id !== activityId);
    } else {
      updatedDays = updatedDays.map((d) => {
        if (d.id !== fromListId) return d;
        return {
          ...d,
          activities: d.activities.filter((a) => a.id !== activityId),
        };
      });
    }

    // 2. Add to target list
    if (toListId === 'shelf') {
      const unscheduled: Activity = { ...foundAct, startTime: '' };
      updatedShelf = [unscheduled, ...updatedShelf];
    } else {
      const toDay = trip.days.find((d) => d.id === toListId);
      let nextStart = '09:30';
      if (toDay && toDay.activities.length > 0) {
        const lastAct = toDay.activities[toDay.activities.length - 1];
        const endM = timeStringToMinutes(lastAct.startTime || '09:00') + lastAct.durationMinutes + 30;
        nextStart = minutesToTimeString(Math.min(22 * 60, endM));
      }
      const scheduled: Activity = { ...foundAct, startTime: nextStart };

      updatedDays = updatedDays.map((d) => {
        if (d.id !== toListId) return d;
        return {
          ...d,
          activities: [...d.activities, scheduled],
        };
      });
    }

    syncTrip({
      ...trip,
      days: updatedDays,
      shelfActivities: updatedShelf,
      updatedAt: new Date().toISOString(),
    });
    setSelectedActivityId(activityId);
  };

  // Dedicated List Selection (Day 1 List, Day 2 List..., Activity Shelf List)
  const handleSelectList = (listId: string) => {
    setActiveListId(listId);
    setSelectedTransitRoute(null);
    if (listId === 'shelf') {
      if (trip.shelfActivities && trip.shelfActivities.length > 0) {
        setSelectedActivityId(trip.shelfActivities[0].id);
      }
    } else if (listId !== 'all') {
      setActiveDayId(listId);
      const targetDay = trip.days.find((d) => d.id === listId);
      if (targetDay && targetDay.activities.length > 0) {
        setSelectedActivityId(targetDay.activities[0].id);
      }
    }
  };

  // Schedule activity directly from Shelf onto a specific Day List
  const handleScheduleToDay = (activity: Activity, targetDayId: string, customStartTime?: string) => {
    const newShelf = (trip.shelfActivities || []).filter((a) => a.id !== activity.id);

    let start = customStartTime || '10:00';
    if (!customStartTime) {
      const targetDay = trip.days.find((d) => d.id === targetDayId);
      if (targetDay && targetDay.activities.length > 0) {
        const lastAct = targetDay.activities[targetDay.activities.length - 1];
        const endM = timeStringToMinutes(lastAct.startTime || '09:00') + lastAct.durationMinutes + 30;
        start = minutesToTimeString(Math.min(22 * 60, endM));
      }
    }

    const scheduledAct: Activity = { ...activity, startTime: start };

    const newDays = trip.days.map((d) => {
      if (d.id !== targetDayId) return d;
      return {
        ...d,
        activities: [...d.activities, scheduledAct],
      };
    });

    syncTrip({
      ...trip,
      days: newDays,
      shelfActivities: newShelf,
      updatedAt: new Date().toISOString(),
    });
    setSelectedActivityId(activity.id);
    setActiveListId(targetDayId);
    setActiveDayId(targetDayId);
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
    setActiveListId(newDay.id);
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
    const initialListId = selected.days[0]?.id || 'day-1';
    setActiveDayId(initialListId);
    setActiveListId(initialListId);
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

  // Select transit route to adjust the map on the right side
  const handleSelectTransitRoute = (fromActivity: Activity, toActivity: Activity, leg: TravelLeg) => {
    setSelectedTransitRoute({
      fromActivity,
      toActivity,
      leg,
      dayId: activeDay.id,
    });
    setMobileTab('map');
  };

  // Clear transit route and return to Area Overview
  const handleClearTransitRoute = () => {
    setSelectedTransitRoute(null);
  };

  // Change transit mode between two activities and persist
  const handleUpdateTransitMode = (mode: TransportationMode) => {
    const from = transitModalData.fromActivity || selectedTransitRoute?.fromActivity;
    const to = transitModalData.toActivity || selectedTransitRoute?.toActivity;
    if (!from || !to) return;

    const newLeg = estimateTravelLeg(
      from.location.lat,
      from.location.lng,
      to.location.lat,
      to.location.lng,
      mode,
      from.location.name,
      to.location.name
    );

    const newDays = trip.days.map((day) => {
      if (day.id !== activeDay.id) return day;
      const updatedActivities = day.activities.map((a) => {
        if (a.id === from.id) {
          return {
            ...a,
            travelToNext: newLeg,
          };
        }
        return a;
      });
      return { ...day, activities: updatedActivities };
    });

    syncTrip({
      ...trip,
      days: newDays,
      updatedAt: new Date().toISOString(),
    });

    if (transitModalData.isOpen) {
      setTransitModalData((prev) => ({
        ...prev,
        leg: newLeg,
      }));
    }

    if (selectedTransitRoute) {
      setSelectedTransitRoute({
        fromActivity: from,
        toActivity: to,
        leg: newLeg,
        dayId: activeDay.id,
      });
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <Navbar
        trip={trip}
        activeListId={activeListId}
        onSelectList={handleSelectList}
        onAddDay={handleAddDay}
        onOpenFinalizeModal={() => setIsFinalizeModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenOfflineModal={() => setIsOfflineModalOpen(true)}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        onOpenTripSelector={() => setIsTripSelectorOpen(true)}
        isOnline={isOnline}
        hasGoogleApiKey={Boolean(apiKey)}
      />

      {/* Mobile Day & Shelf Selector Bar (below header on small screens) */}
      <div className="md:hidden flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {trip.days.map((day) => {
            const isActive = day.id === activeListId;
            return (
              <button
                key={day.id}
                onClick={() => handleSelectList(day.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Day {day.dayNumber}</span>
                <span className={`text-[10px] px-1 rounded-full ${isActive ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                  {day.activities.length}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => handleSelectList('shelf')}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              activeListId === 'shelf'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Shelf</span>
            <span className={`text-[10px] px-1 rounded-full ${activeListId === 'shelf' ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
              {trip.shelfActivities?.length || 0}
            </span>
          </button>

          <button
            onClick={handleAddDay}
            className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl"
            title="Add Day"
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

      {/* Main Content Area: Slideable split-view on desktop, tabs on mobile */}
      <div 
        ref={containerRef}
        className={`flex-1 relative overflow-hidden flex flex-col md:flex-row ${
          isDraggingDivider ? 'select-none cursor-col-resize' : ''
        }`}
      >
        {/* Left Column: Day Timeline List or Dedicated Activity Shelf List */}
        <div
          style={{
            width: isDesktop ? `${scheduleWidthPercent}%` : undefined,
          }}
          className={`h-full md:shrink-0 flex flex-col overflow-hidden ${
            mobileTab === 'timeline' ? 'flex w-full' : 'hidden md:flex'
          }`}
        >
          {activeListId === 'shelf' ? (
            <ShelfListView
              shelfActivities={trip.shelfActivities || []}
              tripDays={trip.days}
              selectedActivityId={selectedActivityId}
              onSelectActivity={(id) => setSelectedActivityId(id)}
              onAddActivityClick={() => {
                setActivityModalTargetList('shelf');
                setIsActivityModalOpen(true);
              }}
              onDeleteShelfActivity={handleDeleteShelfActivity}
              onMoveActivityToList={handleMoveActivityToList}
              onScheduleToDay={handleScheduleToDay}
            />
          ) : (
            <TimelineView
              day={activeDay}
              shelfActivities={trip.shelfActivities || []}
              selectedActivityId={selectedActivityId}
              onSelectActivity={(id) => setSelectedActivityId(id)}
              selectedTransitRoute={selectedTransitRoute}
              onSelectTransitRoute={handleSelectTransitRoute}
              onClearTransitRoute={handleClearTransitRoute}
              onUpdateActivity={handleUpdateActivity}
              onDeleteActivity={handleDeleteActivity}
              onAddActivityClick={() => {
                setActivityModalTargetList('shelf');
                setIsActivityModalOpen(true);
              }}
              onDropFromShelf={handleDropFromShelf}
              onMoveToShelf={handleMoveToShelf}
              onDeleteShelfActivity={handleDeleteShelfActivity}
              onOpenTransitModal={handleOpenTransitModal}
            />
          )}
        </div>

        {/* Slideable Vertical Divider between Schedule and Map (Desktop) */}
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-valuenow={Math.round(scheduleWidthPercent)}
          aria-valuemin={20}
          aria-valuemax={75}
          aria-label="Resize schedule and map columns"
          title="Drag to resize schedule and map (double-click to reset)"
          onPointerDown={(e) => {
            e.preventDefault();
            setIsDraggingDivider(true);
          }}
          onDoubleClick={handleResetDivider}
          onKeyDown={handleDividerKeyDown}
          className={`hidden md:flex relative items-center justify-center w-2 -mx-1 z-30 cursor-col-resize group select-none transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            isDraggingDivider
              ? 'bg-blue-500/20 dark:bg-blue-600/30'
              : 'hover:bg-slate-300/50 dark:hover:bg-slate-700/50'
          }`}
        >
          {/* Vertical divider line */}
          <div
            className={`w-0.5 h-full transition-colors ${
              isDraggingDivider
                ? 'bg-blue-600 dark:bg-blue-500'
                : 'bg-slate-200 dark:bg-slate-800 group-hover:bg-blue-400 dark:group-hover:bg-blue-500'
            }`}
          />

          {/* Centered grip pill handle */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-9 rounded-full flex items-center justify-center border shadow-xs transition-all ${
              isDraggingDivider
                ? 'bg-blue-600 text-white border-blue-700 scale-110 shadow-md'
                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 group-hover:border-blue-400 group-hover:text-blue-600 group-hover:scale-105'
            }`}
          >
            <GripVertical className="w-3 h-3 stroke-[2.5]" />
          </div>
        </div>

        {/* Right Column: Google Maps View with Native Lists & Embed API */}
        <div
          className={`h-full flex-1 flex flex-col overflow-hidden min-w-0 relative ${
            mobileTab === 'map' ? 'flex w-full' : 'hidden md:flex'
          }`}
        >
          {/* Transparent dragging overlay prevents iframe from intercepting mouse events */}
          {isDraggingDivider && (
            <div className="absolute inset-0 z-50 cursor-col-resize pointer-events-auto bg-transparent" />
          )}

          <GoogleMapView
            apiKey={apiKey}
            activities={activeDay.activities}
            allTripDays={trip.days}
            activeDayId={activeDay.id}
            activeListId={activeListId}
            shelfActivities={trip.shelfActivities || []}
            onSelectDay={(listId) => {
              handleSelectList(listId);
            }}
            selectedActivityId={selectedActivityId}
            onSelectActivity={(id) => setSelectedActivityId(id)}
            selectedTransitRoute={selectedTransitRoute}
            onSelectTransitRoute={handleSelectTransitRoute}
            onClearTransitRoute={handleClearTransitRoute}
            onUpdateTransitMode={handleUpdateTransitMode}
            isOffline={!isOnline}
            destinationName={trip.destination}
            center={trip.center}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
            onOpenTransitModal={handleOpenTransitModal}
            onMoveActivityToList={handleMoveActivityToList}
            onOpenAddModal={() => {
              setActivityModalTargetList('shelf');
              setIsActivityModalOpen(true);
            }}
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
        onAddToList={handleAddActivityToList}
        tripDays={trip.days}
        defaultTargetListId={activityModalTargetList}
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
        onUpdateMode={handleUpdateTransitMode}
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
