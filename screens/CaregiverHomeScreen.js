import { signOutWithCleanup } from '../lib/session';
import { appAlert as Alert } from '../components/AppDialog';
import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  Image,
  FlatList,
  ScrollView,
  useWindowDimensions,
  RefreshControl,
  TextInput,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { supabase as realSupabase } from '../lib/supabase';
import { useCaregiverTour, TourPrompt } from '../components/CaregiverTour';
import Button from '../components/Button';
import { displayTime } from '../lib/dailyPlan';
const { localDateKey, advanceCalendarSelection } = require('../lib/localDate');
const { pairingCodeStatus } = require('../lib/pairingCodeStatus');
import { scheduleCaregiverMedicationReminders } from '../lib/notifications';
import {
  NAVY,
  WHITE,
  PLACEHOLDER,
  TEXT_DARK,
  SURFACE,
  SURFACE_MUTED,
  BORDER,
  MUTED,
  SUCCESS,
  SUCCESS_BG,
  WARNING,
  WARNING_BG,
  DANGER,
  DANGER_BG,
} from '../theme/colors';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const generateCode = () => {
  const values = Crypto.getRandomValues(new Uint32Array(8));
  return Array.from(values, (value) => String(value % 10)).join('');
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};

async function getPatientSummaries(patientIds, supabase) {
  const empty = {};
  if (!patientIds.length) return empty;

  const today = DAYS[new Date().getDay()];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();
  const todayKey = localDateKey(todayStart);

  const [medsRes, schedRes, tasksRes, medLogRes, taskCompRes, moodRes, safetyRes] = await Promise.all([
    supabase.from('medications').select('id, patient_id, total_pills, pills_remaining, refill_alert_at').in('patient_id', patientIds),
    supabase.from('medication_schedule').select('id, medication_id, patient_id, days').in('patient_id', patientIds).eq('active', true),
    supabase.from('tasks').select('id, patient_id, days').in('patient_id', patientIds).eq('active', true),
    supabase.from('medication_log').select('medication_id, schedule_id, patient_id, status').in('patient_id', patientIds).eq('log_day', todayKey),
    supabase.from('task_completion').select('task_id, patient_id, status').in('patient_id', patientIds).eq('completion_day', todayKey),
    supabase.from('mood_logs').select('patient_id, mood, logged_at').in('patient_id', patientIds).gte('logged_at', todayStartIso).order('logged_at', { ascending: false }),
    supabase.from('safety_checkins').select('patient_id, status, created_at').in('patient_id', patientIds).order('created_at', { ascending: false }),
  ]);
  const summaryError = [medsRes, schedRes, tasksRes, medLogRes, taskCompRes, moodRes, safetyRes].find((result) => result.error)?.error;
  if (summaryError) throw summaryError;

  const meds = medsRes.data || [];
  const schedules = schedRes.data || [];
  const tasks = tasksRes.data || [];
  const medLogs = medLogRes.data || [];
  const taskComps = taskCompRes.data || [];
  const moodLogs = moodRes.data || [];
  const safetyCheckins = safetyRes.data || [];

  const summaries = {};

  for (const patientId of patientIds) {
    const patientSchedules = schedules.filter((sc) => sc.patient_id === patientId);
    const patientTasks = tasks.filter((t) => t.patient_id === patientId);
    const patientMedLogs = medLogs.filter((l) => l.patient_id === patientId);
    const patientTaskComps = taskComps.filter((c) => c.patient_id === patientId);
    const patientMeds = meds.filter((m) => m.patient_id === patientId);

    const todayMedSlots = [];
    for (const med of patientMeds) {
      const medSchedules = patientSchedules.filter((schedule) => schedule.medication_id === med.id);
      const dueSchedules = medSchedules.filter((schedule) => {
        const days = Array.isArray(schedule.days) ? schedule.days : String(schedule.days || '');
        return days.includes(today);
      });
      if (!medSchedules.length) {
        todayMedSlots.push({ medicationId: med.id, scheduleId: null });
      } else {
        dueSchedules.forEach((schedule) => todayMedSlots.push({ medicationId: med.id, scheduleId: schedule.id }));
      }
    }
    const todayTaskIds = new Set(
      patientTasks.filter((t) => !t.days || t.days.includes(today)).map((t) => t.id)
    );

    const medsDone = new Set(
      patientMedLogs.filter((l) => l.status === 'taken').map((l) => l.schedule_id || l.medication_id)
    );
    const tasksDone = new Set(
      patientTaskComps.filter((c) => c.status === 'completed').map((c) => c.task_id)
    );

    const routineTotal = todayMedSlots.length + todayTaskIds.size;
    const routineDone =
      todayMedSlots.filter((slot) => medsDone.has(slot.scheduleId || slot.medicationId)).length +
      [...todayTaskIds].filter((id) => tasksDone.has(id)).length;

    const lowStockCount = patientMeds.filter(
      (m) => m.total_pills != null && m.pills_remaining != null && m.pills_remaining <= (m.refill_alert_at ?? 10)
    ).length;

    const moodToday = moodLogs.find((l) => l.patient_id === patientId)?.mood || null;
    const latestSafety = safetyCheckins.find((checkin) => checkin.patient_id === patientId) || null;
    const missedMedicationCount = patientMedLogs.filter((log) => log.status === 'missed').length;

    summaries[patientId] = { routineTotal, routineDone, lowStockCount, moodToday, latestSafety, missedMedicationCount };
  }

  return summaries;
}

