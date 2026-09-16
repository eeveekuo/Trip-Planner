import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Activity, TransportationMode, TravelLeg, TripDay } from '../../types';
import { 
  estimateTravelLeg, 
  formatDuration, 
  formatTime12h, 
  minutesToTimeString, 
  timeStringToMinutes, 
  validateBusinessHours 
} from '../../utils/geo';
import { 
  Clock, 
  Car, 
  Train, 
  Footprints, 
  Bike, 
  AlertTriangle, 
  CheckCircle2, 
  GripVertical, 
  Plus, 
  Trash2, 
  Wand2, 
  ExternalLink,
  MapPin,
  Sparkles,
  ChevronRight,
  Info,
  Bus,
  Layers,
  Calendar,
  ArrowDownToLine,
  ArrowUpRight,
  Maximize2
} from 'lucide-react';

interface TimelineViewProps {
  day: TripDay;
  shelfActivities?: Activity[];
  selectedActivityId: string | null;
  onSelectActivity: (id: string) => void;
  onUpdateActivity: (updated: Activity) => void;
  onDeleteActivity: (id: string) => void;
  onAddActivityClick: () => void;
  onDropFromShelf: (activity: Activity, targetStartTime: string) => void;
  onMoveToShelf: (activityId: string) => void;
  onDeleteShelfActivity?: (activityId: string) => void;
  onOpenTransitModal?: (fromActivity: Activity, toActivity: Activity, leg: TravelLeg) => void;
}

// 12:00 AM (0) to 11:59 PM (24)
const START_HOUR = 0;
const END_HOUR = 24;
const TOTAL_HOURS = 24;
const PX_PER_HOUR = 84; // Height in px for 1 hour
const PX_PER_MIN = PX_PER_HOUR / 60; // 1.4 px per minute

