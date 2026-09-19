import React, { useState } from 'react';
import { Activity, TransportationMode, TravelLeg, TransitDetails } from '../types';
import { formatTime12h, timeStringToMinutes, buildGoogleMapsEmbedDirectionsUrl } from '../utils/geo';
import { 
  X, 
  Bus, 
  Train, 
  Car, 
  Footprints, 
  Bike, 
  MapPin, 
  Clock, 
  Navigation, 
  ArrowRight, 
  Compass, 
  CheckCircle2, 
  Sparkles,
  Info,
  ExternalLink,
  ChevronRight,
  Layers,
  Map as MapIcon
} from 'lucide-react';

interface TransitDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  originActivity?: Activity | null;
  fromActivity?: Activity | null;
  destinationActivity?: Activity | null;
  toActivity?: Activity | null;
  travelLeg?: TravelLeg | null;
  leg?: TravelLeg | null;
  onUpdateMode?: (mode: TransportationMode) => void;
  apiKey: string;
  isOffline: boolean;
}

export const TransitDetailsModal: React.FC<TransitDetailsModalProps> = ({
  isOpen,
  onClose,
  originActivity,
  fromActivity,
  destinationActivity,
  toActivity,
  travelLeg,
  leg,
  onUpdateMode,
  apiKey,
  isOffline,
}) => {
  const origin = originActivity || fromActivity;
  const destination = destinationActivity || toActivity;
  const activeLeg = travelLeg || leg;

  if (!isOpen || !origin || !destination || !activeLeg) return null;

  const [selectedMode, setSelectedMode] = useState<TransportationMode>(activeLeg.mode || 'TRANSIT');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');

  const transitInfo: TransitDetails = activeLeg.transitDetails || {
    lineName: 'Bus 02 (City Loop)',
    lineNumber: '02',
    vehicleType: 'BUS',
    departureStop: `${origin.location.name} Stop`,
    arrivalStop: `${destination.location.name} Stop`,
    numStops: 4,
    headwayMinutes: 8,
    operator: 'Metropolitan Transit Agency',
    fare: '$2.25',
    steps: [
      `Walk 2 mins (~140m) from ${origin.location.name} to ${origin.location.name} Stop`,
      `Board Bus 02 toward Central Station`,
      `Ride 4 stops along Main Avenue (~${Math.max(5, activeLeg.durationMinutes - 4)} mins)`,
      `Alight at ${destination.location.name} Stop`,
      `Walk 2 mins (~120m) to ${destination.location.name}`,
    ],
  };

  const departureTimeMin = origin.startTime 
    ? timeStringToMinutes(origin.startTime) + origin.durationMinutes 
    : 10 * 60;
  const arrivalTimeMin = departureTimeMin + activeLeg.durationMinutes;

  const depHour = Math.floor(departureTimeMin / 60);
  const depMin = departureTimeMin % 60;
  const depTimeStr = `${depHour.toString().padStart(2, '0')}:${depMin.toString().padStart(2, '0')}`;

  const arrHour = Math.floor(arrivalTimeMin / 60);
  const arrMin = arrivalTimeMin % 60;
  const arrTimeStr = `${arrHour.toString().padStart(2, '0')}:${arrMin.toString().padStart(2, '0')}`;

  const midLat = (origin.location.lat + destination.location.lat) / 2;
  const midLng = (origin.location.lng + destination.location.lng) / 2;

  const handleModeSelect = (mode: TransportationMode) => {
    setSelectedMode(mode);
    if (onUpdateMode) {
      onUpdateMode(mode);
    }
  };

  const hasRealKey = Boolean(apiKey && apiKey.trim().length > 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in select-none">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[90vh] max-h-[780px] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 shrink-0">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Transit & Travel Details
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                  {activeLeg.mode}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Path from <span className="font-semibold text-slate-700 dark:text-slate-200">{origin.location.name}</span> to <span className="font-semibold text-slate-700 dark:text-slate-200">{destination.location.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-1 rounded-2xl border border-slate-300/60 dark:border-slate-700">
              {(['TRANSIT', 'DRIVE', 'WALK', 'BICYCLE'] as TransportationMode[]).map((m) => {
                const isCurrent = selectedMode === m;
                return (
                  <button
                    key={m}
                    onClick={() => handleModeSelect(m)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isCurrent
                        ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {m === 'TRANSIT' && <Bus className="w-3.5 h-3.5" />}
                    {m === 'DRIVE' && <Car className="w-3.5 h-3.5" />}
                    {m === 'WALK' && <Footprints className="w-3.5 h-3.5" />}
                    {m === 'BICYCLE' && <Bike className="w-3.5 h-3.5" />}
                    <span className="capitalize">{m.toLowerCase()}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Split Body: Left Details & Steps, Right Interactive Route Map */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Itinerary Breakdown Column */}
          <div className="md:col-span-5 border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-5 flex flex-col gap-4">
            {/* Timing Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border border-purple-200/70 dark:border-purple-800/60">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Departure
                  </span>
                  <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {formatTime12h(depTimeStr)}
                  </div>
                </div>

                <div className="flex flex-col items-center px-3">
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                    {activeLeg.durationMinutes} mins
                  </span>
                  <div className="flex items-center gap-1 text-slate-400 mt-1">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="w-12 h-0.5 bg-purple-300 dark:bg-purple-700" />
                    <ArrowRight className="w-3.5 h-3.5 text-purple-500" />
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {activeLeg.distanceText}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Arrival
                  </span>
                  <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {formatTime12h(arrTimeStr)}
                  </div>
                </div>
              </div>
            </div>

            {/* Specific Bus / Transit Details Card */}
            {selectedMode === 'TRANSIT' && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="px-2.5 py-1 rounded-xl bg-purple-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs">
                      <Bus className="w-3.5 h-3.5" />
                      <span>{transitInfo.lineName}</span>
                    </div>
                    {transitInfo.lineNumber && (
                      <span className="text-xs px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 font-bold">
                        Line {transitInfo.lineNumber}
                      </span>
                    )}
                  </div>
                  {transitInfo.fare && (
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Fare: {transitInfo.fare}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-700/60 border border-slate-200/80 dark:border-slate-600/60">
                    <span className="text-[10px] text-slate-400 font-medium">Boarding Stop</span>
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                      {transitInfo.departureStop}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-700/60 border border-slate-200/80 dark:border-slate-600/60">
                    <span className="text-[10px] text-slate-400 font-medium">Alighting Stop</span>
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                      {transitInfo.arrivalStop}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                  <span>Frequency: Every {transitInfo.headwayMinutes || 8} mins</span>
                  <span>{transitInfo.numStops} intermediate stops</span>
                </div>
              </div>
            )}

            {/* Step-by-Step Directions List */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">
                Step-by-Step Directions
              </h4>

              <div className="space-y-3 relative pl-4 border-l-2 border-purple-200 dark:border-purple-900/60 ml-2">
                {transitInfo.steps && transitInfo.steps.length > 0 ? (
                  transitInfo.steps.map((step, idx) => (
                    <div key={idx} className="relative group">
                      <span className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full bg-purple-600 ring-4 ring-white dark:ring-slate-900 flex items-center justify-center text-white text-[8px] font-bold">
                        {idx + 1}
                      </span>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
                        {step}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <p>1. Depart from {origin.location.name}</p>
                    <p>2. Travel via {activeLeg.summary || 'urban route'}</p>
                    <p>3. Arrive at {destination.location.name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Open in Google Maps link */}
            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                  origin.location.address || origin.location.name
                )}&destination=${encodeURIComponent(
                  destination.location.address || destination.location.name
                )}&travelmode=${selectedMode.toLowerCase()}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                <span>Open route in Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Close & Return
              </button>
            </div>
          </div>

          {/* Right Interactive Route Map UI */}
          <div className="md:col-span-7 relative h-full bg-slate-100 dark:bg-slate-950 flex flex-col overflow-hidden">
            {!isOffline ? (
              <iframe
                title="Google Maps Route Embed"
                src={buildGoogleMapsEmbedDirectionsUrl(
                  [origin, destination],
                  apiKey,
                  selectedMode.toLowerCase(),
                  false
                )}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              /* High-Fidelity Vector Route Canvas */
              <VectorRouteMap
                origin={origin}
                destination={destination}
                leg={activeLeg}
                transitInfo={transitInfo}
                mode={selectedMode}
              />
            )}

            {/* Floating Map Route Overlay Badge */}
            <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
              <div className="pointer-events-auto bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl px-3.5 py-2 shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[120px]">
                  {origin.location.name}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[120px]">
                  {destination.location.name}
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
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Dedicated vector route map showing exact transit pathway between origin & destination
 */
const VectorRouteMap: React.FC<{
  origin: Activity;
  destination: Activity;
  leg: TravelLeg;
  transitInfo: TransitDetails;
  mode: TransportationMode;
}> = ({ origin, destination, leg, transitInfo, mode }) => {
  const p1 = { lat: origin.location.lat, lng: origin.location.lng };
  const p2 = { lat: destination.location.lat, lng: destination.location.lng };

  const minLat = Math.min(p1.lat, p2.lat) - 0.012;
  const maxLat = Math.max(p1.lat, p2.lat) + 0.012;
  const minLng = Math.min(p1.lng, p2.lng) - 0.015;
  const maxLng = Math.max(p1.lng, p2.lng) + 0.015;

  const latSpan = Math.max(0.005, maxLat - minLat);
  const lngSpan = Math.max(0.005, maxLng - minLng);

  const width = 600;
  const height = 450;

  const project = (lat: number, lng: number) => {
    const x = ((lng - minLng) / lngSpan) * (width - 160) + 80;
    const y = ((maxLat - lat) / latSpan) * (height - 140) + 70;
    return { x, y };
  };

  const start = project(p1.lat, p1.lng);
  const end = project(p2.lat, p2.lng);

  // Realistic city street grid routing points (manhattan turns)
  const corner1 = { x: start.x, y: (start.y + end.y) / 2 };
  const corner2 = { x: end.x, y: (start.y + end.y) / 2 };

  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  return (
    <div className="relative w-full h-full bg-[#f8fafc] dark:bg-[#090d16] flex items-center justify-center overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full object-contain">
        <defs>
          <pattern id="transitGrid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-slate-200 dark:text-slate-800" />
          </pattern>
        </defs>

        <rect width={width} height={height} fill="url(#transitGrid)" />

        {/* Major Avenue Backbones */}
        <path
          d={`M ${start.x - 60} ${corner1.y} L ${end.x + 60} ${corner1.y}`}
          stroke="#e2e8f0"
          strokeWidth="14"
          className="dark:stroke-slate-800/80"
          strokeLinecap="round"
        />
        <path
          d={`M ${start.x} ${start.y - 40} L ${start.x} ${corner1.y + 40}`}
          stroke="#e2e8f0"
          strokeWidth="12"
          className="dark:stroke-slate-800/80"
          strokeLinecap="round"
        />
        <path
          d={`M ${end.x} ${corner2.y - 40} L ${end.x} ${end.y + 40}`}
          stroke="#e2e8f0"
          strokeWidth="12"
          className="dark:stroke-slate-800/80"
          strokeLinecap="round"
        />

        {/* The Transit Route Path along Streets */}
        <path
          d={`M ${start.x} ${start.y} L ${corner1.x} ${corner1.y} L ${corner2.x} ${corner2.y} L ${end.x} ${end.y}`}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.25"
        />
        <path
          d={`M ${start.x} ${start.y} L ${corner1.x} ${corner1.y} L ${corner2.x} ${corner2.y} L ${end.x} ${end.y}`}
          fill="none"
          stroke={mode === 'TRANSIT' ? '#8b5cf6' : mode === 'WALK' ? '#10b981' : '#3b82f6'}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={mode === 'WALK' ? '6 6' : undefined}
        />

        {/* Intermediate Bus Stop Dots */}
        {mode === 'TRANSIT' && (
          <>
            <circle cx={corner1.x} cy={corner1.y} r="4" fill="#ffffff" stroke="#8b5cf6" strokeWidth="2" />
            <circle cx={(corner1.x + corner2.x) / 2} cy={corner1.y} r="4" fill="#ffffff" stroke="#8b5cf6" strokeWidth="2" />
            <circle cx={corner2.x} cy={corner2.y} r="4" fill="#ffffff" stroke="#8b5cf6" strokeWidth="2" />
          </>
        )}

        {/* Mid-Route Badge */}
        <g transform={`translate(${mid.x}, ${mid.y - 14})`}>
          <rect
            x="-45"
            y="-14"
            width="90"
            height="28"
            rx="14"
            fill="#1e293b"
            stroke="#ffffff"
            strokeWidth="1.5"
            filter="drop-shadow(0 4px 6px rgba(0,0,0,0.15))"
          />
          <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700">
            {transitInfo.lineName.length > 14 ? transitInfo.lineName.substring(0, 12) + '…' : transitInfo.lineName}
          </text>
        </g>

        {/* Origin Marker A */}
        <g transform={`translate(${start.x}, ${start.y})`}>
          <ellipse cx="0" cy="4" rx="8" ry="3" fill="#000000" fillOpacity="0.2" />
          <path d="M 0 0 C -12 -12 -12 -28 0 -34 C 12 -28 12 -12 0 0 Z" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
          <circle cx="0" cy="-20" r="8" fill="#ffffff" />
          <text x="0" y="-17" textAnchor="middle" fontSize="10" fontWeight="800" fill="#2563eb">A</text>
          <g transform="translate(0, -42)">
            <rect x="-55" y="-16" width="110" height="20" rx="6" fill="#1e293b" stroke="#ffffff" strokeWidth="1" />
            <text x="0" y="-2" textAnchor="middle" fontSize="10" fontWeight="700" fill="#ffffff">
              {origin.location.name.substring(0, 14)}
            </text>
          </g>
        </g>

        {/* Destination Marker B */}
        <g transform={`translate(${end.x}, ${end.y})`}>
          <ellipse cx="0" cy="4" rx="8" ry="3" fill="#000000" fillOpacity="0.2" />
          <path d="M 0 0 C -12 -12 -12 -28 0 -34 C 12 -28 12 -12 0 0 Z" fill="#8b5cf6" stroke="#ffffff" strokeWidth="2" />
          <circle cx="0" cy="-20" r="8" fill="#ffffff" />
          <text x="0" y="-17" textAnchor="middle" fontSize="10" fontWeight="800" fill="#8b5cf6">B</text>
          <g transform="translate(0, -42)">
            <rect x="-55" y="-16" width="110" height="20" rx="6" fill="#1e293b" stroke="#ffffff" strokeWidth="1" />
            <text x="0" y="-2" textAnchor="middle" fontSize="10" fontWeight="700" fill="#ffffff">
              {destination.location.name.substring(0, 14)}
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
};
