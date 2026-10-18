import React from 'react';
import { useCaregiverTour } from './CaregiverTour';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NAVY, WHITE, BORDER, MUTED, SURFACE, DANGER, DANGER_BG } from '../theme/colors';

const identity = value => value;

export function CareCard({ children, scale: s = identity }) {
  return <View style={{ backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: s(16), marginBottom: s(14) }}>{children}</View>;
}

export function CareAction({ label, onPress, disabled, accessibilityLabel, scale: s = identity }) {
  return <TouchableOpacity onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} style={{ minHeight: s(44), minWidth: s(44), paddingHorizontal: s(6), alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}>
    <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>{label}</Text>
  </TouchableOpacity>;
}

export function CareSectionHeader({ title, action, onPress, scale: s = identity }) {
  const tour = useCaregiverTour();
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: s(44), marginBottom: s(8), gap: s(8), ...tour.highlight(`section-${title}`) }}>
    <Text style={{ flex: 1, fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY }}>{title}</Text>
    {!!action && <CareAction label={action} onPress={onPress} scale={s} />}
  </View>;
}

export function CareCardHeader({ title, subtitle, icon, symbol, action, scale: s = identity }) {
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: s(14), gap: s(12) }}>
    <View style={{ width: s(40), height: s(40), borderRadius: 10, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' }}>
      {symbol ? <Text style={{ fontSize: s(23) }}>{symbol}</Text> : <Ionicons name={icon} size={s(21)} color={NAVY} />}
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), lineHeight: s(24), color: NAVY }}>{title}</Text>
      {!!subtitle && <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: MUTED, marginTop: s(2) }}>{subtitle}</Text>}
    </View>
    {action}
  </View>;
}

export function CareBody({ children, scale: s = identity }) {
  return <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), lineHeight: s(21), color: MUTED, marginBottom: s(14) }}>{children}</Text>;
}

export function CareInset({ children, scale: s = identity }) {
  return <View style={{ backgroundColor: SURFACE, borderRadius: 8, padding: s(12), gap: s(6) }}>{children}</View>;
}

export function CareMeta({ icon = 'time-outline', title, detail, scale: s = identity }) {
  return <View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
      <Ionicons name={icon} size={s(16)} color={NAVY} />
      <Text style={{ flex: 1, fontFamily: 'DMSans_700Bold', fontSize: s(15), color: NAVY }}>{title}</Text>
    </View>
    {!!detail && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), lineHeight: s(18), color: MUTED, marginTop: s(5) }}>{detail}</Text>}
  </View>;
}

export function CareEmpty({ title, icon, detail, scale: s = identity }) {
  return <CareCard scale={s}><CareCardHeader title={title} icon={icon} scale={s} />{!!detail && <CareBody scale={s}>{detail}</CareBody>}</CareCard>;
}

export function CareError({ message, scale: s = identity }) {
  if (!message) return null;
  return <View accessibilityRole="alert" style={{ backgroundColor: DANGER_BG, borderRadius: 8, padding: s(12), marginBottom: s(12) }}><Text style={{ color: DANGER, fontFamily: 'DMSans_400Regular', fontSize: s(14), lineHeight: s(21) }}>{message}</Text></View>;
}
