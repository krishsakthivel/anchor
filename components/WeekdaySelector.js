import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { NAVY, WHITE, BORDER, MUTED, SURFACE } from '../theme/colors';
const { MEDICATION_DAYS } = require('../lib/medicationSchedule');

export default function WeekdaySelector({ value, onChange, disabled = false, itemLabel = 'medication' }) {
  const everyDay = value.length === 7;
  const toggle = day => onChange(MEDICATION_DAYS.filter(item => item === day ? !value.includes(day) : value.includes(item)));
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: NAVY }}>Days of the week *</Text>
        <TouchableOpacity disabled={disabled} accessibilityRole="button" accessibilityLabel="Select every day" onPress={() => onChange([...MEDICATION_DAYS])} style={{ minHeight: 40, justifyContent: 'center', paddingLeft: 12 }}>
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 13, color: everyDay ? MUTED : NAVY }}>Every day</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {MEDICATION_DAYS.map(day => {
          const selected = value.includes(day);
          const label = day[0].toUpperCase() + day.slice(1);
          return <TouchableOpacity key={day} disabled={disabled} onPress={() => toggle(day)} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }}
            style={{ flexBasis: '21%', flexGrow: 1, minWidth: 48, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: selected ? NAVY : BORDER, backgroundColor: selected ? NAVY : SURFACE, opacity: disabled ? 0.5 : 1 }}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, color: selected ? WHITE : NAVY }}>{label.slice(0, 3)}</Text>
          </TouchableOpacity>;
        })}
      </View>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MUTED, lineHeight: 18, marginTop: 10 }}>Select the days this {itemLabel} is due.</Text>
    </View>
  );
}
