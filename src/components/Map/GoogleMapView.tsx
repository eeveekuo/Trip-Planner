import React, { useState, useMemo, useEffect } from 'react';
import { 
  Activity, 
  TransportationMode, 
  TravelLeg, 
  TripDay, 
  GoogleMapsList, 
  SelectedTransitRoute 
} from '../../types';
import { 
  formatTime12h, 
  timeStringToMinutes,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsEmbedDirectionsUrl,
  buildGoogleMapsEmbedPlaceUrl,
  buildGoogleMapsEmbedSearchUrl,
  buildGoogleMapsLegDirectionsWebUrl,
  buildGoogleMapsEmbedLegDirectionsUrl,
  buildGoogleMapsEmbedAreaOverviewUrl
} from '../../utils/geo';
import { 
  Compass, 
  Bus,
  Car,
  Footprints,
  Bike,
  ExternalLink,
  Route,
  ArrowRight,
  RotateCcw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Star,
  Clock,
  MapPin,
  Share2,
  Navigation,
  Bookmark,
  Sparkles
} from 'lucide-react';

interface GoogleMapViewProps {
  apiKey: string;
  activities: Activity[];
  allTripDays?: TripDay[];
  activeDayId?: string;
  activeListId?: string;
  shelfActivities?: Activity[];
  onSelectDay?: (dayId: string) => void;
  selectedActivityId: string | null;
  onSelectActivity: (id: string) => void;
  selectedTransitRoute?: SelectedTransitRoute | null;
  onSelectTransitRoute?: (fromActivity: Activity, toActivity: Activity, leg: TravelLeg) => void;
  onClearTransitRoute?: () => void;
  onUpdateTransitMode?: (mode: TransportationMode) => void;
  isOffline: boolean;
  destinationName: string;
  center: { lat: number; lng: number };
  onOpenApiKeyModal: () => void;
  onOpenTransitModal?: (fromActivity: Activity, toActivity: Activity, leg: TravelLeg) => void;
  onMoveActivityToList?: (activityId: string, fromListId: string, toListId: string) => void;
  onOpenAddModal?: (targetListId?: string) => void;
}

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  activities: _activities,
  allTripDays = [],
  activeDayId,
  activeListId,
  shelfActivities = [],
  selectedActivityId,
  onSelectActivity,
  selectedTransitRoute,
  onSelectTransitRoute,
  onClearTransitRoute,
  onUpdateTransitMode,
  destinationName,
  onOpenTransitModal,
  onOpenAddModal,
}) => {
  // List selection is dictated strictly by the top-level selector (Day 1, Day 2, Activity Shelf)
  const currentListId = activeListId || activeDayId || 'day-1';

  // Embed Mode: 'overview' (all places for day/shelf) | 'directions' (route) | 'place' (selected stop)
  const [embedMode, setEmbedMode] = useState<'overview' | 'directions' | 'place'>('overview');
  
  // Google Maps sidebar panel open/collapsed state (like Google Maps desktop list overview)
  const [isListPanelOpen, setIsListPanelOpen] = useState(true);

  // When top level list selection changes, reset to overview mode and clear transit route if shelf
  useEffect(() => {
    setEmbedMode('overview');
    if (currentListId === 'shelf' && onClearTransitRoute) {
      onClearTransitRoute();
    }
  }, [currentListId, onClearTransitRoute]);

  // When selectedTransitRoute changes, automatically switch to directions mode
  useEffect(() => {
    if (selectedTransitRoute && currentListId !== 'shelf') {
      setEmbedMode('directions');
    }
  }, [selectedTransitRoute, currentListId]);

  // Construct structured Google Maps Lists for all trip days + the shelf
  const googleMapsLists = useMemo<GoogleMapsList[]>(() => {
    const lists: GoogleMapsList[] = [];

    // 1. Each day is its own Google Maps List
    allTripDays.forEach((day) => {
      const sortedDayActs = [...day.activities].sort(
        (a, b) => timeStringToMinutes(a.startTime || '09:00') - timeStringToMinutes(b.startTime || '09:00')
      );
      lists.push({
        id: day.id,
        title: day.title || `Day ${day.dayNumber} List`,
        type: 'day',
        dayId: day.id,
        dayNumber: day.dayNumber,
        activityCount: day.activities.length,
        activities: sortedDayActs,
        googleMapsUrl: buildGoogleMapsDirectionsUrl(sortedDayActs),
      });
    });

    // 2. Activity Shelf is an unscheduled Google Maps List (no ordering need)
    lists.push({
      id: 'shelf',
      title: 'Activity Shelf List',
      type: 'shelf',
      activityCount: shelfActivities.length,
      activities: shelfActivities,
      googleMapsUrl: shelfActivities.length > 0
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shelfActivities[0].location.name}, ${destinationName}`)}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationName)}`,
    });

    return lists;
  }, [allTripDays, shelfActivities]);

  // Currently active list, dictated strictly by the top-level selector
  const currentList = useMemo(() => {
    return googleMapsLists.find((l) => l.id === currentListId) || googleMapsLists[0];
  }, [currentListId, googleMapsLists]);

  // Selected Activity lookup
  const selectedAct = useMemo(() => {
    if (!selectedActivityId) return null;
    for (const l of googleMapsLists) {
      const found = l.activities.find((a) => a.id === selectedActivityId);
      if (found) return found;
    }
    return null;
  }, [selectedActivityId, googleMapsLists]);

  // Calculate reliable Google Maps Universal Embed URL
  const embedUrl = useMemo(() => {
    // 1. If a specific transit route is selected on a scheduled day, adjust map directly to route & directions for that leg
    if (selectedTransitRoute && currentList?.type !== 'shelf') {
      return buildGoogleMapsEmbedLegDirectionsUrl(
        selectedTransitRoute.fromActivity,
        selectedTransitRoute.toActivity,
        selectedTransitRoute.leg.mode
      );
    }

    // 2. If user explicitly selected a place
    if (embedMode === 'place' && selectedAct) {
      return buildGoogleMapsEmbedPlaceUrl(
        selectedAct.location.name,
        selectedAct.location.address
      );
    }

    // 3. Directions mode for full day list (shelf has no ordering need)
    if (embedMode === 'directions' && currentList && currentList.type !== 'shelf' && currentList.activities.length > 0) {
      return buildGoogleMapsEmbedDirectionsUrl(currentList.activities);
    }

    // 4. Area Overview mode: shows all places listed for that day/shelf
    if (currentList && currentList.activities.length > 0) {
      return buildGoogleMapsEmbedAreaOverviewUrl(
        currentList.activities,
        destinationName
      );
    }

    // 5. Fallback search mode on destination
    return buildGoogleMapsEmbedSearchUrl(destinationName || 'Tokyo, Japan');
  }, [selectedTransitRoute, embedMode, selectedAct, currentList, destinationName]);

  // Direct Google Maps Web URL to open the selected transit route, list, or place in a new tab
  const nativeGoogleMapsUrl = useMemo(() => {
    if (selectedTransitRoute && currentList?.type !== 'shelf') {
      return buildGoogleMapsLegDirectionsWebUrl(
        selectedTransitRoute.fromActivity,
        selectedTransitRoute.toActivity,
        selectedTransitRoute.leg.mode
      );
    }
    if (selectedAct && embedMode === 'place') {
      return (
        selectedAct.location.googleMapsUrl ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${selectedAct.location.name} ${selectedAct.location.address}`
        )}`
      );
    }
    return currentList?.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationName)}`;
  }, [selectedTransitRoute, selectedAct, embedMode, currentList, destinationName]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#f0f2f5] dark:bg-[#0f172a] overflow-hidden select-none">
      {/* 1. Header: Shows active list name dictated by top-level selector and direct Google Maps link */}
      <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-2.5 sm:px-4 z-20 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Compass className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                {destinationName}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                • Google Maps List
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Viewing: <strong className="text-blue-600 dark:text-blue-400">{currentList?.title}</strong> ({currentList?.activityCount || 0} places)
            </p>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={nativeGoogleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 shadow-xs transition cursor-pointer"
            title={selectedTransitRoute && currentList?.type !== 'shelf' ? "Open turn-by-turn directions in Google Maps" : "Open selected list in Google Maps to save to your personal lists"}
          >
            <span>{selectedTransitRoute && currentList?.type !== 'shelf' ? 'Open in Google Maps' : 'Save / Open in Maps'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 2. Active Transit Route Banner (when user clicked a transit route on a scheduled day) */}
      {selectedTransitRoute && currentList?.type !== 'shelf' && (
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-md z-15 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              {selectedTransitRoute.leg.mode === 'TRANSIT' && <Bus className="w-4 h-4" />}
              {selectedTransitRoute.leg.mode === 'DRIVE' && <Car className="w-4 h-4" />}
              {selectedTransitRoute.leg.mode === 'WALK' && <Footprints className="w-4 h-4" />}
              {selectedTransitRoute.leg.mode === 'BICYCLE' && <Bike className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-black">
                <span className="truncate max-w-[130px] sm:max-w-[180px]">{selectedTransitRoute.fromActivity.location.name}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-80" />
                <span className="truncate max-w-[130px] sm:max-w-[180px]">{selectedTransitRoute.toActivity.location.name}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-blue-100 font-medium">
                <span>{selectedTransitRoute.leg.durationMinutes} mins ({selectedTransitRoute.leg.distanceText})</span>
                {selectedTransitRoute.leg.transitDetails?.lineName && (
                  <span className="bg-white/20 px-1.5 py-0.2 rounded-md font-bold text-[10px]">
                    {selectedTransitRoute.leg.transitDetails.lineName}
                  </span>
                )}
                {selectedTransitRoute.leg.transitDetails?.numStops !== undefined && (
                  <span className="text-[10px] opacity-80 hidden sm:inline">
                    • {selectedTransitRoute.leg.transitDetails.numStops} stops
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Mode quick toggles + actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onUpdateTransitMode && (
              <div className="flex items-center bg-black/25 p-0.5 rounded-xl border border-white/10">
                {(['TRANSIT', 'DRIVE', 'WALK', 'BICYCLE'] as TransportationMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => onUpdateTransitMode(m)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      selectedTransitRoute.leg.mode === m
                        ? 'bg-white text-blue-900 shadow-xs'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    {m === 'TRANSIT' && 'Transit'}
                    {m === 'DRIVE' && 'Drive'}
                    {m === 'WALK' && 'Walk'}
                    {m === 'BICYCLE' && 'Bike'}
                  </button>
                ))}
              </div>
            )}

            {onOpenTransitModal && (
              <button
                onClick={() => onOpenTransitModal(selectedTransitRoute.fromActivity, selectedTransitRoute.toActivity, selectedTransitRoute.leg)}
                className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold transition cursor-pointer"
                title="View Turn-by-Turn Steps"
              >
                Steps
              </button>
            )}

            {onClearTransitRoute && (
              <button
                onClick={onClearTransitRoute}
                className="flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 hover:bg-blue-50 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition"
                title="Return to Area Overview showing all places for this day"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Area Overview</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Map Canvas Area with Google Maps List Overview Panel */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-slate-100 dark:bg-slate-950 flex">
        
        {/* ======================================================== */}
        {/* GOOGLE MAPS LIST OVERVIEW SIDEBAR PANEL (authentic Google Maps style) */}
        {/* ======================================================== */}
        {isListPanelOpen && currentList && (
          <div 
            id="google-maps-list-overview-panel"
            className="absolute top-0 bottom-0 left-0 z-20 w-full sm:w-84 md:w-92 bg-white dark:bg-slate-900 shadow-2xl border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-left duration-200"
          >
            {/* List Overview Header Card */}
            <div className="relative p-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-b from-slate-50 to-white dark:from-slate-800/80 dark:to-slate-900 shrink-0">
              {/* Top Row: Icon & Collapse Button */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400">
                    <Bookmark className="w-3.5 h-3.5 fill-current" />
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Google Maps List
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {onOpenAddModal && (
                    <button
                      onClick={() => onOpenAddModal('shelf')}
                      className="p-1 rounded-lg text-slate-500 hover:text-blue-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Add place to Activity Shelf"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsListPanelOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Collapse list panel"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Title & Metadata */}
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                {currentList.title}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                <span>By Evelyn</span>
                <span>•</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {currentList.activities.length} {currentList.activities.length === 1 ? 'place' : 'places'}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                  <Sparkles className="w-3 h-3" /> Shared
                </span>
              </div>

              {/* Action Buttons Toolbar (Google Maps list style pill buttons) */}
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                {currentList.type !== 'shelf' ? (
                  <button
                    onClick={() => setEmbedMode('directions')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                    title="Show full day directions on map"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Directions</span>
                  </button>
                ) : (
                  onOpenAddModal && (
                    <button
                      onClick={() => onOpenAddModal('shelf')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                      title="Add place to Activity Shelf"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Place</span>
                    </button>
                  )
                )}

                <a
                  href={currentList.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                  title="Open list in Google Maps"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Save</span>
                </a>

                <button
                  onClick={() => {
                    if (onClearTransitRoute) onClearTransitRoute();
                    setEmbedMode('overview');
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                  title="Reset to Area Overview"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Places List (Google Maps List format) */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2 scrollbar-thin">
              {currentList.activities.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    No places in this list yet
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                    Add places from the search bar or drag unscheduled places onto this day.
                  </p>
                  {onOpenAddModal && (
                    <button
                      onClick={() => onOpenAddModal('shelf')}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs hover:bg-blue-700 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Place to Shelf</span>
                    </button>
                  )}
                </div>
              ) : (
                currentList.activities.map((act, idx) => {
                  const nextAct = currentList.activities[idx + 1];
                  const isSelected = act.id === selectedActivityId;
                  
                  return (
                    <div key={act.id} className="py-2.5 px-2">
                      {/* Place Card styled like Google Maps List item */}
                      <div
                        onClick={() => {
                          onSelectActivity(act.id);
                          setEmbedMode('place');
                        }}
                        className={`group relative p-2.5 rounded-2xl transition cursor-pointer border ${
                          isSelected
                            ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Sequential Badge (1, 2, 3... for Days, Pin icon for unscheduled Shelf) */}
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                          }`}>
                            {currentList.type === 'shelf' ? (
                              <MapPin className="w-3.5 h-3.5" />
                            ) : (
                              idx + 1
                            )}
                          </div>

                          {/* Place Main Details */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                              {act.title}
                            </h3>

                            {/* Rating & Reviews line */}
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                              <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-0.5">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                {act.location.rating || '4.7'}
                              </span>
                              <span className="text-slate-400 text-[10px]">
                                ({act.location.userRatingsTotal ? (act.location.userRatingsTotal > 1000 ? `${(act.location.userRatingsTotal/1000).toFixed(1)}k` : act.location.userRatingsTotal) : '1.2k'})
                              </span>
                              <span>•</span>
                              <span className="truncate capitalize text-slate-500 dark:text-slate-400">
                                {act.location.category || 'Point of interest'}
                              </span>
                            </div>

                            {/* Address & Hours */}
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{act.location.address}</span>
                            </p>

                            {/* Schedule & Business Hours */}
                            <div className="flex items-center gap-2 mt-1 text-[10px]">
                              {currentList.type === 'shelf' ? (
                                <span className="font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                                  Unscheduled
                                </span>
                              ) : (
                                act.startTime && (
                                  <span className="font-bold text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-900/40 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatTime12h(act.startTime)}
                                  </span>
                                )
                              )}
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                ● Open
                              </span>
                            </div>

                            {/* Notes / Description snippet if any */}
                            {act.notes && (
                              <div className="mt-1.5 p-1.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl text-[10px] text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800 italic">
                                "{act.notes}"
                              </div>
                            )}

                            {/* Card Action Links */}
                            <div className="flex items-center gap-3 mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 text-[10px] font-bold">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectActivity(act.id);
                                  setEmbedMode('place');
                                }}
                                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <Compass className="w-3 h-3" />
                                <span>Focus on Map</span>
                              </button>

                              <a
                                href={act.location.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${act.location.name} ${act.location.address}`)}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Google Maps</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Google Maps Transit Connector between Stop N and Stop N+1 (Day lists only - shelf has no ordering need) */}
                      {currentList.type !== 'shelf' && nextAct && act.travelToNext && (
                        <div className="my-1.5 ml-5 pl-4 border-l-2 border-dashed border-slate-300 dark:border-slate-700 py-1">
                          <button
                            onClick={() => {
                              if (onSelectTransitRoute) {
                                onSelectTransitRoute(act, nextAct, act.travelToNext!);
                              }
                            }}
                            className="w-full flex items-center justify-between gap-2 p-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 border border-purple-200/80 dark:border-purple-800/50 text-purple-900 dark:text-purple-200 transition cursor-pointer text-left group"
                            title={`Route: ${act.title} ➔ ${nextAct.title}`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-5 h-5 rounded-md bg-purple-200 dark:bg-purple-800/80 flex items-center justify-center shrink-0">
                                {act.travelToNext.mode === 'TRANSIT' && <Bus className="w-3 h-3" />}
                                {act.travelToNext.mode === 'DRIVE' && <Car className="w-3 h-3" />}
                                {act.travelToNext.mode === 'WALK' && <Footprints className="w-3 h-3" />}
                                {act.travelToNext.mode === 'BICYCLE' && <Bike className="w-3 h-3" />}
                              </span>
                              <div className="min-w-0">
                                <span className="text-[10px] font-black truncate block">
                                  {act.travelToNext.durationMinutes} min {act.travelToNext.mode.toLowerCase()} ({act.travelToNext.distanceText})
                                </span>
                                {act.travelToNext.transitDetails?.lineName && (
                                  <span className="text-[9px] text-purple-700 dark:text-purple-300 truncate block">
                                    {act.travelToNext.transitDetails.lineName}
                                  </span>
                                )}
                              </div>
                            </div>

                            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-0.5 shrink-0 group-hover:translate-x-0.5 transition-transform">
                              <span>Directions</span>
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Floating Button to Re-Open Google Maps List Panel if Collapsed */}
        {!isListPanelOpen && currentList && (
          <button
            onClick={() => setIsListPanelOpen(true)}
            className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 transition cursor-pointer animate-in fade-in"
          >
            <Bookmark className="w-3.5 h-3.5 text-blue-600 fill-current" />
            <span>{currentList.title}</span>
            <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded-full text-[10px]">
              {currentList.activityCount}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}

        {/* ======================================================== */}
        {/* MAP CANVAS (FULL BLEED BEHIND SIDEBAR) */}
        {/* ======================================================== */}
        <iframe
          title="Google Maps Embed View"
          src={embedUrl}
          className="w-full h-full border-0"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />

        {/* ======================================================== */}
        {/* TOP RIGHT MODE SWITCHER PILL (Moved to Top Right as requested) */}
        {/* ======================================================== */}
        <div 
          id="google-maps-view-mode-pill"
          className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
        >
          <button
            onClick={() => {
              if (onClearTransitRoute) onClearTransitRoute();
              setEmbedMode('overview');
            }}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
              embedMode === 'overview' && !selectedTransitRoute
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
            title="Show all places listed for this day or shelf"
          >
            Area Overview
          </button>
          {currentList?.type !== 'shelf' && (
            <button
              onClick={() => setEmbedMode('directions')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                embedMode === 'directions' || selectedTransitRoute
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
              title="Show Route & Directions connecting places"
            >
              Route & Directions
            </button>
          )}
          <button
            onClick={() => setEmbedMode('place')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
              embedMode === 'place'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
            title="Focus on Selected Place Details"
          >
            Place Details
          </button>
        </div>
      </div>
    </div>
  );
};
