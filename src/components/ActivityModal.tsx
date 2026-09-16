import React, { useState, useEffect, useMemo } from 'react';
import { Activity, BusinessHours, LocationInfo } from '../types';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { formatTime12h } from '../utils/geo';
import { 
  X, 
  MapPin, 
  Clock, 
  Search, 
  Sparkles, 
  Building2, 
  Layers, 
  Star, 
  Globe, 
  ExternalLink,
  Compass,
  CheckCircle2
} from 'lucide-react';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToShelf: (activity: Activity) => void;
  tripDestination?: string;
  tripCenter?: { lat: number; lng: number };
  apiKey?: string;
  isOffline?: boolean;
}

interface PlaceSearchResult {
  name: string;
  address: string;
  category: Activity['category'];
  lat: number;
  lng: number;
  rating: number;
  userRatingCount?: number;
  photoUrl?: string;
  businessHours: BusinessHours;
  googleMapsType: string;
}

// Rich Google Maps places database covering major destinations
const GLOBAL_PLACES_DATABASE: PlaceSearchResult[] = [
  // Tokyo Places
  {
    name: 'Akihabara Electric Town & Retro Arcades',
    address: 'Sotokanda, Chiyoda City, Tokyo 101-0021',
    category: 'shopping',
    lat: 35.6983,
    lng: 139.7731,
    rating: 4.5,
    userRatingCount: 38200,
    googleMapsType: 'Shopping Mall / Electronics',
    photoUrl: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=600&auto=format&fit=crop&q=80',
    businessHours: {
      open: '10:00',
      close: '20:30',
      isOpenToday: true,
      rawText: 'Daily: 10:00 AM – 8:30 PM',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    },
  },
  {
    name: 'Roppongi Hills Mori Art Museum',
    address: '6 Chome-10-1 Roppongi, Minato City, Tokyo 106-6150',
    category: 'culture',
    lat: 35.6628,
    lng: 139.7292,
    rating: 4.6,
    userRatingCount: 19400,
    googleMapsType: 'Art Museum / Landmark',
    photoUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80',
    businessHours: {
      open: '10:00',
      close: '22:00',
      isOpenToday: true,
      rawText: 'Wed–Mon: 10:00 AM – 10:00 PM (Tue closes 5:00 PM)',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    },
  },
  {
    name: 'Shinjuku Gyoen National Garden',
    address: '11 Naitomachi, Shinjuku City, Tokyo 160-0014',
    category: 'relaxation',
    lat: 35.6852,
    lng: 139.7101,
    rating: 4.7,
    userRatingCount: 31200,
    googleMapsType: 'National Park / Botanical Garden',
    photoUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600&auto=format&fit=crop&q=80',
    businessHours: {
      open: '09:00',
      close: '17:30',
      isOpenToday: true,
      rawText: 'Tue–Sun: 9:00 AM – 5:30 PM (Closed Mon)',
      daysOpen: [0, 2, 3, 4, 5, 6],
    },
  },
  {
    name: 'Omoide Yokocho Yakitori Alley',
    address: '1 Chome-2 Nishishinjuku, Shinjuku City, Tokyo 160-0023',
    category: 'dining',
    lat: 35.6934,
    lng: 139.6997,
    rating: 4.5,
    userRatingCount: 14800,
    googleMapsType: 'Izakaya & Street Food Alley',
    photoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80',
    businessHours: {
      open: '16:00',
      close: '23:30',
      isOpenToday: true,
      rawText: 'Daily: 4:00 PM – 11:30 PM',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    },
  },
  {
    name: 'Tokyo Skytree 360° Observation Deck',
    address: '1 Chome-1-2 Oshiage, Sumida City, Tokyo 131-0045',
    category: 'sightseeing',
    lat: 35.7100,
    lng: 139.8107,
    rating: 4.6,
    userRatingCount: 62000,
    googleMapsType: 'Observation Deck & Tower',
    photoUrl: 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=600&auto=format&fit=crop&q=80',
    businessHours: {
      open: '10:00',
      close: '21:00',
      isOpenToday: true,
      rawText: 'Daily: 10:00 AM – 9:00 PM (Last admission 8:00 PM)',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    },
  },
  {
    name: 'Tsukiji Outer Market Fresh Seafood',
    address: '4 Chome-16-2 Tsukiji, Chuo City, Tokyo 104-0045',
    category: 'dining',
    lat: 35.6654,
    lng: 139.7707,
    rating: 4.4,
    userRatingCount: 22000,
    googleMapsType: 'Food Market / Seafood',
    businessHours: {
      open: '08:00',
      close: '14:00',
      isOpenToday: true,
      rawText: 'Daily: 8:00 AM – 2:00 PM',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    },
  },

  // Paris Places
  {
    name: 'Musée d’Orsay Impressionism',
    address: '1 Rue de la Légion d’Honneur, 75007 Paris, France',
    category: 'culture',
    lat: 48.8599,
    lng: 2.3265,
    rating: 4.8,
    userRatingCount: 88000,
    googleMapsType: 'National Art Museum',
    businessHours: {
      open: '09:30',
      close: '18:00',
      isOpenToday: true,
      rawText: 'Tue–Sun: 9:30 AM – 6:00 PM (Closed Mon)',
      daysOpen: [0, 2, 3, 4, 5, 6],
    },
  },
  {
    name: 'Café de Flore Historic Bistro',
    address: '172 Boulevard Saint-Germain, 75006 Paris, France',
    category: 'dining',
    lat: 48.8541,
    lng: 2.3326,
    rating: 4.3,
    userRatingCount: 15400,
    googleMapsType: 'French Café & Restaurant',
    businessHours: {
      open: '07:30',
      close: '23:30',
      isOpenToday: true,
      rawText: 'Daily: 7:30 AM – 11:30 PM',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    },
  },
  {
    name: 'Sainte-Chapelle Royal Gothic Chapel',
    address: '10 Boulevard du Palais, 75001 Paris, France',
    category: 'culture',
    lat: 48.8554,
    lng: 2.3450,
    rating: 4.7,
    userRatingCount: 52000,
    googleMapsType: 'Historic Royal Chapel / Monument',
    businessHours: {
      open: '09:00',
      close: '19:00',
      isOpenToday: true,
      rawText: 'Daily: 9:00 AM – 7:00 PM',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    },
  },
  {
    name: 'Jardin du Luxembourg Palace & Gardens',
    address: '75006 Paris, France',
    category: 'relaxation',
    lat: 48.8462,
    lng: 2.3372,
    rating: 4.7,
    userRatingCount: 94000,
    googleMapsType: 'Public Botanical Garden / Palace Grounds',
    businessHours: {
      open: '07:30',
      close: '20:00',
      isOpenToday: true,
      rawText: 'Daily: 7:30 AM – 8:00 PM',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    },
  },

  // New York Places
  {
    name: 'The Metropolitan Museum of Art (The Met)',
    address: '1000 5th Ave, New York, NY 10028',
    category: 'culture',
    lat: 40.7794,
    lng: -73.9632,
    rating: 4.8,
    userRatingCount: 120000,
    googleMapsType: 'Art Museum / Cultural Center',
    businessHours: {
      open: '10:00',
      close: '17:00',
      isOpenToday: true,
      rawText: 'Sun–Tue, Thu: 10:00 AM – 5:00 PM (Fri–Sat till 9:00 PM)',
      daysOpen: [0, 1, 2, 4, 5, 6],
    },
  },
  {
    name: 'Central Park Bethesda Terrace',
    address: '72 Terrace Dr, New York, NY 10021',
    category: 'relaxation',
    lat: 40.7738,
    lng: -73.9708,
    rating: 4.8,
    userRatingCount: 45000,
    googleMapsType: 'City Park / Scenic Promenade',
    businessHours: {
      open: '06:00',
      close: '01:00',
      isOpenToday: true,
      rawText: 'Daily: 6:00 AM – 1:00 AM',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    },
  },
  {
    name: 'Katz’s Delicatessen Pastrami',
    address: '205 E Houston St, New York, NY 10002',
    category: 'dining',
    lat: 40.7222,
    lng: -73.9874,
    rating: 4.5,
    userRatingCount: 42000,
    googleMapsType: 'Historic Jewish Deli & Restaurant',
    businessHours: {
      open: '08:00',
      close: '23:00',
      isOpenToday: true,
      rawText: 'Daily: 8:00 AM – 11:00 PM (24 hours Fri–Sat)',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    },
  },
];

