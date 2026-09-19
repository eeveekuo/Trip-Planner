import React, { useState, useEffect, useMemo } from 'react';
import { Activity, BusinessHours, TripDay } from '../types';
import { formatTime12h, buildGoogleMapsEmbedPlaceUrl } from '../utils/geo';
import { 
  X, 
  MapPin, 
  Clock, 
  Search, 
  Sparkles, 
  Layers, 
  Star, 
  ExternalLink,
  Plus,
  Compass
} from 'lucide-react';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToShelf?: (activity: Activity) => void;
  onAddToList?: (activity: Activity, targetListId: string, startTime?: string) => void;
  tripDays?: TripDay[];
  defaultTargetListId?: string;
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
    name: 'Senso-ji Temple & Asakusa District',
    address: '2 Chome-3-1 Asakusa, Taito City, Tokyo 111-0032',
    category: 'culture',
    lat: 35.7148,
    lng: 139.7967,
    rating: 4.7,
    userRatingCount: 65400,
    googleMapsType: 'Buddhist Temple / Historic Landmark',
    photoUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600&auto=format&fit=crop&q=80',
    businessHours: {
      open: '06:00',
      close: '17:00',
      isOpenToday: true,
      rawText: 'Daily: 6:00 AM – 5:00 PM (Main Hall)',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    },
  },
  {
    name: 'Meiji Jingu Shrine & Forest',
    address: '1-1 Yoyogikamizonocho, Shibuya City, Tokyo 151-8557',
    category: 'culture',
    lat: 35.6764,
    lng: 139.6993,
    rating: 4.6,
    userRatingCount: 31200,
    googleMapsType: 'Shinto Shrine & Forest Park',
    businessHours: {
      open: '06:00',
      close: '18:00',
      isOpenToday: true,
      rawText: 'Daily: Sunrise to Sunset (approx 6:00 AM – 6:00 PM)',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    },
  },
  {
    name: 'Tsukiji Outer Market Fresh Seafood',
    address: '4 Chome-16-2 Tsukiji, Chuo City, Tokyo 104-0045',
    category: 'dining',
    lat: 35.6655,
    lng: 139.7708,
    rating: 4.4,
    userRatingCount: 29000,
    googleMapsType: 'Historic Fish & Street Food Market',
    businessHours: {
      open: '07:00',
      close: '14:00',
      isOpenToday: true,
      rawText: 'Daily: 7:00 AM – 2:00 PM',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    },
  },
  {
    name: 'Shibuya Sky & Scramble Crossing',
    address: '2 Chome-24-12 Shibuya, Shibuya City, Tokyo 150-0002',
    category: 'sightseeing',
    lat: 35.6585,
    lng: 139.7023,
    rating: 4.8,
    userRatingCount: 22000,
    googleMapsType: 'Observation Deck & Panoramic View',
    businessHours: {
      open: '10:00',
      close: '22:30',
      isOpenToday: true,
      rawText: 'Daily: 10:00 AM – 10:30 PM (Last entry 21:20)',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    },
  },
  {
    name: 'Roppongi Hills & Mori Art Museum',
    address: '6 Chome-10-1 Roppongi, Minato City, Tokyo 106-0032',
    category: 'entertainment',
    lat: 35.6605,
    lng: 139.7292,
    rating: 4.5,
    userRatingCount: 18400,
    googleMapsType: 'Contemporary Art Museum & Complex',
    businessHours: {
      open: '10:00',
      close: '22:00',
      isOpenToday: true,
      rawText: 'Daily: 10:00 AM – 10:00 PM (Tuesdays close at 5:00 PM)',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    },
  },
  // Paris Places
  {
    name: 'Louvre Museum & Glass Pyramid',
    address: 'Rue de Rivoli, 75001 Paris, France',
    category: 'culture',
    lat: 48.8606,
    lng: 2.3376,
    rating: 4.7,
    userRatingCount: 280000,
    googleMapsType: 'World Famous Art Museum',
    businessHours: {
      open: '09:00',
      close: '18:00',
      isOpenToday: true,
      rawText: 'Mon, Wed–Sun: 9:00 AM – 6:00 PM (Closed Tuesday, Fri open until 21:45)',
      daysOpen: [0, 1, 3, 4, 5, 6],
    },
  },
  {
    name: 'Eiffel Tower & Champ de Mars',
    address: 'Champ de Mars, 5 Av. Anatole France, 75007 Paris, France',
    category: 'sightseeing',
    lat: 48.8584,
    lng: 2.2945,
    rating: 4.6,
    userRatingCount: 340000,
    googleMapsType: 'Historic Wrought-Iron Monument',
    businessHours: {
      open: '09:00',
      close: '23:45',
      isOpenToday: true,
      rawText: 'Daily: 9:00 AM – 11:45 PM',
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
    userRatingCount: 95000,
    googleMapsType: 'Fine Art Museum',
    businessHours: {
      open: '10:00',
      close: '17:00',
      isOpenToday: true,
      rawText: 'Sun–Tue, Thu: 10:00 AM – 5:00 PM; Fri–Sat: 10:00 AM – 9:00 PM (Closed Wed)',
      daysOpen: [0, 1, 2, 4, 5, 6],
    },
  },
];

