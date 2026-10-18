import React, { createContext, useContext } from 'react';
import { View, Text } from 'react-native';
import Button from './Button';
import { NAVY, SURFACE } from '../theme/colors';
const inactive = { active: false, client: null, highlight: () => undefined };
export const CaregiverTourContext = createContext(inactive);
export const useCaregiverTour = () => useContext(CaregiverTourContext);
export function TourPrompt() {
  const tour = useCaregiverTour();
  if (!tour.active) return null;
  return <View accessibilityRole="note" style={{ backgroundColor: SURFACE, borderLeftWidth: 3, borderLeftColor: NAVY, borderRadius: 8, padding: 12, marginBottom: 14 }}>
    <Text style={{ color: NAVY, fontFamily: 'DMSans_700Bold', fontSize: 14, marginBottom: 4 }}>Practice · {tour.step.title}</Text>
    <Text style={{ color: NAVY, fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 21 }}>{tour.step.text}</Text>
    {tour.canContinue && <Button title={tour.step.next} onPress={tour.next} style={{ marginTop: 10 }} />}
  </View>;
}
