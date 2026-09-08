import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import AppLoading from 'expo-app-loading';

export default function useCustomFonts() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  if (!fontsLoaded) {
    return { fontsLoaded: false, FontProvider: AppLoading };
  }

  return { fontsLoaded: true, FontProvider: null };
}