import React, { useState } from 'react';
import { Trip, TripDay } from '../types';
import { 
  X, 
  MapPin, 
  Calendar, 
  Plus, 
  Compass, 
  Check, 
  Trash2, 
  Globe2, 
  Sparkles,
  ArrowRight,
  Plane
} from 'lucide-react';

interface TripSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  trips: Trip[];
  activeTripId: string;
  onSelectTrip: (tripId: string) => void;
  onCreateTrip: (newTrip: Trip) => void;
  onDeleteTrip: (tripId: string) => void;
}

interface DestinationPreset {
  name: string;
  country: string;
  lat: number;
  lng: number;
  zoom: number;
  bgUrl: string;
}

const PRESET_DESTINATIONS: DestinationPreset[] = [
  {
    name: 'Tokyo',
    country: 'Japan',
    lat: 35.6762,
    lng: 139.6503,
    zoom: 13,
    bgUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Paris',
    country: 'France',
    lat: 48.8566,
    lng: 2.3522,
    zoom: 13,
    bgUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Kyoto',
    country: 'Japan',
    lat: 35.0116,
    lng: 135.7681,
    zoom: 13,
    bgUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'New York City',
    country: 'USA',
    lat: 40.7128,
    lng: -74.0060,
    zoom: 13,
    bgUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'London',
    country: 'United Kingdom',
    lat: 51.5074,
    lng: -0.1278,
    zoom: 13,
    bgUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Rome',
    country: 'Italy',
    lat: 41.9028,
    lng: 12.4964,
    zoom: 13,
    bgUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Barcelona',
    country: 'Spain',
    lat: 41.3851,
    lng: 2.1734,
    zoom: 13,
    bgUrl: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'San Francisco',
    country: 'USA',
    lat: 37.7749,
    lng: -122.4194,
    zoom: 13,
    bgUrl: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=600&auto=format&fit=crop&q=80',
  },
];

export const TripSelectorModal: React.FC<TripSelectorModalProps> = ({
  isOpen,
  onClose,
  trips,
  activeTripId,
  onSelectTrip,
  onCreateTrip,
  onDeleteTrip,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'switch' | 'create'>('switch');

  // Form State for Planning New Trip
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('2026-10-15');
  const [endDate, setEndDate] = useState('2026-10-18');
  const [selectedPreset, setSelectedPreset] = useState<DestinationPreset | null>(PRESET_DESTINATIONS[0]);

  const handleSelectPreset = (preset: DestinationPreset) => {
    setSelectedPreset(preset);
    setDestination(`${preset.name}, ${preset.country}`);
    if (!title || title.includes('Trip') || title.includes('Journey')) {
      setTitle(`${preset.name} Explorer Journey`);
    }
  };

  const handleCreateNewTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate total days (inclusive)
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

    const newDays: TripDay[] = [];
    for (let i = 0; i < totalDays; i++) {
      const dayDate = new Date(start);
      dayDate.setDate(dayDate.getDate() + i);
      const dateStr = dayDate.toISOString().split('T')[0];
      newDays.push({
        id: `day-${i + 1}-${Date.now()}`,
        dayNumber: i + 1,
        date: dateStr,
        title: `Day ${i + 1}: ${destination.split(',')[0]} Highlights`,
        activities: [],
      });
    }

    const lat = selectedPreset ? selectedPreset.lat : 35.6762;
    const lng = selectedPreset ? selectedPreset.lng : 139.6503;
    const zoom = selectedPreset ? selectedPreset.zoom : 13;

    const newTrip: Trip = {
      id: `trip-${Date.now()}`,
      title: title.trim() || `${destination.split(',')[0]} Itinerary`,
      destination: destination.trim(),
      center: { lat, lng },
      zoom,
      startDate,
      endDate,
      days: newDays,
      shelfActivities: [],
      companions: [
        {
          id: `comp-${Date.now()}`,
          name: 'You (Organizer)',
          email: 'organizer@travel.io',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
          color: '#3b82f6',
          isOnline: true,
          lastActive: 'Just now',
          role: 'owner',
        },
      ],
      isFinalized: false,
      updatedAt: new Date().toISOString(),
    };

    onCreateTrip(newTrip);
    onSelectTrip(newTrip.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in select-none">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Trip Manager & Destinations
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Plan multiple itineraries across different locations and dates
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-4 border-b border-slate-200 dark:border-slate-800 flex gap-4">
          <button
            onClick={() => setActiveTab('switch')}
            className={`pb-3 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'switch'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Saved Trips ({trips.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'create'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Plan New Trip</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {activeTab === 'switch' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select Active Itinerary
                </span>
                <button
                  onClick={() => setActiveTab('create')}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Destination</span>
                </button>
              </div>

              {trips.map((trip) => {
                const isActive = trip.id === activeTripId;
                const totalActivities = trip.days.reduce((acc, d) => acc + d.activities.length, 0);
                const shelfCount = trip.shelfActivities?.length || 0;

                return (
                  <div
                    key={trip.id}
                    onClick={() => {
                      onSelectTrip(trip.id);
                      onClose();
                    }}
                    className={`p-4 rounded-2xl border transition flex items-center justify-between cursor-pointer group ${
                      isActive
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        <Compass className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                            {trip.title}
                          </h4>
                          {isActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span className="flex items-center gap-1 font-medium">
                            <MapPin className="w-3 h-3 text-red-500" />
                            {trip.destination}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {trip.days.length} Days ({trip.startDate} to {trip.endDate})
                          </span>
                          <span>•</span>
                          <span>{totalActivities} scheduled, {shelfCount} on shelf</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {trips.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete trip "${trip.title}"?`)) {
                              onDeleteTrip(trip.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                          title="Delete trip"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition ${
                        isActive ? 'bg-blue-600 text-white' : 'text-slate-300 group-hover:text-slate-500'
                      }`}>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleCreateNewTrip} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Popular Destinations (Quick Select)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESET_DESTINATIONS.map((preset) => {
                    const isSelected = selectedPreset?.name === preset.name;
                    return (
                      <button
                        type="button"
                        key={preset.name}
                        onClick={() => handleSelectPreset(preset)}
                        className={`p-2.5 rounded-2xl border text-left transition flex flex-col justify-between h-20 cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {preset.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {preset.country}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    General Location / City
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="e.g. Kyoto, Japan or Rome, Italy"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Trip Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Autumn Temples & Tea Houses"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Start Date
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    End Date
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      required
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('switch')}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Plane className="w-3.5 h-3.5" />
                  <span>Create & Open Itinerary</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