export const TimelineView: React.FC<TimelineViewProps> = ({
  day,
  shelfActivities = [],
  selectedActivityId,
  onSelectActivity,
  onUpdateActivity,
  onDeleteActivity,
  onAddActivityClick,
  onDropFromShelf,
  onMoveToShelf,
  onDeleteShelfActivity,
  onOpenTransitModal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [resizingActivityId, setResizingActivityId] = useState<string | null>(null);
  const [movingActivityId, setMovingActivityId] = useState<string | null>(null);
  const [dragStartY, setDragStartY] = useState<number>(0);
  const [dragInitialVal, setDragInitialVal] = useState<number>(0);
  const [currentLiveVal, setCurrentLiveVal] = useState<number | null>(null);
  const [draggedShelfActId, setDraggedShelfActId] = useState<string | null>(null);
  const [isTimelineDragOver, setIsTimelineDragOver] = useState(false);
  const [dropPreviewTime, setDropPreviewTime] = useState<string | null>(null);

  // Initial scroll to ~08:00 AM so daytime is immediately in view
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 8 * PX_PER_HOUR;
    }
  }, []);

  // Sort activities chronologically by start time
  const sortedActivities = useMemo(() => {
    return [...day.activities].sort(
      (a, b) => timeStringToMinutes(a.startTime || '09:00') - timeStringToMinutes(b.startTime || '09:00')
    );
  }, [day.activities]);

  // Handle Dragging Duration (Resizing activity length like Google Calendar)
  const handleResizeMouseDown = (e: React.MouseEvent, act: Activity) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingActivityId(act.id);
    setDragStartY(e.clientY);
    setDragInitialVal(act.durationMinutes);
    setCurrentLiveVal(act.durationMinutes);
    onSelectActivity(act.id);
  };

  // Handle Dragging Start Time (Moving activity slot)
  const handleMoveMouseDown = (e: React.MouseEvent, act: Activity) => {
    e.stopPropagation();
    setMovingActivityId(act.id);
    setDragStartY(e.clientY);
    const startMin = timeStringToMinutes(act.startTime || '09:00');
    setDragInitialVal(startMin);
    setCurrentLiveVal(startMin);
    onSelectActivity(act.id);
  };

  // Window mouse move listener for smooth dragging
  useEffect(() => {
    if (!resizingActivityId && !movingActivityId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - dragStartY;
      const deltaMinutes = Math.round(deltaY / PX_PER_MIN / 15) * 15;

      if (resizingActivityId) {
        const newDuration = Math.max(15, Math.min(360, dragInitialVal + deltaMinutes));
        setCurrentLiveVal(newDuration);
      } else if (movingActivityId) {
        const minStart = START_HOUR * 60;
        const maxStart = END_HOUR * 60 - 30;
        const newStartMinutes = Math.max(minStart, Math.min(maxStart, dragInitialVal + deltaMinutes));
        setCurrentLiveVal(newStartMinutes);
      }
    };

    const handleMouseUp = () => {
      if (resizingActivityId && currentLiveVal !== null) {
        const act = sortedActivities.find((a) => a.id === resizingActivityId);
        if (act && act.durationMinutes !== currentLiveVal) {
          onUpdateActivity({ ...act, durationMinutes: currentLiveVal });
        }
      } else if (movingActivityId && currentLiveVal !== null) {
        const act = sortedActivities.find((a) => a.id === movingActivityId);
        if (act) {
          const newTimeStr = minutesToTimeString(currentLiveVal);
          if (act.startTime !== newTimeStr) {
            onUpdateActivity({ ...act, startTime: newTimeStr });
          }
        }
      }
      setResizingActivityId(null);
      setMovingActivityId(null);
      setCurrentLiveVal(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingActivityId, movingActivityId, dragStartY, dragInitialVal, currentLiveVal, sortedActivities, onUpdateActivity]);

  // Transportation mode updater
  const handleModeChange = (fromAct: Activity, toAct: Activity, newMode: TransportationMode) => {
    const updatedLeg = estimateTravelLeg(
      fromAct.location.lat,
      fromAct.location.lng,
      toAct.location.lat,
      toAct.location.lng,
      newMode,
      fromAct.location.name,
      toAct.location.name
    );
    onUpdateActivity({ ...fromAct, travelToNext: updatedLeg });
  };

  // Automatically adjust slot time if conflicting with business hours
  const handleSnapToHours = (act: Activity) => {
    const openMin = timeStringToMinutes(act.businessHours.open);
    const closeMin = timeStringToMinutes(act.businessHours.close);
    const currentMin = timeStringToMinutes(act.startTime || '09:00');

    let snappedStart = currentMin;
    if (currentMin < openMin) {
      snappedStart = openMin;
    } else if (currentMin + act.durationMinutes > closeMin) {
      snappedStart = Math.max(openMin, closeMin - act.durationMinutes);
    }
    onUpdateActivity({ ...act, startTime: minutesToTimeString(snappedStart) });
  };

  // Auto-shift next activity start time to account for travel buffer
  const handleAutoAlignNext = (currentAct: Activity, nextAct: Activity) => {
    const curStartMin = timeStringToMinutes(currentAct.startTime || '09:00');
    const legDuration = currentAct.travelToNext?.durationMinutes || 20;
    const recommendedNextStartMin = curStartMin + currentAct.durationMinutes + legDuration;
    onUpdateActivity({
      ...nextAct,
      startTime: minutesToTimeString(recommendedNextStartMin),
    });
  };

  // Schedule activity from shelf directly to next available slot
  const handleScheduleFromShelf = (shelfAct: Activity) => {
    let nextAvailableMin = 9 * 60; // 9:00 AM default
    if (sortedActivities.length > 0) {
      const lastAct = sortedActivities[sortedActivities.length - 1];
      const lastEndMin = timeStringToMinutes(lastAct.startTime || '09:00') + lastAct.durationMinutes;
      const travelBuffer = lastAct.travelToNext?.durationMinutes || 25;
      nextAvailableMin = Math.min(22 * 60, lastEndMin + travelBuffer);
    }
    const targetTime = minutesToTimeString(nextAvailableMin);
    onDropFromShelf(shelfAct, targetTime);
  };

  // Drag & drop from shelf handlers onto timeline
  const handleDragOverTimeline = (e: React.DragEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    setIsTimelineDragOver(true);

    const rect = containerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top + containerRef.current.scrollTop - 40; // offset for header
    const droppedMin = Math.max(0, Math.min(23 * 60 + 45, Math.floor((relativeY / PX_PER_MIN) / 15) * 15));
    setDropPreviewTime(minutesToTimeString(droppedMin));
  };

  const handleDropOnTimeline = (e: React.DragEvent) => {
    e.preventDefault();
    setIsTimelineDragOver(false);
    setDropPreviewTime(null);

    const shelfActId = e.dataTransfer.getData('text/plain') || draggedShelfActId;
    if (!shelfActId) return;

    const act = shelfActivities.find((a) => a.id === shelfActId);
    if (!act || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top + containerRef.current.scrollTop - 40;
    const droppedMin = Math.max(0, Math.min(23 * 60 + 45, Math.floor((relativeY / PX_PER_MIN) / 15) * 15));
    const targetTime = minutesToTimeString(droppedMin);

    onDropFromShelf(act, targetTime);
    setDraggedShelfActId(null);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-hidden select-none">
      {/* 1. Activity Shelf Above Agenda (Shared Across Days) */}
      <div className="shrink-0 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 p-3.5 sm:p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Activity Shelf
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  {shelfActivities.length} Unscheduled
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Drag places onto today&apos;s timeline or switch days to schedule
              </p>
            </div>
          </div>

          <button
            onClick={onAddActivityClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Search & Add</span>
          </button>
        </div>

        {/* Shelf Cards Horizontal Carousel / Grid */}
        {shelfActivities.length === 0 ? (
          <div className="py-3 px-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-800/40 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your activity shelf is currently empty. Click <span className="font-semibold text-blue-600 dark:text-blue-400">&ldquo;Search & Add&rdquo;</span> to pin places via Google Maps!
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
            {shelfActivities.map((act) => (
              <div
                key={act.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', act.id);
                  setDraggedShelfActId(act.id);
                }}
                className="shrink-0 w-64 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs hover:shadow-md hover:border-blue-500 transition cursor-grab active:cursor-grabbing group relative"
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <GripVertical className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 shrink-0" />
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                      {act.title}
                    </h4>
                  </div>
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0"
                    style={{
                      backgroundColor: `${act.color || '#3b82f6'}18`,
                      color: act.color || '#3b82f6',
                    }}
                  >
                    {act.category}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                  <span className="truncate">{act.location.name}</span>
                </p>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px]">
                  <span className="text-slate-400">
                    {act.businessHours.open}–{act.businessHours.close}
                  </span>

                  <div className="flex items-center gap-1">
                    {onDeleteShelfActivity && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteShelfActivity(act.id);
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 rounded-md transition cursor-pointer"
                        title="Remove from shelf"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleScheduleFromShelf(act)}
                      className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-blue-600 dark:text-blue-300 font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <ArrowDownToLine className="w-2.5 h-2.5" />
                      <span>Schedule</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Agenda Timeline Sub-header */}
      <div className="px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-850/60 text-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-bold text-slate-800 dark:text-slate-200">
            Day {day.dayNumber} Timeline
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            12:00 AM – 11:59 PM (24h Full Day Grid)
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span>Allowable Business Hours verified</span>
        </div>
      </div>

      {/* 3. The 12 AM - 11:59 PM Interactive Timeline Container */}
      <div
        ref={containerRef}
        onDragOver={handleDragOverTimeline}
        onDragLeave={() => {
          setIsTimelineDragOver(false);
          setDropPreviewTime(null);
        }}
        onDrop={handleDropOnTimeline}
        className="flex-1 overflow-y-auto relative scrollbar-thin bg-slate-50/30 dark:bg-slate-900/30"
      >
        {/* Timeline Drop Hover Indicator */}
        {isTimelineDragOver && dropPreviewTime && (
          <div className="sticky top-2 z-40 mx-4 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-lg flex items-center justify-center gap-2 animate-pulse">
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Drop to schedule at {formatTime12h(dropPreviewTime)}</span>
          </div>
        )}

        {/* 24-Hour Grid Canvas (12 AM to 11:59 PM) */}
        <div
          className="relative w-full"
          style={{ height: `${TOTAL_HOURS * PX_PER_HOUR + 40}px` }}
        >
          {/* Hour Tick Markers (0 = 12 AM, 12 = 12 PM, 23 = 11 PM, 24 = 11:59 PM) */}
          {Array.from({ length: TOTAL_HOURS + 1 }).map((_, idx) => {
            const hour = START_HOUR + idx;
            const top = idx * PX_PER_HOUR;
            
            let label = '';
            if (hour === 0) label = '12:00 AM';
            else if (hour < 12) label = `${hour}:00 AM`;
            else if (hour === 12) label = '12:00 PM';
            else if (hour < 24) label = `${hour - 12}:00 PM`;
            else label = '11:59 PM';

            return (
              <div
                key={idx}
                className="absolute left-0 right-0 flex items-start pointer-events-none"
                style={{ top: `${top}px` }}
              >
                {/* Hour Label */}
                <div className="w-20 pl-4 pr-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 select-none">
                  {label}
                </div>

                {/* Horizontal Guideline */}
                <div className="flex-1 h-px bg-slate-200/80 dark:bg-slate-800" />
              </div>
            );
          })}

          {/* Half-Hour Subtle Dashed Guidelines */}
          {Array.from({ length: TOTAL_HOURS }).map((_, idx) => {
            const top = idx * PX_PER_HOUR + PX_PER_HOUR / 2;
            return (
              <div
                key={`half-${idx}`}
                className="absolute left-20 right-0 h-px border-t border-dashed border-slate-100 dark:border-slate-800/60 pointer-events-none"
                style={{ top: `${top}px` }}
              />
            );
          })}

          {/* Scheduled Activity Blocks & Travel Legs */}
          <div className="absolute left-20 right-4 top-0 bottom-0 pointer-events-none">
            {sortedActivities.map((act, index) => {
              const isMoving = movingActivityId === act.id;
              const isResizing = resizingActivityId === act.id;
              const isSelected = selectedActivityId === act.id;

              const actStartMin = timeStringToMinutes(act.startTime || '09:00');
              const displayStartMinutes = isMoving && currentLiveVal !== null ? currentLiveVal : actStartMin;
              const displayDuration = isResizing && currentLiveVal !== null ? currentLiveVal : act.durationMinutes;

              const topPx = (displayStartMinutes - START_HOUR * 60) * PX_PER_MIN;
              const heightPx = Math.max(34, displayDuration * PX_PER_MIN);

              const validation = validateBusinessHours(act, (day.dayNumber - 1) % 7);

              const nextAct = sortedActivities[index + 1];
              let travelLeg = act.travelToNext;
              if (nextAct && !travelLeg) {
                travelLeg = estimateTravelLeg(
                  act.location.lat,
                  act.location.lng,
                  nextAct.location.lat,
                  nextAct.location.lng,
                  'TRANSIT',
                  act.location.name,
                  nextAct.location.name
                );
              }

              const nextStartMin = nextAct ? timeStringToMinutes(nextAct.startTime || '09:00') : 0;
              const curEndMin = actStartMin + act.durationMinutes;
              const gapMinutes = nextAct ? nextStartMin - curEndMin : 0;
              const hasGapConflict = nextAct && travelLeg && gapMinutes < travelLeg.durationMinutes;

              return (
                <React.Fragment key={act.id}>
                  {/* The Activity Box */}
                  <div
                    onClick={() => onSelectActivity(act.id)}
                    className={`absolute left-2 right-2 rounded-2xl p-3 border shadow-xs transition-all pointer-events-auto flex flex-col justify-between ${
                      isSelected
                        ? 'ring-2 ring-blue-500 shadow-md z-20'
                        : 'z-10 hover:shadow-md'
                    } ${
                      validation.isConflict
                        ? 'border-amber-400 bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                    }`}
                    style={{
                      top: `${topPx}px`,
                      height: `${heightPx}px`,
                      borderLeftWidth: '5px',
                      borderLeftColor: act.color || '#3b82f6',
                    }}
                  >
                    {/* Top Bar: Move Handle, Title, Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Drag Handle to shift start time */}
                        <div
                          onMouseDown={(e) => handleMoveMouseDown(e, act)}
                          className="p-1 -ml-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-move rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0"
                          title="Click & drag up/down to move time slot"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-bold text-xs truncate text-slate-900 dark:text-white">
                            {act.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                            <span className="truncate">{act.location.name}</span>
                          </p>
                        </div>
                      </div>

                      {/* Top Right Badges & Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px]">
                          {formatTime12h(act.startTime || '09:00')} ({formatDuration(act.durationMinutes)})
                        </span>

                        {/* Move to Shelf Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveToShelf(act.id);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                          title="Move back to Activity Shelf"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteActivity(act.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                          title="Delete activity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Notes Paragraph Preview if present */}
                    {act.notes && heightPx > 70 && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 italic px-1">
                        &ldquo;{act.notes}&rdquo;
                      </p>
                    )}

                    {/* Business Hours Allowable Status & Warnings */}
                    <div className="mt-auto pt-1">
                      {validation.isConflict ? (
                        <div className="flex items-center justify-between gap-2 p-1 bg-amber-100/70 dark:bg-amber-950/60 rounded-lg text-[10px] text-amber-900 dark:text-amber-200">
                          <div className="flex items-center gap-1 truncate">
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span className="truncate font-medium">{validation.message}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSnapToHours(act);
                            }}
                            className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[9px] font-bold shrink-0 shadow-xs transition cursor-pointer"
                            title="Auto-adjust to allowable opening hours"
                          >
                            <Wand2 className="w-2.5 h-2.5" />
                            <span>Snap</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Within allowable hours ({act.businessHours.open}–{act.businessHours.close})</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Resize Handle: Draggable Activity Length */}
                    <div
                      onMouseDown={(e) => handleResizeMouseDown(e, act)}
                      className="absolute -bottom-1.5 left-6 right-6 h-3.5 flex items-center justify-center cursor-ns-resize group z-30"
                      title="Drag to resize activity duration"
                    >
                      <div className="w-16 h-1.5 bg-slate-300 dark:bg-slate-600 group-hover:bg-blue-600 group-hover:w-24 group-hover:h-2 rounded-full transition-all shadow-xs" />
                    </div>
                  </div>

                  {/* Dedicated Transit & Travel Block connecting to Next Activity */}
                  {nextAct && (
                    <div
                      className="absolute left-2 right-2 z-15 pointer-events-auto"
                      style={{
                        top: `${topPx + heightPx + 2}px`,
                      }}
                    >
                      <div
                        onClick={() => {
                          if (onOpenTransitModal && travelLeg) {
                            onOpenTransitModal(act, nextAct, travelLeg);
                          }
                        }}
                        className={`my-1 px-3 py-2 rounded-2xl border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer group ${
                          hasGapConflict
                            ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200'
                            : 'bg-purple-50/80 hover:bg-purple-100/80 dark:bg-purple-950/30 dark:hover:bg-purple-950/50 border-purple-200 dark:border-purple-800/60 text-slate-700 dark:text-slate-200 shadow-xs'
                        }`}
                      >
                        {/* Transit Line and Mode Badge */}
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                            {travelLeg?.mode === 'TRANSIT' && <Bus className="w-3.5 h-3.5" />}
                            {travelLeg?.mode === 'DRIVE' && <Car className="w-3.5 h-3.5" />}
                            {travelLeg?.mode === 'WALK' && <Footprints className="w-3.5 h-3.5" />}
                            {travelLeg?.mode === 'BICYCLE' && <Bike className="w-3.5 h-3.5" />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-purple-900 dark:text-purple-200 truncate">
                                {travelLeg?.transitDetails?.lineName || `${travelLeg?.mode || 'TRANSIT'} to Stop #${index + 2}`}
                              </span>
                              <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 shrink-0">
                                • {travelLeg?.durationMinutes} mins ({travelLeg?.distanceText})
                              </span>
                            </div>

                            {/* Specific Bus Details if available */}
                            {travelLeg?.transitDetails && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {travelLeg.transitDetails.departureStop} → {travelLeg.transitDetails.arrivalStop} ({travelLeg.transitDetails.numStops} stops)
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Gap and Open Transit Route Modal Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          {hasGapConflict ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-red-600 dark:text-red-400">
                                ⚠️ Only {gapMinutes}m buffer!
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAutoAlignNext(act, nextAct);
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-[10px] font-bold shadow-xs transition cursor-pointer"
                                title="Adjust next start time to allow travel"
                              >
                                <span>Adjust Gap</span>
                                <ChevronRight className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 group-hover:underline">
                              <span>Transit Route & Map</span>
                              <ChevronRight className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
