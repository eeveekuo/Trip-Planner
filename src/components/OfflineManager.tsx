import React, { useState } from 'react';
import { Trip } from '../types';
import { saveTripForOfflineUse, getOfflinePackage } from '../utils/storage';
import { 
  Wifi, 
  WifiOff, 
  HardDriveDownload, 
  CheckCircle2, 
  ShieldCheck, 
  RefreshCw,
  X,
  Database,
  MapPin
} from 'lucide-react';

interface OfflineManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  isOnline: boolean;
  isSimulatedOffline: boolean;
  onToggleSimulatedOffline: (sim: boolean) => void;
  onTripOfflineSaved: (trip: Trip) => void;
}

export const OfflineManagerModal: React.FC<OfflineManagerModalProps> = ({
  isOpen,
  onClose,
  trip,
  isOnline,
  isSimulatedOffline,
  onToggleSimulatedOffline,
  onTripOfflineSaved,
}) => {
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ message: string; date: string } | null>(null);

  if (!isOpen) return null;

  const offlinePkg = getOfflinePackage(trip.id);

  const handleSaveForOffline = () => {
    setSaving(true);
    setTimeout(() => {
      const res = saveTripForOfflineUse(trip);
      setSaving(false);
      if (res.success) {
        setSaveResult({
          message: `Successfully cached ${res.itemCount} stops, vector maps, and route data!`,
          date: res.cachedAt,
        });
        onTripOfflineSaved({
          ...trip,
          offlineSaved: true,
          offlineCachedAt: res.cachedAt,
        });
      }
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-slate-850 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Offline Mode & Storage
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Access maps and itinerary without mobile data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Status Indicator */}
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
            isOnline 
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
          }`}>
            <div className="flex items-center gap-2.5">
              {isOnline ? (
                <Wifi className="w-5 h-5 text-emerald-600" />
              ) : (
                <WifiOff className="w-5 h-5 text-amber-600" />
              )}
              <div>
                <span className="text-xs font-bold block">
                  Current Status: {isOnline ? 'Online (Connected)' : 'Offline Mode Active'}
                </span>
                <span className="text-[11px] opacity-80">
                  {isOnline ? 'Live sync & satellite data streaming' : 'Using cached local itinerary & vector map'}
                </span>
              </div>
            </div>
          </div>

          {/* Save to Device Package Button */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Offline Travel Package
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Stores all {trip.days.reduce((acc, d) => acc + d.activities.length, 0)} stops, geo-coordinates, allowable hours, and vector navigation routes locally.
                </p>
              </div>
            </div>

            {offlinePkg || saveResult ? (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  Cached for offline access ({new Date(saveResult?.date || offlinePkg!.cachedAt).toLocaleDateString()})
                </span>
              </div>
            ) : null}

            <button
              onClick={handleSaveForOffline}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition cursor-pointer"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <HardDriveDownload className="w-4 h-4" />
              )}
              <span>{saving ? 'Caching Itinerary & Maps...' : 'Save Entire Trip for Offline'}</span>
            </button>
          </div>

          {/* Offline Mode Simulator Toggle */}
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Simulate Offline Mode
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Test how the app works on airplane mode without internet
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isSimulatedOffline}
                onChange={(e) => onToggleSimulatedOffline(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
