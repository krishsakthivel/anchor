import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  useWindowDimensions,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
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
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};

// Fetches the "at a glance" summary for every patient in one batch: 6 queries
// total regardless of how many patients there are (instead of 6 per patient,
// which was serializing on slower connections and making the whole screen
// feel slow to load after sign-in).
async function getPatientSummaries(patientIds) {
  const empty = {};
  if (!patientIds.length) return empty;

  const today = DAYS[new Date().getDay()];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  const [medsRes, schedRes, tasksRes, medLogRes, taskCompRes, moodRes] = await Promise.all([
    supabase.from('medications').select('id, patient_id, total_pills, pills_remaining, refill_alert_at').in('patient_id', patientIds),
    supabase.from('medication_schedule').select('medication_id, patient_id, days').in('patient_id', patientIds).eq('active', true),
    supabase.from('tasks').select('id, patient_id, days').in('patient_id', patientIds).eq('active', true),
    supabase.from('medication_log').select('medication_id, patient_id, status').in('patient_id', patientIds).gte('logged_at', todayStartIso),
    supabase.from('task_completion').select('task_id, patient_id, status').in('patient_id', patientIds).gte('completed_at', todayStartIso),
    supabase.from('mood_logs').select('patient_id, mood, logged_at').in('patient_id', patientIds).gte('logged_at', todayStartIso).order('logged_at', { ascending: false }),
  ]);

  const meds = medsRes.data || [];
  const schedules = schedRes.data || [];
  const tasks = tasksRes.data || [];
  const medLogs = medLogRes.data || [];
  const taskComps = taskCompRes.data || [];
  const moodLogs = moodRes.data || [];

  const summaries = {};

  for (const patientId of patientIds) {
    const patientSchedules = schedules.filter((sc) => sc.patient_id === patientId);
    const patientTasks = tasks.filter((t) => t.patient_id === patientId);
    const patientMedLogs = medLogs.filter((l) => l.patient_id === patientId);
    const patientTaskComps = taskComps.filter((c) => c.patient_id === patientId);
    const patientMeds = meds.filter((m) => m.patient_id === patientId);

    const scheduledMedIds = new Set(patientSchedules.map((sc) => sc.medication_id));
    const todayMedIds = new Set(
      patientSchedules.filter((sc) => (sc.days || '').includes(today)).map((sc) => sc.medication_id)
    );
    // Meds with no schedule row are due every day (mirrors patient home).
    for (const med of patientMeds) {
      if (!scheduledMedIds.has(med.id)) todayMedIds.add(med.id);
    }
    const todayTaskIds = new Set(
      patientTasks.filter((t) => !t.days || t.days.includes(today)).map((t) => t.id)
    );

    // Only successful statuses count toward the routine — 'skipped'/'missed'
    // logs must not fill the progress bar.
    const medsDone = new Set(
      patientMedLogs.filter((l) => l.status === 'taken').map((l) => l.medication_id)
    );
    const tasksDone = new Set(
      patientTaskComps.filter((c) => c.status === 'completed').map((c) => c.task_id)
    );

    const routineTotal = todayMedIds.size + todayTaskIds.size;
    const routineDone =
      [...todayMedIds].filter((id) => medsDone.has(id)).length +
      [...todayTaskIds].filter((id) => tasksDone.has(id)).length;

    const lowStockCount = patientMeds.filter(
      (m) => m.total_pills && m.pills_remaining !== null && m.pills_remaining <= (m.refill_alert_at || 10)
    ).length;

    // moodLogs is already sorted newest-first across all patients, so the
    // first match per patient is today's latest entry.
    const moodToday = moodLogs.find((l) => l.patient_id === patientId)?.mood || null;

    summaries[patientId] = { routineTotal, routineDone, lowStockCount, moodToday };
  }

  return summaries;
}

