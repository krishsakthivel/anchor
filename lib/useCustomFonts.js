import React from 'react';
import useAppFonts from './useAppFonts';
import LoadingState from '../components/LoadingState';

export default function useCustomFonts() {
  const [fontsLoaded, error, retry] = useAppFonts();
  const FontProvider = () => <LoadingState error={error} onRetry={retry} />;
  return { fontsLoaded, FontProvider: fontsLoaded ? null : FontProvider };
}
