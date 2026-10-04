import { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
const { withTimeout } = require('./startup');
const fonts = { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold };
const alreadyLoaded = () => Object.keys(fonts).every(name => Font.isLoaded(name));

export default function useAppFonts() {
  const [loaded, setLoaded] = useState(alreadyLoaded);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (alreadyLoaded()) { setLoaded(true); return; }
    withTimeout(() => Font.loadAsync(fonts)).then(() => {
      if (active) { setLoaded(true); setError(null); }
    }).catch(err => { if (active) setError(err); });
    return () => { active = false; };
  }, [attempt]);
  const retry = () => { setError(null); setLoaded(alreadyLoaded()); setAttempt(value => value + 1); };
  return [loaded, error, retry];
}
