import React, { useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { NAVY, WHITE, BORDER, MUTED, SURFACE } from '../theme/colors';
const pad = value => String(value).padStart(2, '0');
const ROW_HEIGHT = 44;

function TimeWheel({ label, items, value, onChange, width }) {
  const scroll = useRef(null);
  const initialIndex = useRef(Math.max(0, items.indexOf(value)));
  const select = index => {
    const bounded = Math.max(0, Math.min(items.length - 1, index));
    if (items[bounded] !== value) onChange(items[bounded]);
  };
  return <View style={{ width }}>
    <Text style={{ color: MUTED, textAlign: 'center', fontSize: 12, marginBottom: 6 }}>{label}</Text>
    <ScrollView ref={scroll} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: items.length - 1, now: items.indexOf(value), text: String(value) }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={event => {
      const index = Math.max(0, Math.min(items.length - 1, items.indexOf(value) + (event.nativeEvent.actionName === 'increment' ? 1 : -1)));
      scroll.current?.scrollTo({ y: index * ROW_HEIGHT, animated: false }); select(index);
    }} onLayout={() => scroll.current?.scrollTo({ y: initialIndex.current * ROW_HEIGHT, animated: false })}
      onScroll={event => select(Math.round(event.nativeEvent.contentOffset.y / ROW_HEIGHT))} scrollEventThrottle={16}
      snapToInterval={ROW_HEIGHT} decelerationRate="fast" nestedScrollEnabled showsVerticalScrollIndicator={false}
      style={{ height: ROW_HEIGHT * 5, borderWidth: 1, borderColor: BORDER, borderRadius: 8 }} contentContainerStyle={{ paddingVertical: ROW_HEIGHT * 2 }}>
      {items.map((item, index) => <TouchableOpacity key={item} onPress={() => { scroll.current?.scrollTo({ y: index * ROW_HEIGHT, animated: false }); select(index); }} accessibilityRole="button" accessibilityLabel={`${label} ${typeof item === 'number' ? pad(item) : item}`} accessibilityState={{ selected: value === item }} style={{ height: ROW_HEIGHT, justifyContent: 'center', alignItems: 'center', backgroundColor: value === item ? SURFACE : WHITE }}>
        <Text style={{ fontFamily: value === item ? 'DMSans_700Bold' : 'DMSans_400Regular', fontSize: 18, color: value === item ? NAVY : MUTED }}>{typeof item === 'number' ? pad(item) : item}</Text>
      </TouchableOpacity>)}
    </ScrollView>
  </View>;
}

export default function TimePickerInput({ label = 'Time', value, onChange, optional = false }) {
  const [open, setOpen] = useState(false);
  const [hours, minutes] = (value || '08:00').split(':').map(Number);
  const hour = hours % 12 || 12, minute = minutes, period = hours >= 12 ? 'PM' : 'AM';
  const update = (h, m, p) => onChange(`${pad((h % 12) + (p === 'PM' ? 12 : 0))}:${pad(m)}`);
  const display = value ? `${hour}:${pad(minute)} ${period}` : 'Select a time';
  return <>
    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: NAVY, marginBottom: 4 }}>{label}</Text>
    <TouchableOpacity onPress={() => { if (!open && !value) onChange('08:00'); setOpen(!open); }} accessibilityRole="button" accessibilityLabel={`${label}, ${display}`} accessibilityState={{ expanded: open }} style={{ borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: 12, minHeight: 48, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: value ? NAVY : MUTED }}>{display}</Text><Text style={{ color: NAVY }}>{open ? '▴' : '▾'}</Text>
    </TouchableOpacity>
    {open && <View style={{ backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12, marginBottom: 14 }}>
      <Text style={{ fontFamily: 'DMSans_400Regular', color: MUTED, fontSize: 13, marginBottom: 12 }}>Swipe to choose. The time updates automatically.</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <TimeWheel label="Hour" items={Array.from({ length: 12 }, (_, i) => i + 1)} value={hour} onChange={next => update(next, minute, period)} width="27%" />
        <TimeWheel label="Minute" items={Array.from({ length: 60 }, (_, i) => i)} value={minute} onChange={next => update(hour, next, period)} width="35%" />
        <TimeWheel label="Period" items={['AM', 'PM']} value={period} onChange={next => update(hour, minute, next)} width="28%" />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 10 }}>
        {optional && <TouchableOpacity accessibilityRole="button" onPress={() => { onChange(''); setOpen(false); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: MUTED, fontSize: 16 }}>Clear</Text></TouchableOpacity>}
        <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(false)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: NAVY, fontFamily: 'DMSans_700Bold', fontSize: 16 }}>Close</Text></TouchableOpacity>
      </View>
    </View>}
  </>;
}