export default function CaregiverHomeScreen({ navigation }) {
  const tour = useCaregiverTour();
  const supabase = tour.client || realSupabase;
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverId, setCaregiverId] = useState(null);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [calendarRoutines, setCalendarRoutines] = useState([]);
  const [selectedDate, setSelectedDate] = useState(localDateKey(new Date()));
  const [todayKey, setTodayKey] = useState(localDateKey(new Date()));
  const loadedDay = React.useRef(localDateKey(new Date()));
  const [homeError, setHomeError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientBirthDate, setNewPatientBirthDate] = useState('');
  const [newEmergencyContactName, setNewEmergencyContactName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const [successCode, setSuccessCode] = useState(null);

  const { width } = useWindowDimensions();

  const scale = Math.min(1.08, Math.max(0.95, width / 375));
  const s = (size) => Math.round(size * scale);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  const fetchPatients = useCallback(async () => {
    setHomeError('');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setHomeError('Your session has expired. Please sign in again.');
        return;
      }
      setCaregiverId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      setCaregiverName(profile?.full_name?.trim() || '');

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('patients fetch failed', error);
        setHomeError(error.message || 'Could not load your patients. Pull down to try again.');
        Alert.alert('Error', 'Could not load your patients. Pull down to try again.');
        return;
      }

      const { data: links, error: linksError } = await supabase
        .from('caregiver_patient')
        .select('patient_id, permission_level')
        .eq('caregiver_id', user.id);
      if (linksError) throw linksError;

      const permissionByPatient = new Map((links || []).map((link) => [link.patient_id, link.permission_level]));
      const base = (data || []).map((patient) => ({
        ...patient,
        permissionLevel: patient.created_by === user.id ? 'owner' : (permissionByPatient.get(patient.id) || 'viewer'),
      }));
      const patientIds = base.map((patient) => patient.id);
      const unpairedCodes = base.filter((patient) => patient.created_by === user.id && !patient.paired_user_id && patient.pair_code).map((patient) => patient.pair_code);
      if (unpairedCodes.length) {
        const { data: codes, error: codesError } = await supabase.from('pairing_codes').select('code, expires_at, used').in('code', unpairedCodes);
        if (codesError) setHomeError('Could not check pairing codes. Refresh to try again.');
        const codeByValue = new Map((codes || []).map((row) => [row.code, row]));
        base.forEach((patient) => {
          if (patient.created_by === user.id) patient.pairingStatus = pairingCodeStatus(patient, codesError ? null : codeByValue.get(patient.pair_code));
        });
      }
      if (patientIds.length) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        const { data: appointmentRows, error: appointmentError } = await supabase.from('appointments').select('id, patient_id, title, appointment_time, completed').in('patient_id', patientIds).gte('appointment_time', start.toISOString()).lt('appointment_time', end.toISOString()).order('appointment_time');
        if (appointmentError) {
          console.error('appointments fetch failed', appointmentError);
          setHomeError('Could not load appointments. Pull down to try again.');
          setAppointments([]);
        } else {
          setAppointments((appointmentRows || []).map((row) => ({ ...row, patientName: base.find((patient) => patient.id === row.patient_id)?.name || 'Patient', canEdit: base.find((patient) => patient.id === row.patient_id)?.permissionLevel !== 'viewer' })));
        }
      } else {
        setAppointments([]);
      }
      const [medicationRes, scheduleRes, taskRes] = await Promise.all([
        supabase.from('medications').select('id, patient_id, name').in('patient_id', patientIds),
        supabase.from('medication_schedule').select('medication_id, patient_id, time, days').in('patient_id', patientIds).eq('active', true),
        supabase.from('tasks').select('id, patient_id, title, time, days').in('patient_id', patientIds).eq('active', true),
      ]);
      const calendarError = [medicationRes, scheduleRes, taskRes].find((result) => result.error)?.error;
      if (calendarError) {
        console.error('calendar routines fetch failed', calendarError);
        setHomeError('Could not load scheduled medicines and tasks. Pull down to try again.');
      }
      const medicationRows = medicationRes.data;
      const scheduleRows = scheduleRes.data;
      const taskRows = taskRes.data;
      const patientNames = new Map(base.map((patient) => [patient.id, patient.name]));
      const medicationNames = new Map((medicationRows || []).map((medication) => [medication.id, medication.name]));
      const scheduledMedicationIds = new Set((scheduleRows || []).map((row) => row.medication_id));
      setCalendarRoutines([
        ...(scheduleRows || []).map((row) => ({ patientId: row.patient_id, patientName: patientNames.get(row.patient_id) || 'Patient', title: medicationNames.get(row.medication_id) || 'Medicine', time: row.time, days: row.days, kind: 'Medicine' })),
        ...(medicationRows || []).filter((row) => !scheduledMedicationIds.has(row.id)).map((row) => ({ patientId: row.patient_id, patientName: patientNames.get(row.patient_id) || 'Patient', title: row.name, time: null, days: null, kind: 'Medicine' })),
        ...(taskRows || []).map((row) => ({ patientId: row.patient_id, patientName: patientNames.get(row.patient_id) || 'Patient', title: row.title, time: row.time, days: row.days, kind: 'Task' })),
      ]);
      if (!tour.active) scheduleCaregiverMedicationReminders((scheduleRows || [])
        .map((schedule) => ({ patientId: schedule.patient_id, patientName: patientNames.get(schedule.patient_id) || 'Your patient', medicationName: medicationNames.get(schedule.medication_id) || 'medicine', time: String(schedule.time).slice(0, 5), days: schedule.days })), user.id)
        .catch(() => {});
      setPatients(base.map((patient) => ({
        ...patient,
        routineTotal: 0,
        routineDone: 0,
        lowStockCount: 0,
        moodToday: null,
      })));

      try {
        const summaries = await getPatientSummaries(base.map((p) => p.id), supabase);
        setPatients(base.map((patient) => ({
          ...patient,
          ...(summaries[patient.id] || { routineTotal: 0, routineDone: 0, lowStockCount: 0, moodToday: null, latestSafety: null, missedMedicationCount: 0 }),
        })));
      } catch (summaryErr) {
        console.error('getPatientSummaries failed', summaryErr);
        setHomeError('Could not load today’s routine. Pull down to try again.');
      }
    } catch (err) {
      console.error('fetchPatients failed', err);
      setHomeError(err?.message || 'Could not load your patients. Pull down to try again.');
      Alert.alert('Error', 'Could not load your patients. Pull down to try again.');
    }
  }, []);

  const refreshForNewDay = useCallback(() => {
    const today = localDateKey(new Date());
    if (today === loadedDay.current) return false;
    const previous = loadedDay.current;
    loadedDay.current = today;
    setTodayKey(today);
    setSelectedDate(selected => advanceCalendarSelection(selected, previous, today));
    fetchPatients().finally(() => setInitialLoading(false));
    return true;
  }, [fetchPatients]);

  useFocusEffect(useCallback(() => {
    if (!refreshForNewDay()) fetchPatients().finally(() => setInitialLoading(false));
  }, [fetchPatients, refreshForNewDay]));

  useEffect(() => {
    const timer = setInterval(refreshForNewDay, 30000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshForNewDay();
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [refreshForNewDay]);

  useEffect(() => {
    if (!caregiverId) return;
    let timer;
    const channel = supabase.channel(`caregiver-safety-${caregiverId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'safety_checkins' }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => fetchPatients(), 300);
      }).subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  }, [caregiverId, fetchPatients]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPatients();
    } finally {
      setRefreshing(false);
    }
  };


  const alertCount = patients.filter((p) => p.lowStockCount > 0 || p.missedMedicationCount > 0 || ['needs_help', 'urgent'].includes(p.latestSafety?.status)).length;
  const routineInProgressCount = patients.filter((p) => p.routineTotal > 0 && p.routineDone < p.routineTotal).length;
  const calendarDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${todayKey}T12:00:00`);
    date.setDate(date.getDate() + index);
    return { key: localDateKey(date), label: date.toLocaleDateString(undefined, { weekday: 'short' }), number: date.getDate() };
  });
  const selectedAppointments = appointments.filter((item) => localDateKey(new Date(item.appointment_time)) === selectedDate);
  const selectedDay = DAYS[new Date(`${selectedDate}T12:00:00`).getDay()];
  const selectedRoutines = calendarRoutines.filter((item) => !item.days || (Array.isArray(item.days) ? item.days.includes(selectedDay) : String(item.days).includes(selectedDay))).sort((a, b) => String(a.time || '99:99').localeCompare(String(b.time || '99:99')));

  const handleAddPatient = async () => {
    const name = newPatientName.trim();
    if (!name || addLoading) return;

    setAddLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        Alert.alert('Error', 'Your session has expired. Please sign in again.');
        return;
      }

      const code = generateCode();

      const { error: codeError } = await supabase
        .from('pairing_codes')
        .insert({ caregiver_id: user.id, code });

      if (codeError) {
        console.error('pairing_codes insert failed', codeError);
        Alert.alert('Error', codeError.message || 'Failed to generate a pairing code. Please try again.');
        return;
      }

      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert({
          name,
          birth_date: newPatientBirthDate.trim() || null,
          created_by: user.id,
          pair_code: code,
        })
        .select()
        .single();

      if (patientError || !patient) {
        console.error('patients insert failed', patientError);
        await supabase.from('pairing_codes').delete().eq('code', code);
        Alert.alert('Error', patientError?.message || 'Failed to add patient. Please try again.');
        return;
      }

      if (newPatientPhone.trim()) {
        const { error: contactError } = await supabase
          .from('emergency_contacts')
          .insert({
            patient_id: patient.id,
            name: newEmergencyContactName.trim() || 'Emergency contact',
            phone: newPatientPhone.trim(),
            priority: 1,
          });
        if (contactError) {
          console.error('emergency_contacts insert failed', contactError);
          Alert.alert('Patient added', 'The care plan was created, but the emergency contact number could not be saved. You can add it later.');
        }
      }

      setPatients((prev) => [
        { ...patient, routineTotal: 0, routineDone: 0, lowStockCount: 0, moodToday: null },
        ...prev,
      ]);

      setAddModalVisible(false);
      setSuccessCode({ name, code });
      setNewPatientName('');
      setNewPatientBirthDate('');
      setNewEmergencyContactName('');
      setNewPatientPhone('');

      try {
        await fetchPatients();
      } catch (refreshErr) {
        console.error('fetchPatients after add failed', refreshErr);
      }
    } catch (err) {
      console.error('handleAddPatient failed', err);
      Alert.alert('Error', 'Something went wrong adding this patient. Please try again.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleResetPairing = async (patient) => {
    if (addLoading) return;
    setAddLoading(true);
    const code = generateCode();
    try {
      const { error } = await supabase.rpc('reset_patient_pairing', {
        p_patient_id: patient.id,
        p_code: code,
      });
      if (error) {
        console.error('reset_patient_pairing failed', error);
        Alert.alert('Error', error.message || 'Could not generate a new pairing code.');
        return;
      }
      setSuccessCode({ name: patient.name, code, reset: true });
      await fetchPatients();
    } catch (err) {
      console.error('handleResetPairing failed', err);
      Alert.alert('Error', 'Could not generate a new pairing code. Please try again.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemovePatient = (patient) => {
    Alert.alert(
      'Remove Patient',
      `Remove ${patient.name}? This deletes their schedule, notes, and history. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Pairing Code',
          onPress: () => handleResetPairing(patient),
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || user.id !== patient.created_by) {
              Alert.alert('Not allowed', 'Only the patient owner can remove this care plan.');
              return;
            }
            const { error: patientError } = await supabase.from('patients').delete().eq('id', patient.id);
            if (patientError) {
              console.error('patient delete failed', patientError);
              Alert.alert('Error', patientError.message || 'Could not remove this patient.');
              return;
            }
            if (patient.pair_code) {
              const { error: codeError } = await supabase.from('pairing_codes').delete().eq('code', patient.pair_code);
              if (codeError) console.warn('pairing code cleanup failed', codeError);
            }
            await fetchPatients();
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    if (tour.active) return;
    try {
      await signOutWithCleanup();
      navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
    } catch (error) { Alert.alert('Could not sign out', error.message || 'Please try again.'); }
  };

  const renderPatient = ({ item }) => {
    const paired = !!item.paired_user_id;
    const isOwner = item.created_by === caregiverId;
    const codeStatus = item.pairingStatus || pairingCodeStatus(item, null);
    const hasRoutine = item.routineTotal > 0;
    const routineComplete = hasRoutine && item.routineDone >= item.routineTotal;

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => navigation.navigate('PatientDetail', { patientId: item.id, patientName: item.name, canEdit: item.permissionLevel !== 'viewer' })}
        onLongPress={() => isOwner && handleRemovePatient(item)}
        accessibilityLabel={`${item.name} care plan${item.lowStockCount > 0 ? ', medication running low' : ''}`}
        style={[tour.highlight('patient-card'), styles.card, { padding: s(16), borderRadius: 6, marginBottom: s(12) }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.avatar, { width: s(46), height: s(46), borderRadius: s(23) }]}>
            <Text style={{ fontFamily: 'DMSans_700Bold', color: WHITE, fontSize: s(16) }}>
              {getInitials(item.name)}
            </Text>
            {item.lowStockCount > 0 && (
              <View style={[styles.alertDot, { width: s(15), height: s(15), borderRadius: s(8) }]}>
                <Ionicons name="alert" size={s(10)} color={WHITE} />
              </View>
            )}
          </View>

          <View style={{ flex: 1, marginLeft: s(12) }}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: NAVY }} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: s(3) }}>
              <Ionicons
                name={paired ? 'checkmark-circle' : 'key-outline'}
                size={s(12)}
                color={paired ? SUCCESS : MUTED}
              />
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: paired ? SUCCESS : MUTED, marginLeft: s(4) }}>
                {paired ? 'Connected' : !isOwner ? 'Not connected' : codeStatus.label}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end', marginLeft: s(6) }}>
            <Ionicons name={item.moodToday ? 'chatbubble-ellipses-outline' : 'remove-circle-outline'} size={s(20)} color={item.moodToday ? SUCCESS : PLACEHOLDER} />
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: item.moodToday ? SUCCESS : MUTED, marginTop: s(2) }}>
              {item.moodToday ? 'Mood logged' : 'No check-in'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={s(18)} color={PLACEHOLDER} style={{ marginLeft: s(4) }} />
        </View>
        {!paired && isOwner && codeStatus.state === 'valid' && <Text style={{ color: MUTED, fontSize: s(12), marginTop: s(6) }}>Expires {new Date(codeStatus.expiresAt).toLocaleString()}</Text>}
        {!paired && isOwner && <TouchableOpacity disabled={addLoading} onPress={() => handleResetPairing(item)} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: s(8) }}><Text style={{ color: NAVY, fontFamily: 'DMSans_500Medium', fontSize: s(12) }}>Get a new pairing code</Text></TouchableOpacity>}

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: s(15), paddingTop: s(12), borderTopWidth: 1, borderTopColor: BORDER }}>
          {hasRoutine ? (
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(4) }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(12), color: TEXT_DARK }}>
                  Today’s routine
                </Text>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(12), color: routineComplete ? SUCCESS : NAVY }}>
                  {item.routineDone}/{item.routineTotal}
                </Text>
              </View>
              <View style={{ height: s(6), backgroundColor: BORDER, borderRadius: s(3), overflow: 'hidden' }}>
                <View
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (item.routineDone / item.routineTotal) * 100)}%`,
                    backgroundColor: routineComplete ? SUCCESS : NAVY,
                    borderRadius: s(3),
                  }}
                />
              </View>
            </View>
          ) : (
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: MUTED, flex: 1 }}>
              Nothing scheduled today
            </Text>
          )}
        </View>

        {item.lowStockCount > 0 && (
          <View style={[styles.chip, { backgroundColor: DANGER_BG, marginTop: s(10), alignSelf: 'flex-start', paddingHorizontal: s(8), paddingVertical: s(4), borderRadius: 6 }]}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: DANGER }}>
              ⚠ {item.lowStockCount} medication{item.lowStockCount > 1 ? 's' : ''} running low
            </Text>
          </View>
        )}
        {item.missedMedicationCount > 0 && (
          <View style={[styles.chip, { backgroundColor: WARNING_BG, marginTop: s(10), alignSelf: 'flex-start', paddingHorizontal: s(8), paddingVertical: s(4), borderRadius: 6 }]}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: WARNING }}>
              {item.missedMedicationCount} medication dose{item.missedMedicationCount > 1 ? 's' : ''} missed today
            </Text>
          </View>
        )}
        {item.latestSafety && ['needs_help', 'urgent'].includes(item.latestSafety.status) && (
          <View style={[styles.chip, { backgroundColor: item.latestSafety.status === 'urgent' ? DANGER_BG : WARNING_BG, marginTop: s(10), alignSelf: 'flex-start', paddingHorizontal: s(8), paddingVertical: s(4), borderRadius: 6 }]}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(13), color: item.latestSafety.status === 'urgent' ? DANGER : WARNING }}>
              {item.latestSafety.status === 'urgent' ? 'Urgent help requested' : 'Patient says they need help'}
            </Text>
          </View>
        )}
        {isOwner && (
          <TouchableOpacity
            onPress={() => handleRemovePatient(item)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
            style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingVertical: s(9), marginTop: s(4) }}
          >
            <Ionicons name="trash-outline" size={s(17)} color={DANGER} style={{ marginRight: s(6) }} />
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: DANGER }}>Delete patient</Text>
          </TouchableOpacity>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: s(12) }}>
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(13), color: NAVY }}>View care plan</Text>
          <Ionicons name="arrow-forward" size={s(15)} color={NAVY} style={{ marginLeft: s(5) }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      <FlatList
        data={patients}
        keyExtractor={(item) => item.id}
        renderItem={renderPatient}
        contentContainerStyle={{ padding: s(20), paddingBottom: s(100), flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NAVY} />}
        ListHeaderComponent={
          <View style={{ marginBottom: s(20) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Image
                source={require('../assets/logo.png')}
                style={{ width: s(44), height: s(44) }}
                resizeMode="contain"
              />
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  onPress={() => setAddModalVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Add patient"
                  style={[tour.highlight('add-patient'), styles.iconBtn, { width: s(40), height: s(40), borderRadius: s(20) }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="add" size={s(24)} color={NAVY} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Profile')}
                  accessibilityRole="button"
                  accessibilityLabel="Open settings"
                  style={[tour.highlight('settings'), styles.iconBtn, { width: s(40), height: s(40), borderRadius: s(20), marginLeft: s(8) }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="settings-outline" size={s(22)} color={NAVY} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSignOut}
                  accessibilityRole="button"
                  accessibilityLabel="Sign out"
                  disabled={tour.active}
                  style={[styles.iconBtn, { width: s(40), height: s(40), borderRadius: s(20), marginLeft: s(8) }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="log-out-outline" size={s(22)} color={NAVY} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(24), color: NAVY, marginTop: s(16) }}>
              Good {greeting}{caregiverName ? `, ${caregiverName}` : ''}
            </Text>
            {!!homeError && <Text style={{ color: DANGER, marginTop: s(10), fontFamily: 'DMSans_500Medium' }}>{homeError}</Text>}

            <View style={{ marginTop: s(18), backgroundColor: SURFACE, borderRadius: 6, padding: s(14) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), color: NAVY, marginBottom: s(10) }}>Calendar, next 7 days</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {calendarDays.map((day) => <TouchableOpacity key={day.key} onPress={() => setSelectedDate(day.key)} accessibilityRole="button" accessibilityState={{ selected: selectedDate === day.key }} style={{ alignItems: 'center', paddingVertical: s(8), paddingHorizontal: s(5), borderRadius: 8, backgroundColor: selectedDate === day.key ? NAVY : WHITE }}><Text style={{ color: selectedDate === day.key ? WHITE : MUTED, fontSize: s(11) }}>{day.label}</Text><Text style={{ color: selectedDate === day.key ? WHITE : NAVY, fontFamily: 'DMSans_700Bold', fontSize: s(16) }}>{day.number}</Text></TouchableOpacity>)}
              </View>
              {selectedAppointments.map((item) => <TouchableOpacity key={item.id} onPress={() => navigation.navigate('Appointments', { patientId: item.patient_id, isPatient: !item.canEdit })} style={{ padding: s(9), marginTop: s(8), backgroundColor: WHITE, borderRadius: 8 }}><Text style={{ color: NAVY, fontFamily: 'DMSans_700Bold' }}>{new Date(item.appointment_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} {item.title}</Text><Text style={{ color: MUTED }}>Appointment, {item.patientName}{item.completed ? ', Completed' : ''}</Text></TouchableOpacity>)}
              {selectedRoutines.map((item, index) => <TouchableOpacity key={`${item.kind}-${item.patientId}-${index}`} onPress={() => navigation.navigate('PatientDetail', { patientId: item.patientId, patientName: item.patientName, canEdit: patients.find((patient) => patient.id === item.patientId)?.permissionLevel !== 'viewer', initialTab: item.kind === 'Medicine' ? 'Medications' : 'Tasks' })} style={{ padding: s(9), marginTop: s(8), backgroundColor: WHITE, borderRadius: 8 }}><Text style={{ color: NAVY, fontFamily: 'DMSans_700Bold' }}>{item.time ? `${displayTime(String(item.time).slice(0, 5))} ` : ''}{item.title}</Text><Text style={{ color: MUTED }}>{item.kind}, {item.patientName}</Text></TouchableOpacity>)}
              {!selectedAppointments.length && !selectedRoutines.length && <Text style={{ color: MUTED, marginTop: s(10) }}>Nothing scheduled on this day</Text>}
            </View>

            {patients.length > 0 && (
              <View style={{ marginTop: s(16), backgroundColor: SURFACE, borderRadius: 6, padding: s(14) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: MUTED }}>Today</Text>
                    <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), color: NAVY, marginTop: s(2) }}>{patients.length} {patients.length === 1 ? 'care plan' : 'care plans'}</Text>
                  </View>
                  <View style={[styles.chip, { backgroundColor: alertCount > 0 ? WARNING_BG : SUCCESS_BG, paddingHorizontal: s(9), paddingVertical: s(6), borderRadius: 8 }]}>
                    <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(12), color: alertCount > 0 ? WARNING : SUCCESS }}>
                      {alertCount > 0 ? `${alertCount} alert${alertCount > 1 ? 's' : ''}` : 'All caught up'}
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: s(12), paddingTop: s(12), borderTopWidth: 1, borderTopColor: BORDER }}>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: MUTED }}>
                    {routineInProgressCount > 0 ? `${routineInProgressCount} routine${routineInProgressCount > 1 ? 's' : ''} still in progress` : 'No routines in progress'}
                  </Text>
                  <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(13), color: NAVY, marginTop: s(7) }}>Open a care plan for details</Text>
                </View>
              </View>
            )}
            {patients.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: s(24), marginBottom: s(10) }}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY }}>People you care for</Text>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: MUTED }}>Daily view</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          initialLoading ? (
            <View style={{ alignItems: 'center', paddingTop: s(60) }}>
              <ActivityIndicator size="large" color={NAVY} />
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: s(40), paddingHorizontal: s(20) }}>
              <View style={[styles.avatar, { width: s(64), height: s(64), borderRadius: s(32), backgroundColor: SURFACE }]}>
                <Ionicons name="people-outline" size={s(28)} color={NAVY} />
              </View>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY, marginTop: s(16) }}>
                No patients yet
              </Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: MUTED, textAlign: 'center', marginTop: s(6), marginBottom: s(20) }}>
                Add someone you care for to set up their routine, medications, and pairing code.
              </Text>
              <Button title="Add Patient" onPress={() => setAddModalVisible(true)} style={{ paddingHorizontal: s(28), alignSelf: 'center' }} />
            </View>
          )
        }
      />

      <Modal onRequestClose={() => { if (addLoading) return; setAddModalVisible(false); }} visible={addModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={{ flex: 1, backgroundColor: 'rgba(15,44,107,0.45)' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: s(24) }} keyboardShouldPersistTaps="handled">
          <View style={[styles.modalCard, { borderRadius: 10, padding: s(24) }]}><TourPrompt />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s(16) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY }}>
                Add Patient
              </Text>
              <TouchableOpacity
                onPress={() => { setAddModalVisible(false); setNewPatientName(''); setNewPatientBirthDate(''); setNewEmergencyContactName(''); setNewPatientPhone(''); }}
                accessibilityRole="button"
                accessibilityLabel="Close add patient dialog"
                style={[styles.iconBtn, { width: s(32), height: s(32), borderRadius: s(16) }]}
              >
                <Ionicons name="close" size={s(18)} color={MUTED} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { fontSize: s(14), marginBottom: s(4) }]}>Patient Name</Text>
            <TextInput
              style={[styles.input, { borderRadius: 8, padding: s(12), fontSize: s(16), marginBottom: s(12) }]}
              placeholder="e.g. Mom"
              placeholderTextColor={PLACEHOLDER}
              value={newPatientName}
              onChangeText={setNewPatientName}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={[styles.label, { fontSize: s(14), marginBottom: s(4) }]}>Date of birth (optional)</Text>
            <TextInput
              style={[styles.input, { borderRadius: 8, padding: s(12), fontSize: s(16), marginBottom: s(12) }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={PLACEHOLDER}
              value={newPatientBirthDate}
              onChangeText={setNewPatientBirthDate}
              keyboardType="numbers-and-punctuation"
              returnKeyType="next"
            />

            <Text style={[styles.label, { fontSize: s(14), marginBottom: s(4) }]}>Emergency contact name (optional)</Text>
            <TextInput
              style={[styles.input, { borderRadius: 8, padding: s(12), fontSize: s(16), marginBottom: s(12) }]}
              placeholder="e.g. Jane Smith"
              placeholderTextColor={PLACEHOLDER}
              value={newEmergencyContactName}
              onChangeText={setNewEmergencyContactName}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={[styles.label, { fontSize: s(14), marginBottom: s(4) }]}>Emergency contact phone (optional)</Text>
            <TextInput
              style={[styles.input, { borderRadius: 8, padding: s(12), fontSize: s(16), marginBottom: s(16) }]}
              placeholder="+1 555 555 5555"
              placeholderTextColor={PLACEHOLDER}
              value={newPatientPhone}
              onChangeText={setNewPatientPhone}
              keyboardType="phone-pad"
              returnKeyType="done"
            />

            <Button
              title={addLoading ? 'Adding' : 'Add Patient'}
              onPress={handleAddPatient}
              disabled={!newPatientName.trim() || addLoading}
              loading={addLoading}
              style={{ marginBottom: s(8) }}
            />
            <Button
              title="Cancel"
              onPress={() => { setAddModalVisible(false); setNewPatientName(''); setNewPatientBirthDate(''); setNewEmergencyContactName(''); setNewPatientPhone(''); }}
              style={{ backgroundColor: SURFACE_MUTED }}
              textStyle={{ color: TEXT_DARK }}
            />
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal onRequestClose={() => { setSuccessCode(null); }} visible={!!successCode} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderRadius: 10, padding: s(24), alignItems: 'center' }]}><TourPrompt />
            <View style={[styles.avatar, { width: s(52), height: s(52), borderRadius: s(26), backgroundColor: SUCCESS_BG }]}>
              <Ionicons name="checkmark" size={s(26)} color={SUCCESS} />
            </View>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(19), color: NAVY, marginTop: s(14) }}>
              {successCode?.reset ? `${successCode?.name}'s pairing code was reset` : `${successCode?.name} was added`}
            </Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: MUTED, textAlign: 'center', marginTop: s(6) }}>
              Share this code so they can connect from the app's welcome screen. It expires in 24 hours.
            </Text>
            <View style={{ backgroundColor: SURFACE, borderRadius: 8, paddingVertical: s(14), paddingHorizontal: s(24), marginTop: s(18), marginBottom: s(20) }}>
              <Text selectable style={{ fontFamily: 'DMSans_700Bold', fontSize: s(30), color: NAVY, letterSpacing: s(6) }}>
                {successCode?.code}
              </Text>
            </View>
            <Button title="Done" onPress={() => setSuccessCode(null)} style={{ width: '100%' }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  avatar: {
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: DANGER,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: WHITE,
  },
  iconBtn: {
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15,44,107,0.45)',
  },
  modalCard: {
    backgroundColor: WHITE,
    width: '85%',
    maxWidth: 440,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    color: NAVY,
  },
  input: {
    fontFamily: 'DMSans_400Regular',
    borderWidth: 1.5,
    borderColor: NAVY,
    color: NAVY,
  },
});