export const ActivityModal: React.FC<ActivityModalProps> = ({
  isOpen,
  onClose,
  onAddToShelf,
  tripDestination = 'Tokyo, Japan',
  tripCenter = { lat: 35.6762, lng: 139.6503 },
  apiKey = '',
  isOffline = false,
}) => {
  if (!isOpen) return null;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(GLOBAL_PLACES_DATABASE[0]);
  const [notes, setNotes] = useState('');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');

  // Filter places based on search query or default destination
  const filteredPlaces = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      // Prioritize places matching the destination name
      const destPrefix = tripDestination.split(',')[0].toLowerCase();
      const relevant = GLOBAL_PLACES_DATABASE.filter(
        (p) => p.address.toLowerCase().includes(destPrefix) || p.name.toLowerCase().includes(destPrefix)
      );
      return relevant.length > 0 ? relevant : GLOBAL_PLACES_DATABASE.slice(0, 6);
    }

    return GLOBAL_PLACES_DATABASE.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.googleMapsType.toLowerCase().includes(q)
    );
  }, [searchQuery, tripDestination]);

  // If user searched for custom place not in DB, allow dynamic place pinning
  const handleSelectCustomPlace = (customName: string) => {
    const defaultHours: BusinessHours = {
      open: '09:00',
      close: '20:00',
      isOpenToday: true,
      rawText: 'Open daily: 9:00 AM – 8:00 PM',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    };

    // Determine category based on keywords
    let cat: Activity['category'] = 'sightseeing';
    const lower = customName.toLowerCase();
    if (lower.includes('café') || lower.includes('coffee') || lower.includes('restaurant') || lower.includes('ramen') || lower.includes('bistro') || lower.includes('bar')) {
      cat = 'dining';
    } else if (lower.includes('museum') || lower.includes('temple') || lower.includes('shrine') || lower.includes('church') || lower.includes('gallery')) {
      cat = 'culture';
    } else if (lower.includes('market') || lower.includes('mall') || lower.includes('store') || lower.includes('shop')) {
      cat = 'shopping';
    } else if (lower.includes('park') || lower.includes('garden') || lower.includes('spa') || lower.includes('onsen')) {
      cat = 'relaxation';
    }

    const customPlace: PlaceSearchResult = {
      name: customName,
      address: `${customName}, ${tripDestination}`,
      category: cat,
      lat: tripCenter.lat + (Math.random() - 0.5) * 0.02,
      lng: tripCenter.lng + (Math.random() - 0.5) * 0.02,
      rating: 4.6,
      googleMapsType: 'Point of Interest (Google Maps)',
      businessHours: defaultHours,
    };

    setSelectedPlace(customPlace);
  };

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlace) return;

    const newActivity: Activity = {
      id: `act-${Date.now()}`,
      title: selectedPlace.name,
      category: selectedPlace.category,
      location: {
        name: selectedPlace.name,
        address: selectedPlace.address,
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        rating: selectedPlace.rating,
        userRatingCount: selectedPlace.userRatingCount,
        photoUrl: selectedPlace.photoUrl,
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedPlace.name + ' ' + selectedPlace.address)}`,
      },
      businessHours: selectedPlace.businessHours,
      startTime: '', // Unscheduled, resides in shelf
      durationMinutes: 90, // Default duration ready for agenda
      notes: notes.trim(),
      color: 
        selectedPlace.category === 'dining' ? '#f97316' :
        selectedPlace.category === 'culture' ? '#ef4444' :
        selectedPlace.category === 'shopping' ? '#06b6d4' :
        selectedPlace.category === 'relaxation' ? '#10b981' :
        selectedPlace.category === 'entertainment' ? '#ec4899' : '#3b82f6',
    };

    onAddToShelf(newActivity);
    onClose();
  };

  const hasRealKey = Boolean(apiKey && apiKey.trim().length > 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in select-none">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[90vh] max-h-[760px] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Add Activity via Google Maps
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  Adds to Activity Shelf
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Search locations, review Google Maps hours & category, and save to shelf
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

        {/* Modal Main Grid: Left Search & Form, Right Embedded Google Maps Mirror */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Column: Place Search, Category & Hours (from Google Maps), Notes */}
          <div className="md:col-span-5 border-r border-slate-200 dark:border-slate-800 p-5 overflow-y-auto flex flex-col gap-4">
            {/* Search Google Maps Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Search Google Maps Places
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Art Museum, Ramen shop, Temple, Park..."
                  className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>
            </div>

            {/* Live Search Results List */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {filteredPlaces.map((place) => {
                const isSelected = selectedPlace?.name === place.name;
                return (
                  <button
                    key={place.name}
                    type="button"
                    onClick={() => setSelectedPlace(place)}
                    className={`w-full text-left p-2.5 rounded-xl border transition flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30 ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/60'
                    }`}
                  >
                    <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {place.name}
                        </p>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase shrink-0 ml-1">
                          {place.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {place.address}
                      </p>
                    </div>
                  </button>
                );
              })}

              {/* Allow searching arbitrary custom place */}
              {searchQuery.trim().length > 2 && (
                <button
                  type="button"
                  onClick={() => handleSelectCustomPlace(searchQuery.trim())}
                  className="w-full text-left p-2.5 rounded-xl border border-dashed border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Pin custom location: &ldquo;{searchQuery.trim()}&rdquo;</span>
                </button>
              )}
            </div>

            {/* Selected Place Google Maps Metadata Card */}
            {selectedPlace && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Google Maps Data
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {selectedPlace.name}
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {selectedPlace.category}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span className="truncate">{selectedPlace.address}</span>
                </div>

                {/* Google Maps Inferred Business Hours */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-700/60 border border-slate-200/80 dark:border-slate-600/60 text-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Business Hours (Google Maps)</span>
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                      Open Today
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedPlace.businessHours.rawText || `${formatTime12h(selectedPlace.businessHours.open)} – ${formatTime12h(selectedPlace.businessHours.close)}`}
                  </p>
                </div>
              </div>
            )}

            {/* Notes Section (Paragraph) */}
            <form onSubmit={handleAddActivity} className="flex flex-col gap-3 mt-auto">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Trip Notes / Instructions (Paragraph)
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add tips, reservation codes, photography spots, ticket links, or group reminders..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs resize-none"
                />
              </div>

              {/* Shelf Notification Callout */}
              <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Layers className="w-4 h-4 shrink-0 text-blue-600" />
                <span>
                  Adding places this on your <strong>Activity Shelf</strong> above the agenda. You can switch days and drag it onto the calendar whenever you wish!
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedPlace}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Layers className="w-4 h-4" />
                  <span>Add to Activity Shelf</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Embedded Google Maps Mirror / Preview */}
          <div className="md:col-span-7 relative h-full bg-slate-100 dark:bg-slate-950 flex flex-col overflow-hidden">
            {selectedPlace && (
              <>
                {hasRealKey && !isOffline ? (
                  <APIProvider apiKey={apiKey}>
                    <Map
                      center={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
                      zoom={15}
                      mapId="DEMO_MAP_ID"
                      mapTypeId={mapType}
                      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                      style={{ width: '100%', height: '100%' }}
                      disableDefaultUI={false}
                      gestureHandling={'greedy'}
                    >
                      <AdvancedMarker
                        position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
                        title={selectedPlace.name}
                      >
                        <Pin
                          background={
                            selectedPlace.category === 'dining' ? '#f97316' :
                            selectedPlace.category === 'culture' ? '#ef4444' :
                            selectedPlace.category === 'shopping' ? '#06b6d4' :
                            selectedPlace.category === 'relaxation' ? '#10b981' : '#3b82f6'
                          }
                          borderColor="#ffffff"
                          glyphColor="#ffffff"
                        />
                      </AdvancedMarker>
                    </Map>
                  </APIProvider>
                ) : (
                  /* Vector Interactive Map Mirror */
                  <div className="relative w-full h-full bg-[#f1f5f9] dark:bg-[#0b1120] flex items-center justify-center p-6">
                    <div className="w-full h-full max-w-lg max-h-[460px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
                      {/* Photo or Banner Header */}
                      <div className="h-44 relative overflow-hidden bg-slate-800">
                        {selectedPlace.photoUrl ? (
                          <img
                            src={selectedPlace.photoUrl}
                            alt={selectedPlace.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-blue-900 to-indigo-900 text-white">
                            <Compass className="w-12 h-12 opacity-40 animate-pulse" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                        
                        <div className="absolute bottom-3 left-3 right-3 text-white">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-600/90 text-white">
                            Google Maps Pinned Location
                          </span>
                          <h4 className="text-base font-bold mt-1 leading-tight drop-shadow-sm">
                            {selectedPlace.name}
                          </h4>
                          <p className="text-xs text-white/80 truncate mt-0.5">
                            {selectedPlace.address}
                          </p>
                        </div>
                      </div>

                      {/* Map Coordinates & Info Body */}
                      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] text-slate-400 font-medium">Place Category</span>
                            <p className="font-bold text-slate-800 dark:text-slate-100 capitalize mt-0.5">
                              {selectedPlace.category}
                            </p>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] text-slate-400 font-medium">Google Rating</span>
                            <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                              <span>{selectedPlace.rating}</span>
                              <span className="text-slate-400 font-normal">
                                ({selectedPlace.userRatingCount?.toLocaleString() || '12k+'})
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">
                            Coordinates: {selectedPlace.lat.toFixed(4)}° N, {selectedPlace.lng.toFixed(4)}° E
                          </span>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedPlace.name + ' ' + selectedPlace.address)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 hover:underline"
                          >
                            <span>Open on Maps</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Floating Map Controls overlay */}
                <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
                  <div className="pointer-events-auto bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl px-3.5 py-2 shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px]">
                      {selectedPlace.name}
                    </span>
                  </div>

                  {hasRealKey && !isOffline && (
                    <div className="pointer-events-auto flex items-center gap-1 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => setMapType('roadmap')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                          mapType === 'roadmap' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Map
                      </button>
                      <button
                        onClick={() => setMapType('satellite')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                          mapType === 'satellite' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Satellite
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
