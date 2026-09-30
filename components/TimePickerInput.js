import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { NAVY, WHITE, BORDER, MUTED } from '../theme/colors';

const pad = (value) => String(value).padStart(2, '0');

export default function TimePickerInput({ label = 'Time', value, onChange, optional = false }) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState('AM');

  useEffect(() => {
    if (!open) return;
    const [hours = 8, minutes = 0] = (value || '08:00').split(':').map(Number);
    setHour(hours % 12 || 12);
    setMinute(minutes);
    setPeriod(hours >= 12 ? 'PM' : 'AM');
  }, [open]);

  const display = value ? (() => {
    const [hours, minutes] = value.split(':').map(Number);
    return `${hours % 12 || 12}:${pad(minutes)} ${hours >= 12 ? 'PM' : 'AM'}`;
  })() : 'Select a time';

  const save = () => {
    onChange(`${pad((hour % 12) + (period === 'PM' ? 12 : 0))}:${pad(minute)}`);
    setOpen(false);
  };

  const choices = (items, selected, select, width) => (
    <ScrollView style={{ width, height: 230, borderWidth: 1, borderColor: BORDER, borderRadius: 8 }} nestedScrollEnabled>
      {items.map((item) => (
        <TouchableOpacity key={item} onPress={() => select(item)} accessibilityRole="button" accessibilityState={{ selected: selected === item }} style={{ paddingVertical: 10, alignItems: 'center', backgroundColor: selected === item ? NAVY : WHITE }}>
          <Text style={{ fontSize: 17, color: selected === item ? WHITE : NAVY }}>{typeof item === 'number' ? pad(item) : item}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <>
      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: NAVY, marginBottom: 4 }}>{label}</Text>
      <TouchableOpacity onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}, ${display}`} style={{ borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: 12, minHeight: 48, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: value ? NAVY : MUTED }}>{display}</Text>
        <Text style={{ color: NAVY }}>▾</Text>
      </TouchableOpacity>
      {open && <View style={{ backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER, borderRadius: 12, width: '100%', padding: 12, marginBottom: 14 }}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 20, color: NAVY, marginBottom: 14 }}>Choose {label.toLowerCase()}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              {choices(Array.from({ length: 12 }, (_, i) => i + 1), hour, setHour, '27%')}
              {choices(Array.from({ length: 60 }, (_, i) => i), minute, setMinute, '35%')}
              {choices(['AM', 'PM'], period, setPeriod, '28%')}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 12 }}>
              {optional && <TouchableOpacity onPress={() => { onChange(''); setOpen(false); }}><Text style={{ color: MUTED, fontSize: 16 }}>Clear</Text></TouchableOpacity>}
              <TouchableOpacity onPress={() => setOpen(false)}><Text style={{ color: MUTED, fontSize: 16 }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={save}><Text style={{ color: NAVY, fontFamily: 'DMSans_700Bold', fontSize: 16 }}>Set time</Text></TouchableOpacity>
            </View>
      </View>}
    </>
  );
}
