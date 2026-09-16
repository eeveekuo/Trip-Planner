import React, { useState } from 'react';
import { Companion, Trip } from '../types';
import { 
  X, 
  Copy, 
  Check, 
  Users, 
  UserPlus, 
  Radio, 
  ShieldCheck, 
  Mail, 
  Share2,
  Sparkles
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onAddCompanion: (companion: Companion) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  trip,
  onAddCompanion,
}) => {
  const [copied, setCopied] = useState(false);
  const [newCompanionName, setNewCompanionName] = useState('');
  const [newCompanionRole, setNewCompanionRole] = useState<Companion['role']>('editor');

  if (!isOpen) return null;

  // Real shareable link with trip ID
  const shareableUrl = `${window.location.origin}${window.location.pathname}?trip=${trip.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanionName.trim()) return;

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const companion: Companion = {
      id: `comp-${Date.now()}`,
      name: newCompanionName.trim(),
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(newCompanionName)}`,
      color: randomColor,
      isOnline: true,
      lastActive: 'Just now',
      role: newCompanionRole,
    };

    onAddCompanion(companion);
    setNewCompanionName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-slate-850 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Share Itinerary in Real-Time
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Collaborate with travel companions live
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Live Sync Badge */}
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
            <div className="relative">
              <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Real-Time Live Sync Active
              </h4>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                Anyone with this link sees changes to activity durations, transit modes, and pins instantly without refreshing.
              </p>
            </div>
          </div>

          {/* Shareable Link Box */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Trip Companion Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareableUrl}
                className="flex-1 text-xs px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono select-all focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Active Travel Companions Roster */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Travel Companions ({trip.companions.length})
              </label>
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {trip.companions.filter((c) => c.isOnline).length} Active Now
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {trip.companions.map((comp) => (
                <div
                  key={comp.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <img
                        src={comp.avatar}
                        alt={comp.name}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover border border-white dark:border-slate-700"
                      />
                      {comp.isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {comp.name}
                        </span>
                        {comp.role === 'owner' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 font-bold uppercase">
                            Organizer
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {comp.isOnline ? 'Online now' : `Last active ${comp.lastActive}`}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 capitalize bg-white dark:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600">
                    {comp.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Add Companion */}
          <form onSubmit={handleInvite} className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Add Companion to Group
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCompanionName}
                onChange={(e) => setNewCompanionName(e.target.value)}
                placeholder="Companion name (e.g. Alex)"
                className="flex-1 text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
              <select
                value={newCompanionRole}
                onChange={(e) => setNewCompanionRole(e.target.value as Companion['role'])}
                className="text-xs px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                <option value="editor">Can Edit</option>
                <option value="viewer">Can View</option>
              </select>
              <button
                type="submit"
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </form>
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
