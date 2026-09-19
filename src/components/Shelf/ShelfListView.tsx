import React, { useState, useMemo } from 'react';
import { Activity, TripDay } from '../../types';
import { 
  formatTime12h, 
  buildGoogleMapsPlaceUrl, 
  buildGoogleMapsDirectionsUrl 
} from '../../utils/geo';
import { 
  Layers, 
  Plus, 
  Search, 
  ExternalLink, 
  Clock, 
  MapPin, 
  Star, 
  Trash2, 
  ArrowRight, 
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Tag,
  Compass
} from 'lucide-react';

interface ShelfListViewProps {
  shelfActivities: Activity[];
  tripDays: TripDay[];
  selectedActivityId: string | null;
  onSelectActivity: (id: string) => void;
  onAddActivityClick: () => void;
  onDeleteShelfActivity: (id: string) => void;
  onMoveActivityToList: (activityId: string, fromListId: string, toListId: string) => void;
  onScheduleToDay: (activity: Activity, dayId: string, startTime?: string) => void;
}

export const ShelfListView: React.FC<ShelfListViewProps> = ({
  shelfActivities,
  tripDays,
  selectedActivityId,
  onSelectActivity,
  onAddActivityClick,
  onDeleteShelfActivity,
  onMoveActivityToList,
  onScheduleToDay,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [schedulingActId, setSchedulingActId] = useState<string | null>(null);
  const [targetDayId, setTargetDayId] = useState<string>(tripDays[0]?.id || '');
  const [targetTime, setTargetTime] = useState<string>('10:00');

  // Filter activities by search & category
  const filteredActivities = useMemo(() => {
    return shelfActivities.filter((act) => {
      const matchesSearch = 
        act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.location.address.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || act.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [shelfActivities, searchQuery, selectedCategory]);

  const categories = ['all', 'sightseeing', 'dining', 'culture', 'shopping', 'relaxation'];

  const googleMapsListUrl = useMemo(() => {
    return buildGoogleMapsDirectionsUrl(shelfActivities);
  }, [shelfActivities]);

  const handleConfirmSchedule = (act: Activity) => {
    onScheduleToDay(act, targetDayId, targetTime);
    setSchedulingActId(null);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-hidden select-none">
      {/* 1. Shelf List Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  Activity Shelf List
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  {shelfActivities.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Unscheduled places, recommendations & backlog activities
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {shelfActivities.length > 0 && (
              <a
                href={googleMapsListUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 transition shadow-xs"
                title="Open this list in Google Maps Web or App"
              >
                <span>Maps List</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            )}
            <button
              onClick={onAddActivityClick}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Shelf</span>
            </button>
          </div>
        </div>

        {/* Search & Category Pills */}
        <div className="mt-3.5 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shelf places by name or address..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition cursor-pointer shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. List of Shelf Activities */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-thin">
        {filteredActivities.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center mb-3">
              <Layers className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
              {shelfActivities.length === 0
                ? 'No activities in shelf list yet'
                : 'No activities match your search'}
            </h4>
            <p className="text-xs text-slate-400 max-w-xs mb-4">
              {shelfActivities.length === 0
                ? 'Keep unscheduled ideas and places on this shelf list, then schedule them onto Day 1, Day 2, or Day 3 whenever ready.'
                : 'Try clearing your search query or selecting another category filter.'}
            </p>
            {shelfActivities.length === 0 && (
              <button
                onClick={onAddActivityClick}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Activity to Shelf</span>
              </button>
            )}
          </div>
        ) : (
          filteredActivities.map((act, idx) => {
            const isSelected = act.id === selectedActivityId;
            const isScheduling = schedulingActId === act.id;

            return (
              <div
                key={act.id}
                onClick={() => onSelectActivity(act.id)}
                className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-md ring-2 ring-blue-500/20'
                    : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-black flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      S{idx + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {act.title}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {act.category}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{act.location.address}</span>
                      </p>

                      {/* Meta Tags: Duration, Rating, Business Hours */}
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-semibold">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{act.durationMinutes} mins</span>
                        </span>

                        {act.location.rating && (
                          <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{act.location.rating}</span>
                          </span>
                        )}

                        {act.businessHours && (
                          <span className={`flex items-center gap-1 font-medium ${
                            act.businessHours.isOpenToday 
                              ? 'text-emerald-600 dark:text-emerald-400' 
                              : 'text-amber-600 dark:text-amber-400'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            <span>
                              {act.businessHours.open && act.businessHours.close
                                ? `${act.businessHours.open} - ${act.businessHours.close}`
                                : act.businessHours.isOpenToday ? 'Open Today' : 'Hours not specified'}
                            </span>
                          </span>
                        )}
                      </div>

                      {act.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-2 line-clamp-2 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                          &ldquo;{act.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Actions: Delete & Map Link */}
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={buildGoogleMapsPlaceUrl(act.location.name, act.location.address)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                      title="Open Place in Google Maps"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteShelfActivity(act.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                      title="Remove from Shelf"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Schedule to Day Quick Drawer */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                  {!isScheduling ? (
                    <div className="w-full flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Unscheduled (In Shelf List)
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSchedulingActId(act.id);
                          setTargetDayId(tripDays[0]?.id || '');
                        }}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold transition cursor-pointer border border-blue-200 dark:border-blue-800"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Schedule onto Day List</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={(e) => e.stopPropagation()} 
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <select
                          value={targetDayId}
                          onChange={(e) => setTargetDayId(e.target.value)}
                          className="text-xs font-bold py-1 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          {tripDays.map((d) => (
                            <option key={d.id} value={d.id}>
                              Day {d.dayNumber} ({d.title})
                            </option>
                          ))}
                        </select>

                        <input
                          type="time"
                          value={targetTime}
                          onChange={(e) => setTargetTime(e.target.value)}
                          className="text-xs font-bold py-1 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSchedulingActId(null)}
                          className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleConfirmSchedule(act)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
