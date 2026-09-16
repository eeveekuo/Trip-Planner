import React from 'react';
import { Trip, TripDay } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { 
  MapPin, 
  Calendar, 
  Users, 
  Share2, 
  CheckCircle2, 
  Sparkles, 
  Wifi, 
  WifiOff, 
  Download, 
  Smartphone,
  Plus,
  ChevronDown,
  FolderOpen
} from 'lucide-react';

interface NavbarProps {
  trip: Trip;
  activeDayId: string;
  onSelectDay: (dayId: string) => void;
  onAddDay: () => void;
  onOpenFinalizeModal: () => void;
  onOpenShareModal: () => void;
  onOpenOfflineModal: () => void;
  onOpenApiKeyModal: () => void;
  onOpenTripSelector?: () => void;
  isOnline: boolean;
  hasGoogleApiKey: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  trip,
  activeDayId,
  onSelectDay,
  onAddDay,
  onOpenFinalizeModal,
  onOpenShareModal,
  onOpenOfflineModal,
  onOpenApiKeyModal,
  onOpenTripSelector,
  isOnline,
  hasGoogleApiKey,
}) => {
  const { isInstallable, install } = usePWAInstall();

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between shrink-0 gap-3 z-30 select-none">
      {/* Brand & Destination Info with Trip Selector Button */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenTripSelector}
          className="w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 transition cursor-pointer group"
          title="Switch trip or create a new trip"
        >
          <FolderOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenTripSelector}
              className="flex items-center gap-1.5 text-left group cursor-pointer hover:opacity-85 transition"
              title="Click to switch or plan trips"
            >
              <h1 className="text-sm font-black tracking-tight text-slate-900 dark:text-white truncate">
                {trip.title}
              </h1>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 shrink-0" />
            </button>
            {trip.isFinalized && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                Finalized
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
              {trip.destination}
            </span>
            <span>•</span>
            <span>{trip.startDate} to {trip.endDate}</span>
          </div>
        </div>
      </div>

      {/* Day Selector Pills */}
      <div className="hidden md:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
        {trip.days.map((day) => {
          const isActive = day.id === activeDayId;
          return (
            <button
              key={day.id}
              onClick={() => onSelectDay(day.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Day {day.dayNumber}</span>
              <span className={`ml-1 text-[10px] font-normal ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                ({day.activities.length})
              </span>
            </button>
          );
        })}

        <button
          onClick={onAddDay}
          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
          title="Add day to trip"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Action Buttons: Offline, Companions, Finalize & PWA */}
      <div className="flex items-center gap-2 shrink-0">
        {/* PWA In-App Install Button */}
        {isInstallable && (
          <button
            onClick={install}
            className="hidden sm:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            title="Install as Progressive Web App"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
        )}

        {/* Offline Status Toggle Button */}
        <button
          onClick={onOpenOfflineModal}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
            isOnline
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
          }`}
          title={isOnline ? 'Connected (Click for offline settings)' : 'Offline mode active'}
        >
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </button>

        {/* Travel Companions Live Avatar Stack + Share Button */}
        <button
          onClick={onOpenShareModal}
          className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          title="Share with travel companions"
        >
          <div className="flex -space-x-2 overflow-hidden">
            {trip.companions.slice(0, 3).map((comp) => (
              <img
                key={comp.id}
                src={comp.avatar}
                alt={comp.name}
                referrerPolicy="no-referrer"
                className="w-5 h-5 rounded-full ring-2 ring-white dark:ring-slate-800 object-cover"
              />
            ))}
          </div>
          <span className="hidden sm:inline">Share</span>
          <Share2 className="w-3.5 h-3.5 text-blue-600" />
        </button>

        {/* Finalize Trip & Calendar Export Button */}
        <button
          onClick={onOpenFinalizeModal}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>{trip.isFinalized ? 'Export Calendar' : 'Finalize Trip'}</span>
        </button>
      </div>
    </header>
  );
};
