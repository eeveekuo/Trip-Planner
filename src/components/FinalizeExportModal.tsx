import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trip } from '../types';
import { createGoogleCalendarUrl, downloadICS } from '../utils/calendarExport';
import { formatDuration, formatTime12h, validateBusinessHours } from '../utils/geo';
import { 
  X, 
  Calendar, 
  Download, 
  Share2, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Printer, 
  MapPin, 
  Clock, 
  Users,
  Sparkles
} from 'lucide-react';

interface FinalizeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onOpenShareModal: () => void;
}

export const FinalizeExportModal: React.FC<FinalizeExportModalProps> = ({
  isOpen,
  onClose,
  trip,
  onOpenShareModal,
}) => {
  useEffect(() => {
    if (isOpen) {
      // Fire festive celebration confetti!
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#2563eb', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'],
        });
      } catch {
        // Fallback gracefully
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate itinerary stats and check for business hour conflicts
  const totalActivities = trip.days.reduce((acc, d) => acc + d.activities.length, 0);
  const conflicts: { dayNumber: number; activityTitle: string; reason: string }[] = [];

  trip.days.forEach((day) => {
    day.activities.forEach((act) => {
      const v = validateBusinessHours(act);
      if (v.isConflict) {
        conflicts.push({
          dayNumber: day.dayNumber,
          activityTitle: act.title,
          reason: v.message || 'Outside venue business hours',
        });
      }
    });
  });

  const handleDownloadICS = () => {
    downloadICS(trip);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-850 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="relative px-6 py-6 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur">
                Trip Finalized & Validated
              </span>
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">
              {trip.title}
            </h2>
            <p className="text-xs text-blue-100 mt-1">
              {trip.destination} • {trip.days.length} Days • {totalActivities} Pinned Stops
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Business Hours & Route Health Summary */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Schedule Health Check:
            </span>
            {conflicts.length === 0 ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                All {totalActivities} stops comply with venue business hours!
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                <AlertTriangle className="w-4 h-4" />
                {conflicts.length} time conflict(s) noted below
              </span>
            )}
          </div>

          {conflicts.length > 0 && (
            <div className="mt-2.5 p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-200 space-y-1">
              {conflicts.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span>Day {c.dayNumber}: <strong>{c.activityTitle}</strong></span>
                  <span className="text-amber-600 dark:text-amber-400">{c.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Export Action Cards */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Primary Action 1: Download .ICS */}
            <div className="p-4 rounded-2xl border-2 border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 hover:border-blue-500 transition flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3 shadow-md">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Download iCalendar (.ics)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Imports all {totalActivities} activities directly into Apple Calendar, Google Calendar, or Microsoft Outlook with GPS pins & reminders.
                </p>
              </div>

              <button
                onClick={handleDownloadICS}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export .ics File</span>
              </button>
            </div>

            {/* Primary Action 2: Share with Travel Companions */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-md">
                  <Share2 className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Real-Time Companion Share
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Generate live synchronization link for companions. Any edits to durations, transit modes, or stops sync instantly.
                </p>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onOpenShareModal();
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Share Real-Time Link</span>
              </button>
            </div>
          </div>

          {/* Quick Single Add to Google Calendar List */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                1-Click Add to Google Calendar (by Stop)
              </h4>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Itinerary</span>
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {trip.days.map((day) =>
                day.activities.map((act) => {
                  const gCalUrl = createGoogleCalendarUrl(act, day.date, trip.title);
                  return (
                    <div
                      key={act.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {act.title}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                            Day {day.dayNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime12h(act.startTime)} ({formatDuration(act.durationMinutes)})</span>
                          <span>•</span>
                          <span className="truncate">{act.location.name}</span>
                        </div>
                      </div>

                      <a
                        href={gCalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold text-[11px] transition shrink-0"
                      >
                        <span>Google Cal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Trip finalized on {new Date().toLocaleDateString()}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