export default function CaregiverHomeScreen({ navigation }) {
  const [caregiverName, setCaregiverName] = useState('');
  const [patients, setPatients] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const [successCode, setSuccessCode] = useState(null); // { name, code }

  const { width } = useWindowDimensions();

  const scale = width / 375;
  const s = (size) => Math.round(size * scale);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  const fetchPatients = useCallback(async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      setCaregiverName(profile?.full_name?.trim() || '');

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('patients fetch failed', error);
        Alert.alert('Error', 'Could not load your patients. Pull down to try again.');
        return;
      }

      const base = data || [];
      // Show the list immediately with placeholder summaries so the screen
      // isn't blocked waiting on the heavier per-patient stats.
      setPatients(base.map((patient) => ({
        ...patient,
        routineTotal: 0,
        routineDone: 0,
        lowStockCount: 0,
        moodToday: null,
      })));

      try {
        const summaries = await getPatientSummaries(base.map((p) => p.id));
        setPatients(base.map((patient) => ({
          ...patient,
          ...(summaries[patient.id] || { routineTotal: 0, routineDone: 0, lowStockCount: 0, moodToday: null }),
        })));
      } catch (summaryErr) {
        console.error('getPatientSummaries failed', summaryErr);
        // Leave the placeholder list in place rather than losing the patients.
      }
    } catch (err) {
      console.error('fetchPatients failed', err);
      Alert.alert('Error', 'Could not load your patients. Pull down to try again.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await fetchPatients();
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [fetchPatients]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPatients();
    } finally {
      setRefreshing(false);
    }
  };


  const alertCount = patients.filter((p) => p.lowStockCount > 0).length;
  const routineInProgressCount = patients.filter((p) => p.routineTotal > 0 && p.routineDone < p.routineTotal).length;

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
            name: 'Patient Phone',
            phone: newPatientPhone.trim(),
            priority: 1,
          });
        if (contactError) console.error('emergency_contacts insert failed', contactError);
      }

      // Show the new patient immediately, regardless of how the follow-up
      // summary refresh below goes.
      setPatients((prev) => [
        { ...patient, routineTotal: 0, routineDone: 0, lowStockCount: 0, moodToday: null },
        ...prev,
      ]);

      setAddModalVisible(false);
      setSuccessCode({ name, code });
      setNewPatientName('');
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

  const handleRemovePatient = (patient) => {
    Alert.alert(
      'Remove Patient',
      `Remove ${patient.name}? This deletes their schedule, notes, and history. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const id = patient.id;
            await Promise.all([
              supabase.from('medication_log').delete().eq('patient_id', id),
              supabase.from('medication_schedule').delete().eq('patient_id', id),
              supabase.from('task_completion').delete().eq('patient_id', id),
              supabase.from('care_notes').delete().eq('patient_id', id),
              supabase.from('vital_signs').delete().eq('patient_id', id),
              supabase.from('mood_logs').delete().eq('patient_id', id),
              supabase.from('appointments').delete().eq('patient_id', id),
              supabase.from('emergency_contacts').delete().eq('patient_id', id),
            ]);
            await supabase.from('medications').delete().eq('patient_id', id);
            await supabase.from('tasks').delete().eq('patient_id', id);
            await supabase.from('pairing_codes').delete().eq('code', patient.pair_code);
            await supabase.from('patients').delete().eq('id', id);
            fetchPatients();
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) {
            console.error('signOut failed', error);
            Alert.alert('Error', 'Could not sign out. Please try again.');
            return;
          }
          // Explicit reset: the navigator's initialRouteName only applies on
          // first mount, so an auth-state change alone won't move us off
          // this screen.
          navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
        },
      },
    ]);
  };

  const renderPatient = ({ item }) => {
    const paired = !!item.paired_user_id;
    const hasRoutine = item.routineTotal > 0;
    const routineComplete = hasRoutine && item.routineDone >= item.routineTotal;

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => navigation.navigate('PatientDetail', { patientId: item.id, patientName: item.name })}
        onLongPress={() => handleRemovePatient(item)}
        accessibilityLabel={`${item.name} care plan${item.lowStockCount > 0 ? ', medication running low' : ''}`}
        style={[styles.card, { padding: s(16), borderRadius: 14, marginBottom: s(12) }]}
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
                {paired ? 'Connected' : `Code ${item.pair_code}`}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end', marginLeft: s(6) }}>
            <Ionicons name={item.moodToday ? 'chatbubble-ellipses-outline' : 'remove-circle-outline'} size={s(20)} color={item.moodToday ? SUCCESS : PLACEHOLDER} />
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(10), color: item.moodToday ? SUCCESS : MUTED, marginTop: s(2) }}>
              {item.moodToday ? 'Mood logged' : 'No check-in'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={s(18)} color={PLACEHOLDER} style={{ marginLeft: s(4) }} />
        </View>

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
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(11), color: DANGER }}>
              ⚠ {item.lowStockCount} medication{item.lowStockCount > 1 ? 's' : ''} running low
            </Text>
          </View>
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
                  style={[styles.iconBtn, { width: s(40), height: s(40), borderRadius: s(20) }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="add" size={s(24)} color={NAVY} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Profile')}
                  style={[styles.iconBtn, { width: s(40), height: s(40), borderRadius: s(20), marginLeft: s(8) }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="person-circle-outline" size={s(22)} color={NAVY} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSignOut}
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

            {patients.length > 0 && (
              <View style={{ marginTop: s(16), backgroundColor: SURFACE, borderRadius: 14, padding: s(14) }}>
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

      <TouchableOpacity
        onPress={() => setAddModalVisible(true)}
        style={[styles.fab, { width: s(58), height: s(58), borderRadius: s(29), bottom: s(24), right: s(20) }]}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={s(28)} color={WHITE} />
      </TouchableOpacity>

      {/* Add patient modal */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderRadius: 10, padding: s(24) }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s(16) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY }}>
                Add Patient
              </Text>
              <TouchableOpacity
                onPress={() => { setAddModalVisible(false); setNewPatientName(''); setNewPatientPhone(''); }}
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
            />

            <Text style={[styles.label, { fontSize: s(14), marginBottom: s(4) }]}>Phone (optional)</Text>
            <TextInput
              style={[styles.input, { borderRadius: 8, padding: s(12), fontSize: s(16), marginBottom: s(16) }]}
              placeholder="+1 555 555 5555"
              placeholderTextColor={PLACEHOLDER}
              value={newPatientPhone}
              onChangeText={setNewPatientPhone}
              keyboardType="phone-pad"
            />

            <Button
              title={addLoading ? 'Adding...' : 'Add Patient'}
              onPress={handleAddPatient}
              disabled={!newPatientName.trim() || addLoading}
              loading={addLoading}
              style={{ marginBottom: s(8) }}
            />
            <Button
              title="Cancel"
              onPress={() => { setAddModalVisible(false); setNewPatientName(''); setNewPatientPhone(''); }}
              style={{ backgroundColor: SURFACE_MUTED }}
              textStyle={{ color: TEXT_DARK }}
            />
          </View>
        </View>
      </Modal>

      {/* Pairing code success modal */}
      <Modal visible={!!successCode} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderRadius: 10, padding: s(24), alignItems: 'center' }]}>
            <View style={[styles.avatar, { width: s(52), height: s(52), borderRadius: s(26), backgroundColor: SUCCESS_BG }]}>
              <Ionicons name="checkmark" size={s(26)} color={SUCCESS} />
            </View>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(19), color: NAVY, marginTop: s(14) }}>
              {successCode?.name} was added
            </Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: MUTED, textAlign: 'center', marginTop: s(6) }}>
              Share this code so they can connect from the app's welcome screen.
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
    shadowColor: '#0F2C6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
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
  fab: {
    position: 'absolute',
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
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
