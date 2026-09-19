import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  MapPin, 
  Navigation, 
  Compass, 
  Layers, 
  Sparkles, 
  WifiOff,
  Bus,
  Car,
  Footprints,
  Bike,
  ExternalLink,
  Star,
  CheckCircle2,
  Route,
  ArrowRight,
  RotateCcw,
  ListFilter,
  BookmarkPlus,
  Share2,
  Plus,
  ArrowLeftRight,
  Clock,
  Eye,
  Maximize2,
  AlertCircle,
  ChevronRight
} from 'lucide-react';

interface GoogleMapViewProps {
  apiKey: string;
  activities: Activity[]; // Active day's scheduled activities
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
  apiKey,
  activities,
  allTripDays = [],
  activeDayId,
  activeListId,
  shelfActivities = [],
  onSelectDay,
  selectedActivityId,
  onSelectActivity,
  selectedTransitRoute,
  onSelectTransitRoute,
  onClearTransitRoute,
  onUpdateTransitMode,
  isOffline,
  destinationName,
  center,
  onOpenApiKeyModal,
  onOpenTransitModal,
  onMoveActivityToList,
  onOpenAddModal,
}) => {
  // Selected Google Maps List filter: 'activeDay' | 'shelf' | specific dayId | 'all'
  const [selectedListId, setSelectedListId] = useState<string>(activeListId || activeDayId || 'day-1');
  // Embed Mode: 'overview' (all places for day) | 'directions' (route) | 'place' (selected stop) | 'search' (area search)
  const [embedMode, setEmbedMode] = useState<'overview' | 'directions' | 'place' | 'search'>('overview');
  // View mode: Google Maps Embed vs Interactive Vector Map
  const [mapEngine, setMapEngine] = useState<'embed' | 'vector'>('embed');
  // Embed provider: 'universal' (no Google Cloud API activation required) vs 'cloud' (Google Cloud Embed v1)
  const [embedType, setEmbedType] = useState<'universal' | 'cloud'>(() => {
    return (localStorage.getItem('trip_planner_embed_type') as 'universal' | 'cloud') || 'universal';
  });
  const [showListDrawer, setShowListDrawer] = useState(true);

  const handleSetEmbedType = (type: 'universal' | 'cloud') => {
    setEmbedType(type);
    localStorage.setItem('trip_planner_embed_type', type);
  };

  // Sync selectedListId when activeListId or activeDayId changes
  useEffect(() => {
    if (activeListId) {
      setSelectedListId(activeListId);
    } else if (activeDayId && selectedListId !== 'shelf' && selectedListId !== 'all') {
      setSelectedListId(activeDayId);
    }
  }, [activeListId, activeDayId]);

  // When selectedTransitRoute changes, automatically switch to directions mode
  useEffect(() => {
    if (selectedTransitRoute) {
      setEmbedMode('directions');
    }
  }, [selectedTransitRoute]);

  // Construct structured Google Maps Lists for all trip days + the shelf
  const googleMapsLists = useMemo<GoogleMapsList[]>(() => {
    const lists: GoogleMapsList[] = [];

    // 1. Add each day as a Google Maps List
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

    // 2. Add Activity Shelf as an unscheduled Google Maps List
    lists.push({
      id: 'shelf',
      title: 'Activity Shelf List',
      type: 'shelf',
      activityCount: shelfActivities.length,
      activities: shelfActivities,
      googleMapsUrl: buildGoogleMapsDirectionsUrl(shelfActivities),
    });

    return lists;
  }, [allTripDays, shelfActivities]);

  // Find currently selected list object
  const currentList = useMemo(() => {
    if (selectedListId === 'all') {
      const allActs: Activity[] = [];
      allTripDays.forEach((d) => allActs.push(...d.activities));
      allActs.push(...shelfActivities);
      return {
        id: 'all',
        title: 'All Trip Lists (Combined)',
        type: 'day' as const,
        activityCount: allActs.length,
        activities: allActs,
        googleMapsUrl: buildGoogleMapsDirectionsUrl(allActs),
      };
    }
    return googleMapsLists.find((l) => l.id === selectedListId) || googleMapsLists[0];
  }, [selectedListId, googleMapsLists, allTripDays, shelfActivities]);

  // Selected Activity lookup
  const selectedAct = useMemo(() => {
    if (!selectedActivityId) return null;
    for (const l of googleMapsLists) {
      const found = l.activities.find((a) => a.id === selectedActivityId);
      if (found) return found;
    }
    return null;
  }, [selectedActivityId, googleMapsLists]);

  // Calculate Embed URL based on selectedTransitRoute, active Google Maps List, and Embed Mode
  const embedUrl = useMemo(() => {
    const useCloud = embedType === 'cloud';

    // 1. If a specific transit route is selected, adjust map directly to route & directions for that leg
    if (selectedTransitRoute) {
      return buildGoogleMapsEmbedLegDirectionsUrl(
        selectedTransitRoute.fromActivity,
        selectedTransitRoute.toActivity,
        selectedTransitRoute.leg.mode,
        apiKey,
        useCloud
      );
    }

    // 2. If user explicitly selected a place or embedMode is 'place'
    if (embedMode === 'place' && selectedAct) {
      return buildGoogleMapsEmbedPlaceUrl(
        selectedAct.location.name,
        selectedAct.location.address,
        apiKey,
        useCloud
      );
    }

    // 3. Area Overview mode: shows all places listed for that day/shelf!
    if ((embedMode === 'overview' || embedMode === 'search') && currentList && currentList.activities.length > 0) {
      return buildGoogleMapsEmbedAreaOverviewUrl(
        currentList.activities,
        destinationName,
        apiKey,
        useCloud
      );
    }

    // 4. Directions mode for full day list
    if (embedMode === 'directions' && currentList && currentList.activities.length > 0) {
      return buildGoogleMapsEmbedDirectionsUrl(currentList.activities, apiKey, 'transit', useCloud);
    }

    // 5. Fallback search mode on destination
    return buildGoogleMapsEmbedSearchUrl(destinationName || 'Tokyo, Japan', apiKey, useCloud);
  }, [selectedTransitRoute, embedMode, selectedAct, currentList, apiKey, destinationName, embedType]);

  // Direct Google Maps Web URL to open the selected transit route, list, or place
  const nativeGoogleMapsUrl = useMemo(() => {
    if (selectedTransitRoute) {
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

  const handleSelectList = (listId: string) => {
    setSelectedListId(listId);
    if (onSelectDay) {
      onSelectDay(listId);
    }
    if (onClearTransitRoute) {
      onClearTransitRoute();
    }
    setEmbedMode('overview');
    const targetList = googleMapsLists.find((l) => l.id === listId);
    if (targetList && targetList.activities.length > 0) {
      onSelectActivity(targetList.activities[0].id);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#f0f2f5] dark:bg-[#0f172a] overflow-hidden select-none">
      {/* 1. Google Maps Native Lists Top Filter Bar */}
      <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-2.5 sm:px-4 z-20 flex flex-col gap-2 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Compass className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                  {destinationName}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  • Google Maps Lists Mode
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Viewing: <strong className="text-blue-600 dark:text-blue-400">{currentList?.title}</strong> ({currentList?.activityCount || 0} places)
              </p>
            </div>
          </div>

          {/* Right Tools: Embed / Vector Switcher & Open in Google Maps */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Toggle Engine */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setMapEngine('embed')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  mapEngine === 'embed'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="Use Google Maps Embed API"
              >
                <Route className="w-3 h-3" />
                <span>Google Maps Embed</span>
              </button>
              <button
                onClick={() => setMapEngine('vector')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  mapEngine === 'vector'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="Switch to Vector Map Pins"
              >
                <Layers className="w-3 h-3" />
                <span>Vector Pins</span>
              </button>
            </div>

            {/* Universal vs Cloud Key Switcher (when in Embed mode) */}
            {mapEngine === 'embed' && (
              <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => handleSetEmbedType('universal')}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    embedType === 'universal'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                  title="Universal Embed: Always active without requiring API activation in Google Cloud Console"
                >
                  Universal
                </button>
                <button
                  onClick={() => handleSetEmbedType('cloud')}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    embedType === 'cloud'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                  title="Google Cloud Key Embed: Requires Maps Embed API enabled in your Cloud project"
                >
                  Cloud Key
                </button>
              </div>
            )}

            {/* Direct Open in Google Maps */}
            <a
              href={nativeGoogleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 shadow-xs transition"
              title={selectedTransitRoute ? "Open turn-by-turn directions in Google Maps" : "Open selected list in Google Maps to save to your personal lists"}
            >
              <span>{selectedTransitRoute ? 'Open in Google Maps' : 'Save / Open in Maps'}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Google Maps Lists Selection Pills: Each day and Activity Shelf on its own list */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 pr-1">
            <ListFilter className="w-3 h-3" />
            <span>Select List:</span>
          </div>

          {googleMapsLists.map((list) => {
            const isSelected = selectedListId === list.id;
            return (
              <button
                key={list.id}
                onClick={() => handleSelectList(list.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {list.type === 'shelf' ? (
                  <Layers className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                ) : (
                  <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
                )}
                <span>{list.title}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? 'bg-blue-700/80 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {list.activityCount}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => handleSelectList('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer border ${
              selectedListId === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <span>All Lists</span>
          </button>
        </div>
      </div>

      {/* Cloud API Activation Helper Banner */}
      {mapEngine === 'embed' && embedType === 'cloud' && (
        <div className="bg-amber-50 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-850 px-3 sm:px-4 py-2 text-xs flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200 z-10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate">
              Seeing &ldquo;API is not activated on your API project&rdquo;? Your key needs <strong>Maps Embed API</strong> enabled in Google Cloud.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleSetEmbedType('universal')}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shadow-xs cursor-pointer transition"
            >
              Switch to Universal Embed (Active Instantly)
            </button>
            <a
              href="https://console.cloud.google.com/apis/library?filter=category:maps"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] underline font-semibold text-amber-800 dark:text-amber-300 hover:text-amber-950"
            >
              Cloud Console
            </a>
          </div>
        </div>
      )}

      {/* 2. Mode Headers: Active Transit Route Banner OR Area Overview Strip */}
      {selectedTransitRoute ? (
        /* Active Transit Route Banner with Real-Time Directions & Mode Switcher */
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
      ) : (
        /* Area Overview Strip: Shows all places listed for that day with quick clickable chips */
        <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 py-2 flex flex-col gap-1.5 z-15 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5 shrink-0">
                <Compass className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                {currentList?.title} Area Overview
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                • {currentList?.activities.length || 0} places listed
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline">
              Click place to inspect • Click transit route to adjust map
            </span>
          </div>

          {/* Quick chips of all places in order with inline transit route buttons */}
          {currentList && currentList.activities.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin text-xs">
              {currentList.activities.map((act, idx) => {
                const nextAct = currentList.activities[idx + 1];
                const isSelected = act.id === selectedActivityId;
                return (
                  <React.Fragment key={act.id}>
                    <button
                      onClick={() => {
                        onSelectActivity(act.id);
                        setEmbedMode('place');
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                      title={`${act.title} (${act.location.name})`}
                    >
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                        isSelected ? 'bg-white text-blue-600' : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      }`}>
                        {currentList.type === 'shelf' ? `S${idx + 1}` : idx + 1}
                      </span>
                      <span className="truncate max-w-[130px]">{act.title}</span>
                    </button>

                    {/* Inline Transit Route Button to Next Stop */}
                    {nextAct && act.travelToNext && (
                      <button
                        onClick={() => {
                          if (onSelectTransitRoute) {
                            onSelectTransitRoute(act, nextAct, act.travelToNext!);
                          }
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 text-[10px] font-bold shrink-0 transition cursor-pointer group"
                        title={`Adjust map to route: ${act.title} ➔ ${nextAct.title}`}
                      >
                        {act.travelToNext.mode === 'TRANSIT' && <Bus className="w-2.5 h-2.5" />}
                        {act.travelToNext.mode === 'DRIVE' && <Car className="w-2.5 h-2.5" />}
                        {act.travelToNext.mode === 'WALK' && <Footprints className="w-2.5 h-2.5" />}
                        {act.travelToNext.mode === 'BICYCLE' && <Bike className="w-2.5 h-2.5" />}
                        <span>{act.travelToNext.durationMinutes}m</span>
                        <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Map Canvas Area (Google Maps Embed API or Vector Pins) */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-slate-100 dark:bg-slate-950">
        {mapEngine === 'embed' ? (
          /* Official Google Maps Embed API iframe */
          <div className="relative w-full h-full">
            <iframe
              title="Google Maps Embed View"
              src={embedUrl}
              className="w-full h-full border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />

            {/* Embed Mode Overlay Pill */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 text-xs font-bold">
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
                title="Show all places listed for this day"
              >
                Area Overview
              </button>
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
        ) : (
          /* Fast Vector Pins Renderer for Offline/Canvas manipulation */
          <GoogleMapsVectorRenderer
            currentList={currentList}
            allLists={googleMapsLists}
            selectedActivityId={selectedActivityId}
            onSelectActivity={(id) => {
              onSelectActivity(id);
              setEmbedMode('place');
            }}
            selectedTransitRoute={selectedTransitRoute}
            onSelectDay={onSelectDay}
            center={center}
            onOpenTransitModal={onOpenTransitModal}
          />
        )}

        {/* 4. Interactive Floating List Drawer Showing Places in Currently Selected List */}
        {showListDrawer && currentList && currentList.activities.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-slate-200 dark:border-slate-800 max-h-60 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800 dark:text-white">
                  {currentList.title} Places ({currentList.activities.length})
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {onOpenAddModal && (
                  <button
                    onClick={() => onOpenAddModal(currentList.id)}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add to this list</span>
                  </button>
                )}
                <button
                  onClick={() => setShowListDrawer(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                  title="Minimize list drawer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Places List with Route Trigger & Drop to List Actions */}
            <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 pr-1 scrollbar-thin mt-1">
              {currentList.activities.map((act, idx) => {
                const nextAct = currentList.activities[idx + 1];
                const isSelected = act.id === selectedActivityId;
                return (
                  <div
                    key={act.id}
                    className={`py-2 px-1.5 flex items-center justify-between gap-2 rounded-xl transition ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div
                      className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                      onClick={() => {
                        onSelectActivity(act.id);
                        setEmbedMode('place');
                      }}
                    >
                      <span className="w-5 h-5 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-black flex items-center justify-center shrink-0">
                        {currentList.type === 'shelf' ? `S${idx + 1}` : idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {act.title}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                          {act.startTime && <span>{formatTime12h(act.startTime)} • </span>}
                          <span>{act.location.address.split(',')[0]}</span>
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      {/* Direct button to route to next stop */}
                      {nextAct && act.travelToNext && onSelectTransitRoute && (
                        <button
                          onClick={() => onSelectTransitRoute(act, nextAct, act.travelToNext!)}
                          className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                          title={`Adjust map to route to ${nextAct.title}`}
                        >
                          <Route className="w-3 h-3" />
                          <span>Route</span>
                        </button>
                      )}

                      {/* Move/Transfer to another Google Maps List */}
                      {onMoveActivityToList && (
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              onMoveActivityToList(act.id, currentList.id, e.target.value);
                            }
                          }}
                          className="text-[10px] font-bold py-1 px-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer focus:outline-none"
                          title="Move or Drop from this list to another Google Maps list"
                        >
                          <option value="">Move...</option>
                          {googleMapsLists
                            .filter((l) => l.id !== currentList.id)
                            .map((target) => (
                              <option key={target.id} value={target.id}>
                                ➔ {target.title}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Toggle List Drawer Button if Closed */}
        {!showListDrawer && currentList && (
          <button
            onClick={() => setShowListDrawer(true)}
            className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Show List Items ({currentList.activityCount})</span>
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Fast Vector Renderer component used when user toggles to "Vector Pins"
 * Features whole-trip pins, sequential list numbering, and active transit leg route polylines.
 */
const GoogleMapsVectorRenderer: React.FC<{
  currentList: GoogleMapsList;
  allLists: GoogleMapsList[];
  selectedActivityId: string | null;
  onSelectActivity: (id: string) => void;
  selectedTransitRoute?: SelectedTransitRoute | null;
  onSelectDay?: (dayId: string) => void;
  center: { lat: number; lng: number };
  onOpenTransitModal?: (fromActivity: Activity, toActivity: Activity, leg: TravelLeg) => void;
}> = ({
  currentList,
  allLists,
  selectedActivityId,
  onSelectActivity,
  selectedTransitRoute,
  onSelectDay,
  center,
}) => {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Compile all activities across all lists for whole-trip awareness
  const allActivitiesWithList = useMemo(() => {
    const items: { activity: Activity; list: GoogleMapsList; isCurrentList: boolean; listIndex: number }[] = [];
    allLists.forEach((list) => {
      const isCurrent = currentList.id === 'all' || list.id === currentList.id;
      list.activities.forEach((act, idx) => {
        items.push({
          activity: act,
          list,
          isCurrentList: isCurrent,
          listIndex: idx,
        });
      });
    });
    return items;
  }, [allLists, currentList]);

  const allLats = [...allActivitiesWithList.map((a) => a.activity.location.lat), center.lat];
  const allLngs = [...allActivitiesWithList.map((a) => a.activity.location.lng), center.lng];

  const minLat = Math.min(...allLats) - 0.03;
  const maxLat = Math.max(...allLats) + 0.03;
  const minLng = Math.min(...allLngs) - 0.04;
  const maxLng = Math.max(...allLngs) + 0.04;

  const latRange = Math.max(0.01, maxLat - minLat);
  const lngRange = Math.max(0.01, maxLng - minLng);

  const getCoordinates = (lat: number, lng: number) => {
    const xPct = ((lng - minLng) / lngRange) * 100;
    const yPct = ((maxLat - lat) / latRange) * 100;
    return {
      left: `${Math.max(6, Math.min(94, xPct))}%`,
      top: `${Math.max(6, Math.min(94, yPct))}%`,
    };
  };

  const routeFromCoords = selectedTransitRoute
    ? getCoordinates(selectedTransitRoute.fromActivity.location.lat, selectedTransitRoute.fromActivity.location.lng)
    : null;
  const routeToCoords = selectedTransitRoute
    ? getCoordinates(selectedTransitRoute.toActivity.location.lat, selectedTransitRoute.toActivity.location.lng)
    : null;

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => {
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      }}
      onMouseMove={(e) => {
        if (!isDragging) return;
        setPan({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
      }}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      className="w-full h-full relative cursor-grab active:cursor-grabbing overflow-hidden bg-[#e5e3df] dark:bg-[#1e293b]"
    >
      <div
        className="w-full h-full absolute inset-0 transition-transform duration-75 origin-center"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${scale})`,
        }}
      >
        {/* Subtle Map Grid Lines */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:24px_24px]" />

        {/* Active Transit Route Polyline Connection */}
        {selectedTransitRoute && routeFromCoords && routeToCoords && (
          <>
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-15 overflow-visible">
              <line
                x1={routeFromCoords.left}
                y1={routeFromCoords.top}
                x2={routeToCoords.left}
                y2={routeToCoords.top}
                stroke="#6366f1"
                strokeWidth="4"
                strokeDasharray="6 4"
                strokeLinecap="round"
                className="animate-pulse"
              />
            </svg>
            <div
              style={{
                left: `calc((${routeFromCoords.left} + ${routeToCoords.left}) / 2)`,
                top: `calc((${routeFromCoords.top} + ${routeToCoords.top}) / 2)`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-25 bg-purple-700 text-white px-2.5 py-1 rounded-full text-[10px] font-black shadow-lg flex items-center gap-1.5 border-2 border-white pointer-events-none"
            >
              {selectedTransitRoute.leg.mode === 'TRANSIT' && <Bus className="w-3 h-3" />}
              {selectedTransitRoute.leg.mode === 'DRIVE' && <Car className="w-3 h-3" />}
              {selectedTransitRoute.leg.mode === 'WALK' && <Footprints className="w-3 h-3" />}
              {selectedTransitRoute.leg.mode === 'BICYCLE' && <Bike className="w-3 h-3" />}
              <span>{selectedTransitRoute.leg.durationMinutes}m</span>
              <span>•</span>
              <span>{selectedTransitRoute.leg.distanceText}</span>
            </div>
          </>
        )}

        {/* Render Pins: Whole trip is visible, non-selected days/shelf are dimmed */}
        {allActivitiesWithList.map(({ activity: act, list, isCurrentList, listIndex }) => {
          const coords = getCoordinates(act.location.lat, act.location.lng);
          const isSelected = act.id === selectedActivityId;
          const isRouteFrom = selectedTransitRoute && selectedTransitRoute.fromActivity.id === act.id;
          const isRouteTo = selectedTransitRoute && selectedTransitRoute.toActivity.id === act.id;
          const isRouteParticipant = isRouteFrom || isRouteTo;

          return (
            <div
              key={`${list.id}-${act.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectActivity(act.id);
                if (!isCurrentList && onSelectDay) {
                  onSelectDay(list.id);
                }
              }}
              style={{ left: coords.left, top: coords.top }}
              className={`absolute -translate-x-1/2 -translate-y-full cursor-pointer transition-all duration-200 ${
                isRouteParticipant
                  ? 'scale-125 z-40 opacity-100'
                  : isSelected
                  ? 'scale-125 z-30 opacity-100'
                  : selectedTransitRoute
                  ? 'z-10 opacity-30 filter grayscale-[40%]'
                  : isCurrentList
                  ? 'z-20 opacity-100 hover:scale-110'
                  : 'z-10 opacity-40 hover:opacity-90 hover:scale-105 filter grayscale-[35%]'
              }`}
              title={`${act.title} (${list.title})`}
            >
              <div
                className={`flex items-center justify-center rounded-full shadow-lg border-2 border-white text-white font-black text-xs transition-colors ${
                  isRouteFrom
                    ? 'bg-emerald-600 ring-4 ring-emerald-400/40 w-8 h-8'
                    : isRouteTo
                    ? 'bg-purple-600 ring-4 ring-purple-400/40 w-8 h-8'
                    : isSelected
                    ? 'bg-blue-600 w-8 h-8 ring-2 ring-blue-400'
                    : isCurrentList
                    ? (list.type === 'shelf' ? 'bg-indigo-600 w-7 h-7' : 'bg-[#ea4335] w-7 h-7')
                    : 'bg-slate-500 w-6 h-6'
                }`}
              >
                {isRouteFrom ? 'A' : isRouteTo ? 'B' : list.type === 'shelf' ? `S${listIndex + 1}` : listIndex + 1}
              </div>
              <div className="w-1.5 h-1.5 bg-black/40 rounded-full mx-auto mt-0.5 blur-xs" />

              {!isCurrentList && !selectedTransitRoute && (
                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap px-1 py-0.2 bg-slate-800/80 text-white rounded text-[8px] font-bold pointer-events-none opacity-80">
                  {list.type === 'shelf' ? 'Shelf' : `Day ${list.dayNumber}`}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Zoom Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl p-1 shadow-md border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setScale((s) => Math.min(2.5, s + 0.25))}
          className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-bold cursor-pointer"
        >
          +
        </button>
        <button
          onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-bold cursor-pointer"
        >
          -
        </button>
        <button
          onClick={() => {
            setPan({ x: 0, y: 0 });
            setScale(1);
          }}
          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
          title="Reset View"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
