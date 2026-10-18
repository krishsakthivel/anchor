import React from 'react';
import { CareCard } from './CarePlanUI';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appAlert as Alert } from './AppDialog';
import { displayTime } from '../lib/dailyPlan';
import { NAVY, WHITE, BORDER, MUTED, SURFACE, SUCCESS, SUCCESS_BG, WARNING, WARNING_BG, DANGER, DANGER_BG } from '../theme/colors';
const { normalizeDays } = require('../lib/careValues');
const { medicationDaysLabel } = require('../lib/medicationSchedule');

const statuses = {
  taken: { label: 'Taken', icon: 'checkmark-circle', color: SUCCESS, background: SUCCESS_BG },
  skipped: { label: 'Skipped', icon: 'remove-circle', color: WARNING, background: WARNING_BG },
  missed: { label: 'Missed', icon: 'alert-circle', color: DANGER, background: DANGER_BG },
};

export default function MedicationCard({ medication, schedules, logs, canEdit, busy, onRecord, onUpdatePills, onEdit, onDelete, scale = value => value }) {
  const s = scale;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const slots = schedules.length ? schedules : [null];
  const lowStock = medication.pills_remaining != null && medication.pills_remaining <= (medication.refill_alert_at ?? 10);
  const options = () => Alert.alert(medication.name, 'Medication options', [
    { text: 'Edit medication', onPress: onEdit },
    ...(medication.total_pills != null ? [{ text: 'Update pill count', onPress: onUpdatePills }] : []),
    { text: 'Delete medication', style: 'destructive', onPress: onDelete },
    { text: 'Cancel', style: 'cancel' },
  ]);

  return (
    <CareCard scale={s}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: s(14) }}>
        <View style={{ width: s(40), height: s(40), borderRadius: 10, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center', marginRight: s(12) }}>
          <Ionicons name="medical-outline" size={s(21)} color={NAVY} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), lineHeight: s(24), color: NAVY }}>{medication.name}</Text>
          {!!medication.dosage && <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: MUTED, marginTop: s(2) }}>{medication.dosage}</Text>}
        </View>
        {canEdit && <TouchableOpacity onPress={options} disabled={busy} accessibilityRole="button" accessibilityLabel={`Options for ${medication.name}`} style={{ minWidth: s(40), minHeight: s(40), justifyContent: 'center', alignItems: 'flex-end' }}>
          <Ionicons name="ellipsis-horizontal" size={s(22)} color={MUTED} />
        </TouchableOpacity>}
      </View>
      {!!medication.instructions && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), lineHeight: s(21), color: MUTED, marginBottom: s(14) }}>{medication.instructions}</Text>}
      {slots.map(schedule => {
        const due = !schedule || normalizeDays(schedule.days).includes(today);
        const log = logs.find(entry => entry.medication_id === medication.id && (schedule ? entry.schedule_id === schedule.id : entry.schedule_id == null));
        const status = statuses[log?.status] || { label: due ? 'Due today' : 'Not due today', icon: 'ellipse-outline', color: MUTED, background: WHITE };
        return <View key={schedule?.id || 'unscheduled'} style={{ backgroundColor: SURFACE, borderRadius: 8, padding: s(12), marginBottom: s(8) }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: s(8) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="time-outline" size={s(16)} color={NAVY} />
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(15), color: NAVY, marginLeft: s(6) }}>{schedule?.time ? displayTime(String(schedule.time).slice(0, 5)) : 'Any time'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(8), paddingVertical: s(5), borderRadius: 20, backgroundColor: status.background }}>
              <Ionicons name={status.icon} size={s(14)} color={status.color} />
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(12), color: status.color, marginLeft: s(4) }}>{status.label}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), lineHeight: s(18), color: MUTED, marginTop: s(5) }}>{schedule ? medicationDaysLabel(schedule.days) : 'Every day'}</Text>
          {canEdit && due && !log && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8), marginTop: s(12) }}>
            {Object.entries(statuses).map(([value, item]) => <TouchableOpacity key={value} disabled={busy} onPress={() => onRecord(schedule, value)} accessibilityRole="button" accessibilityLabel={`Mark ${medication.name} ${value}`} style={{ flexGrow: 1, flexBasis: '28%', minHeight: s(44), borderRadius: 7, borderWidth: 1, borderColor: value === 'taken' ? NAVY : BORDER, backgroundColor: value === 'taken' ? NAVY : WHITE, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: value === 'taken' ? WHITE : NAVY }}>{item.label}</Text>
            </TouchableOpacity>)}
          </View>}
        </View>;
      })}
      {medication.total_pills != null && <TouchableOpacity onPress={onUpdatePills} disabled={!canEdit || busy} accessibilityRole={canEdit ? 'button' : undefined} accessibilityLabel={`${medication.pills_remaining ?? 'Unknown'} of ${medication.total_pills} pills remaining${canEdit ? '. Update pill count' : ''}`} style={{ paddingTop: s(8), minHeight: s(48), flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="cube-outline" size={s(18)} color={MUTED} />
        <View style={{ flex: 1, marginLeft: s(8) }}>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(11), color: MUTED }}>Pills remaining</Text>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginTop: 2 }}>{medication.pills_remaining ?? '—'} / {medication.total_pills}</Text>
        </View>
        {lowStock && <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(8), paddingVertical: s(5), borderRadius: 6, backgroundColor: WARNING_BG }}>
          <Ionicons name="alert-circle-outline" size={s(14)} color={WARNING} />
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(12), color: WARNING, marginLeft: s(4) }}>Refill soon</Text>
        </View>}
        {canEdit && <Ionicons name="chevron-forward" size={s(16)} color={MUTED} style={{ marginLeft: s(8) }} />}
      </TouchableOpacity>}
    </CareCard>
  );
}
