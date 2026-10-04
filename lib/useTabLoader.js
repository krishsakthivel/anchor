import React from 'react';
import { useFocusEffect } from '@react-navigation/native';

export const TabRefreshContext = React.createContext(null);

// The parent refresh gesture awaits the loader owned by the currently mounted
// tab. Returning from another screen also reloads the tab.
export default function useTabLoader(load, patientId) {
  const register = React.useContext(TabRefreshContext);
  const [loadError, setLoadError] = React.useState('');
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const refresh = React.useCallback(async () => {
    try {
      await load();
      if (mounted.current) setLoadError('');
    } catch (error) {
      if (mounted.current) setLoadError(error.message || 'Could not load this tab. Please refresh to try again.');
    }
  }, [patientId]);
  React.useEffect(() => register?.(refresh), [register, refresh]);
  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));
  return loadError;
}
