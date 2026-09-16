import { useEffect, useState } from 'react';

export function useOnlineStatus() {
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  // Manual simulation toggle for user to test offline mode experience
  const [offlineSimulated, setOfflineSimulated] = useState(false);

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isEffectiveOnline = browserOnline && !offlineSimulated;

  return {
    isOnline: isEffectiveOnline,
    isSimulatedOffline: offlineSimulated,
    setOfflineSimulated,
    browserOnline,
  };
}