export const ActivityModal: React.FC<ActivityModalProps> = ({
  isOpen,
  onClose,
  onAddToShelf,
  onAddToList,
  tripDays = [],
  defaultTargetListId,
  tripDestination = 'Tokyo, Japan',
  tripCenter = { lat: 35.6762, lng: 139.6503 },
  apiKey = '',
  isOffline = false,
}) => {
  if (!isOpen) return null;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(GLOBAL_PLACES_DATABASE[0]);
  const [apiResults, setApiResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [notes, setNotes] = useState('');
  
  // Selected Target Google Maps List (Day List vs Activity Shelf List)
  const [targetListId, setTargetListId] = useState<string>(defaultTargetListId || 'shelf');
  const [startTime, setStartTime] = useState('09:30');

  // Debounced search query to backend /api/places/search
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setApiResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/places/search?query=${encodeURIComponent(q)}&lat=${tripCenter.lat}&lng=${tripCenter.lng}&destination=${encodeURIComponent(tripDestination)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.places) && data.places.length > 0) {
            const mapped: PlaceSearchResult[] = data.places.map((p: any) => ({
              name: p.name,
              address: p.address,
              category: p.category || 'sightseeing',
              lat: p.lat,
              lng: p.lng,
              rating: p.rating || 4.5,
              userRatingCount: p.userRatingCount || 1200,
              googleMapsType: p.category ? `${p.category.toUpperCase()} • Live Location` : 'Google Maps Location',
              photoUrl: p.photoUrl,
              businessHours: p.businessHours || {
                open: '09:00',
                close: '20:00',
                isOpenToday: true,
                rawText: 'Daily: 9:00 AM – 8:00 PM',
                daysOpen: [0, 1, 2, 3, 4, 5, 6],
              },
            }));
            setApiResults(mapped);
          } else {
            setApiResults([]);
          }
        }
      } catch (err) {
        console.error('Failed to search places:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, tripCenter.lat, tripCenter.lng, tripDestination]);

  // Combine static DB results and live API results
  const filteredPlaces = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      const destPrefix = tripDestination.split(',')[0].toLowerCase();
      const relevant = GLOBAL_PLACES_DATABASE.filter(
        (p) => p.address.toLowerCase().includes(destPrefix) || p.name.toLowerCase().includes(destPrefix)
      );
      return relevant.length > 0 ? relevant : GLOBAL_PLACES_DATABASE.slice(0, 6);
    }

    const staticMatches = GLOBAL_PLACES_DATABASE.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.googleMapsType.toLowerCase().includes(q)
    );

    const seen = new Set(staticMatches.map((s) => s.name.toLowerCase()));
    const additional = apiResults.filter((a) => !seen.has(a.name.toLowerCase()));

    return [...staticMatches, ...additional];
  }, [searchQuery, tripDestination, apiResults]);

  useEffect(() => {
    if (filteredPlaces.length > 0 && searchQuery.trim().length >= 2) {
      setSelectedPlace(filteredPlaces[0]);
    }
  }, [filteredPlaces, searchQuery]);

  const handleSelectCustomPlace = (customName: string) => {
    const defaultHours: BusinessHours = {
      open: '09:00',
      close: '20:00',
      isOpenToday: true,
      rawText: 'Open daily: 9:00 AM – 8:00 PM',
      daysOpen: [0, 1, 2, 3, 4, 5, 6],
    };

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
      startTime: '',
      durationMinutes: 90,
      notes: notes.trim(),
      color: 
        selectedPlace.category === 'dining' ? '#f97316' :
        selectedPlace.category === 'culture' ? '#ef4444' :
        selectedPlace.category === 'shopping' ? '#06b6d4' :
        selectedPlace.category === 'relaxation' ? '#10b981' :
        selectedPlace.category === 'entertainment' ? '#ec4899' : '#3b82f6',
    };

    if (onAddToShelf) {
      onAddToShelf(newActivity);
    } else if (onAddToList) {
      onAddToList(newActivity, 'shelf', '');
    }

    onClose();
  };

  // Google Maps Embed URL for selected place
  const embedPreviewUrl = useMemo(() => {
    if (!selectedPlace) return '';
    return buildGoogleMapsEmbedPlaceUrl(selectedPlace.name, selectedPlace.address, apiKey);
  }, [selectedPlace, apiKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in select-none">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[92vh] max-h-[780px] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95"
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
                  Add Place to Activity Shelf
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Search Google Maps places and save directly to your Activity Shelf List
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

        {/* Modal Main Grid: Left Search & Form, Right Google Maps Embed Preview */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Column: Place Search, Target List Selector, Hours, Notes */}
          <div className="md:col-span-5 border-r border-slate-200 dark:border-slate-800 p-5 overflow-y-auto flex flex-col gap-4">
            {/* Search Google Maps Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Search Google Maps Places
                </label>
                {isSearching ? (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
                    Searching live places…
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">
                    {filteredPlaces.length} places
                  </span>
                )}
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Asakusa, Museum, Ramen, Cafe..."
                  className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Live Search Results List */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
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

            {/* Direct Activity Shelf target notice */}
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center gap-3">
              <div className="w-8 h-8 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-blue-950 dark:text-blue-200">
                  Adds Directly to Activity Shelf List
                </h5>
                <p className="text-[11px] text-blue-700 dark:text-blue-300">
                  Unscheduled places bucket — easy to drag onto any day or view on the map.
                </p>
              </div>
            </div>

            {/* Selected Place Google Maps Metadata */}
            {selectedPlace && (
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {selectedPlace.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {selectedPlace.address}
                    </p>
                  </div>
                  {selectedPlace.rating && (
                    <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-lg text-[10px] font-bold shrink-0 border border-amber-200">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      <span>{selectedPlace.rating}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate">{selectedPlace.businessHours.rawText}</span>
                </div>
              </div>
            )}

            {/* Notes Section */}
            <form onSubmit={handleAddActivity} className="flex flex-col gap-3 mt-auto">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes, tips, ticket reservations..."
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
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
                  <Plus className="w-4 h-4" />
                  <span>Add to Activity Shelf</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Google Maps Embed Preview of Selected Place */}
          <div className="md:col-span-7 relative h-full bg-slate-100 dark:bg-slate-950 flex flex-col overflow-hidden">
            {selectedPlace && embedPreviewUrl ? (
              <div className="relative w-full h-full flex flex-col">
                <div className="px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-blue-600" />
                    <span>Google Maps Embed Preview</span>
                  </span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedPlace.name} ${selectedPlace.address}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 hover:underline"
                  >
                    <span>Open in Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <iframe
                  title="Place Embed Preview"
                  src={embedPreviewUrl}
                  className="w-full flex-1 border-0"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center p-6 text-center text-slate-400 text-xs">
                Select a place to preview in Google Maps Embed
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
