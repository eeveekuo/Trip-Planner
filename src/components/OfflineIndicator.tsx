import React from 'react';
import { WifiOff, Database } from 'lucide-react';

interface OfflineIndicatorProps {
  isOnline: boolean;
  onManageOffline: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOnline,
  onManageOffline,
}) => {
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2.5 rounded-2xl bg-amber-500 text-white px-3.5 py-2 text-xs font-semibold shadow-xl border border-amber-400 animate-in fade-in slide-in-from-bottom-2">
      <div className="relative">
        <WifiOff className="w-4 h-4" />
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white animate-ping" />
      </div>
      <span>Offline Mode — Using local saved itinerary & vector maps</span>
      <button
        onClick={onManageOffline}
        className="ml-1 underline text-white/90 hover:text-white cursor-pointer"
      >
        Details
      </button>
    </div>
  );
};
