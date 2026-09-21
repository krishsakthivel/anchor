import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, useWindowDimensions, RefreshControl, TouchableOpacity, Alert, Linking, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { NAVY, WHITE, PLACEHOLDER, MUTED, SURFACE, BORDER, SUCCESS, SUCCESS_BG, WARNING_BG, DANGER } from '../theme/colors';
import Button from '../components/Button';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MOODS = [
  { value: 1, emoji: '🤒' },
  { value: 2, emoji: '😢' },
  { value: 3, emoji: '😟' },
  { value: 4, emoji: '😐' },
  { value: 5, emoji: '😊' },
];
const VITAL_UNITS = {
  blood_pressure: 'mmHg',
  blood_sugar: 'mg/dL',
  weight: 'lbs',
  temperature: '°F',
  heart_rate: 'bpm',
  oxygen: '%',
};

export default function PatientHomeScreen({ route, navigation }) {
  const { width } = useWindowDimensions();
  const [patient, setPatient] = useState(null);
  const [medications, setMedications] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [medLogs, setMedLogs] = useState([]);
  const [taskCompletions, setTaskCompletions] = useState([]);
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [careNotes, setCareNotes] = useState([]);
  const [moodToday, setMoodToday] = useState(null);
  const [moodVisible, setMoodVisible] = useState(false);
  const [selectedMood, setSelectedMood] = useState(null);
  const [moodNote, setMoodNote] = useState('');
  const [moodLoading, setMoodLoading] = useState(false);
  const [moodError, setMoodError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [vitalsVisible, setVitalsVisible] = useState(false);
  const [vitalType, setVitalType] = useState('');
  const [vitalValue, setVitalValue] = useState('');
  const [vitalLoading, setVitalLoading] = useState(false);
  const [vitalError, setVitalError] = useState('');

  const [fetchError, setFetchError] = useState('');
  const [loadingInitial, setLoadingInitial] = useState(true);

  const scale = width / 375;
  const s = (size) => Math.round(size * scale);

  const code = route?.params?.code;
  const patientId = route?.params?.patientId;
  const today = DAYS[new Date().getDay()];
  const hour = new Date().getHours();
  let greeting = 'Evening';

  if (hour < 12) {
    greeting = 'Morning';
  } else if (hour < 18) {
    greeting = 'Afternoon';
  }

  const fetchData = async () => {
    setFetchError('');
    let { data: { user } } = await supabase.auth.getUser();

    // Patients don't have a traditional account — they just enter a code.
    // Give them a lightweight anonymous session so the app has an auth.uid()
    // to attach their data to and to satisfy row-level security policies.
    if (!user) {
      const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
      if (anonError || !anonData?.user) {
        console.error('signInAnonymously failed', anonError);
        let message = anonError?.message || 'Could not connect. Please try again.';
        if (anonError?.message?.includes('disabled') || anonError?.status === 422) {
          message = 'Anonymous sign-in is disabled for this project. Ask your developer to enable it in Supabase Auth settings.';
        } else if (anonError?.message?.toLowerCase().includes('database error creating anonymous user')) {
          message = "Your caregiver's app isn't set up to support patient accounts yet (a database trigger needs to allow anonymous users). Ask your developer to check the profiles trigger in Supabase.";
        }
        setFetchError(message);
        setLoadingInitial(false);
        return;
      }
      user = anonData.user;
    }

    let patientData = null;

    if (patientId) {
      const { data } = await supabase.from('patients').select('*').eq('id', patientId).single();
      patientData = data;
    } else if (code) {
      const { data: claimed, error: claimError } = await supabase.rpc('claim_patient_code', {
        p_code: code.toUpperCase(),
      });

      if (claimError || !claimed) {
        console.error('claim_patient_code failed', claimError);
        Alert.alert(
          'Invalid Code',
          claimError?.message || 'This code is invalid or has already been used.',
          [{ text: 'OK', onPress: () => navigation.navigate('Landing') }]
        );
        setLoadingInitial(false);
        return;
      }

      patientData = claimed;
    }

    if (!patientData) {
      setLoadingInitial(false);
      return;
    }
    setPatient(patientData);

    const { data: schedules } = await supabase.from('medication_schedule').select('*').eq('patient_id', patientData.id).eq('active', true);
    const { data: meds } = await supabase.from('medications').select('*').eq('patient_id', patientData.id);
    // Meds with no schedule row (caregiver didn't set a time) have no daily
    // restriction — treat them as due every day so they never go missing.
    const todayMeds = (meds || []).filter((med) => {
      const schedule = (schedules || []).find((s) => s.medication_id === med.id);
      return !schedule || (schedule.days || '').includes(today);
    });
    setMedications(todayMeds);

    const { data: taskData } = await supabase.from('tasks').select('*').eq('patient_id', patientData.id).eq('active', true);
    const todayTasks = (taskData || []).filter((t) => !t.days || t.days.includes(today));
    setTasks(todayTasks);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: logs } = await supabase.from('medication_log').select('*').eq('patient_id', patientData.id).gte('logged_at', todayStart.toISOString());
    setMedLogs(logs || []);

    const { data: comps } = await supabase.from('task_completion').select('*').eq('patient_id', patientData.id).gte('completed_at', todayStart.toISOString());
    setTaskCompletions(comps || []);

    const { data: caregiver } = await supabase.from('caregiver_phone').select('phone').eq('user_id', patientData.created_by).single();
    setCaregiverPhone(caregiver?.phone || '');

    const { data: notes } = await supabase.from('care_notes').select('*').eq('patient_id', patientData.id).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3);
    setCareNotes(notes || []);

    const { data: todayMood } = await supabase.from('mood_logs').select('*').eq('patient_id', patientData.id).gte('logged_at', todayStart.toISOString()).limit(1);
    setMoodToday(todayMood?.[0] || null);
    setLoadingInitial(false);
  };

  useEffect(() => { fetchData(); }, [patientId, code]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const isMedTaken = (medId) => medLogs.some((l) => l.medication_id === medId && l.status === 'taken');
  const isTaskDone = (taskId) => taskCompletions.some((c) => c.task_id === taskId && c.status === 'completed');

  const handleLogMed = async (medId, status) => {
    if (!patient || medLogs.some((log) => log.medication_id === medId)) return;
    const { error } = await supabase.from('medication_log').insert({ medication_id: medId, patient_id: patient.id, status });
    if (error) {
      console.error('medication_log insert failed', error);
      Alert.alert('Could not save', error.message || 'Please try again.');
      return;
    }
    fetchData();
  };

  const handleCompleteTask = async (taskId, status) => {
    if (!patient || taskCompletions.some((completion) => completion.task_id === taskId)) return;
    const { error } = await supabase.from('task_completion').insert({ task_id: taskId, patient_id: patient.id, status });
    if (error) {
      console.error('task_completion insert failed', error);
      Alert.alert('Could not save', error.message || 'Please try again.');
      return;
    }
    fetchData();
  };

  const handleLogMood = async () => {
    if (!selectedMood || moodLoading) return;
    if (!patient) {
      setMoodError('Still loading your info — please wait a moment and try again.');
      return;
    }
    setMoodLoading(true);
    setMoodError('');
    try {
      const { error } = await supabase.from('mood_logs').insert({ patient_id: patient.id, mood: selectedMood, note: moodNote.trim() || null });
      if (error) {
        console.error('mood_logs insert failed', error);
        setMoodError(error.message || 'Could not save. Please try again.');
        Alert.alert('Could not save', error.message || 'Please try again.');
        return;
      }

      let message = 'Thanks for checking in today!';
      if (selectedMood <= 2) {
        message = 'Sorry you feel like that. Hope you feel better today!';
      } else if (selectedMood >= 4) {
        message = 'Glad you are feeling good today!';
      }

      setMoodVisible(false);
      setSelectedMood(null);
      setMoodNote('');
      Alert.alert('Mood logged', message);
      fetchData();
    } catch (err) {
      console.error('handleLogMood failed', err);
      setMoodError('Something went wrong. Please try again.');
      Alert.alert('Could not save', 'Something went wrong. Please try again.');
    } finally {
      setMoodLoading(false);
    }
  };

  const handleLogVital = async () => {
    if (!vitalType || !vitalValue.trim() || vitalLoading) return;
    if (!patient) {
      setVitalError('Still loading your info — please wait a moment and try again.');
      return;
    }
    setVitalLoading(true);
    setVitalError('');
    try {
      const { error } = await supabase.from('vital_signs').insert({ patient_id: patient.id, type: vitalType, value: vitalValue.trim(), unit: VITAL_UNITS[vitalType] || '' });
      if (error) {
        console.error('vital_signs insert failed', error);
        setVitalError(error.message || 'Could not save. Please try again.');
        Alert.alert('Could not save', error.message || 'Please try again.');
        return;
      }
      setVitalsVisible(false);
      setVitalType('');
      setVitalValue('');
      Alert.alert('Logged', 'Vital sign recorded.');
    } catch (err) {
      console.error('handleLogVital failed', err);
      setVitalError('Something went wrong. Please try again.');
      Alert.alert('Could not save', 'Something went wrong. Please try again.');
    } finally {
      setVitalLoading(false);
    }
  };

  const handleCallCaregiver = () => {
    if (caregiverPhone) {
      Linking.openURL(`tel:${caregiverPhone}`);
    } else {
      Alert.alert('No Phone', 'Your caregiver has not added a phone number yet.');
    }
  };

  const handleEmergency = () => {
    Alert.alert('Emergency', 'This will call 911. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call Now', style: 'destructive', onPress: () => Linking.openURL('tel:911') },
    ]);
  };

  const getMoodEmoji = (mood) => MOODS.find((m) => m.value === mood)?.emoji || '😐';

  if (loadingInitial) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE }}>
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE, padding: 32 }}>
        <Ionicons name="alert-circle-outline" size={40} color={DANGER} style={{ marginBottom: 16 }} />
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 18, color: NAVY, textAlign: 'center', marginBottom: 8 }}>
          Couldn't load your info
        </Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MUTED, textAlign: 'center', marginBottom: 24 }}>
          {fetchError}
        </Text>
        <TouchableOpacity
          onPress={() => { setLoadingInitial(true); fetchData(); }}
          style={{ backgroundColor: NAVY, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8 }}
        >
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 16, color: WHITE }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={[]}
      renderItem={null}
      ListHeaderComponent={
        <View style={{ padding: s(22), paddingBottom: s(30) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s(24) }}>
            <View style={{ width: s(34), height: s(34), borderRadius: s(17), backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center', marginRight: s(9) }}>
              <Ionicons name="heart" size={s(17)} color={WHITE} />
            </View>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), color: NAVY }}>Anchor</Text>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: MUTED, marginLeft: s(8) }}>Today</Text>
          </View>

          {/* The patient home stays focused on today's routine. */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: s(24) }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(17), color: MUTED }}>Good {greeting}</Text>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(30), color: NAVY, marginTop: s(2) }}>
                Hi, {patient?.name || 'there'}
              </Text>
            </View>
          </View>

          {!moodToday && (
            <TouchableOpacity
              onPress={() => { setMoodError(''); setMoodVisible(true); }}
              style={{ backgroundColor: WARNING_BG, padding: s(18), borderRadius: 14, marginBottom: s(24), flexDirection: 'row', alignItems: 'center', minHeight: s(82) }}
            >
              <Text style={{ fontSize: s(30), marginRight: s(14) }}>😊</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(19), color: NAVY }}>How are you feeling?</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(16), color: MUTED, marginTop: s(2) }}>Tap to check in for today</Text>
              </View>
            </TouchableOpacity>
          )}

          {moodToday && (
            <View style={{ backgroundColor: SUCCESS_BG, padding: s(16), borderRadius: 14, marginBottom: s(24), flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: s(26), marginRight: s(12) }}>{getMoodEmoji(moodToday.mood)}</Text>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: SUCCESS }}>Mood logged for today</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', marginBottom: s(24) }}>
            <TouchableOpacity
              onPress={() => { setVitalError(''); setVitalsVisible(true); }}
              style={{ flex: 1, backgroundColor: SURFACE, borderRadius: 12, padding: s(14), marginRight: s(6), minHeight: s(74) }}
            >
              <Ionicons name="pulse-outline" size={s(22)} color={NAVY} />
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(15), color: NAVY, marginTop: s(5) }}>Log a vital</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('PatientProfile')}
              style={{ flex: 1, backgroundColor: SURFACE, borderRadius: 12, padding: s(14), marginLeft: s(6), minHeight: s(74) }}
            >
              <Ionicons name="person-outline" size={s(22)} color={NAVY} />
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(15), color: NAVY, marginTop: s(5) }}>My profile</Text>
            </TouchableOpacity>
          </View>

          {careNotes.length > 0 && (
            <View style={{ marginBottom: s(24) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(10) }}>A note from your caregiver</Text>
              {careNotes.slice(0, 1).map((note) => (
                <View key={note.id} style={{ backgroundColor: note.pinned ? WARNING_BG : SURFACE, padding: s(14), borderRadius: 8, marginBottom: s(10) }}>
                  <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: NAVY }}>{note.pinned ? '📌 ' : ''}{note.title}</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(15), color: NAVY, marginTop: s(4) }}>{note.body}</Text>
                </View>
              ))}
            </View>
          )}

          {medications.length > 0 && (
            <View style={{ marginBottom: s(24) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(21), color: NAVY, marginBottom: s(6) }}>Your medicines</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(16), color: MUTED, marginBottom: s(12) }}>Tap one when you have taken it.</Text>
              {medications.map((med) => {
                const taken = isMedTaken(med.id);
                return (
                  <TouchableOpacity
                    key={med.id}
                    disabled={taken || medLogs.some((log) => log.medication_id === med.id)}
                    activeOpacity={0.7}
                    onPress={() => Alert.alert('Mark Medication', `How did ${med.name} go?`, [
                      { text: 'Taken', onPress: () => handleLogMed(med.id, 'taken') },
                      { text: 'Skipped', onPress: () => handleLogMed(med.id, 'skipped') },
                      { text: 'Cancel', style: 'cancel' },
                    ])}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: taken ? SUCCESS_BG : SURFACE,
                      padding: s(16),
                      borderRadius: 14,
                      marginBottom: s(10),
                      minHeight: s(76),
                    }}
                  >
                    <Ionicons
                      name={taken ? 'checkmark-circle' : 'ellipse-outline'}
                      size={s(26)}
                      color={taken ? SUCCESS : NAVY}
                      style={{ marginRight: s(14) }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(19), color: NAVY }}>{med.name}</Text>
                      {med.dosage && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(16), color: MUTED, marginTop: s(2) }}>{med.dosage}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {tasks.length > 0 && (
            <View style={{ marginBottom: s(24) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(21), color: NAVY, marginBottom: s(6) }}>Things to do</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(16), color: MUTED, marginBottom: s(12) }}>Tap one when you are finished.</Text>
              {tasks.map((task) => {
                const done = isTaskDone(task.id);
                return (
                  <TouchableOpacity
                    key={task.id}
                    disabled={done || taskCompletions.some((completion) => completion.task_id === task.id)}
                    activeOpacity={0.7}
                    onPress={() => Alert.alert('Complete Task', `Mark "${task.title}" as:`, [
                      { text: 'Done', onPress: () => handleCompleteTask(task.id, 'completed') },
                      { text: 'Skipped', onPress: () => handleCompleteTask(task.id, 'skipped') },
                      { text: 'Cancel', style: 'cancel' },
                    ])}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: done ? SUCCESS_BG : SURFACE,
                      padding: s(16),
                      borderRadius: 14,
                      marginBottom: s(10),
                      minHeight: s(76),
                    }}
                  >
                    <Ionicons
                      name={done ? 'checkmark-circle' : 'ellipse-outline'}
                      size={s(26)}
                      color={done ? SUCCESS : NAVY}
                      style={{ marginRight: s(14) }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(19), color: NAVY }}>{task.title}</Text>
                      {task.description && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(16), color: MUTED, marginTop: s(2) }}>{task.description}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {medications.length === 0 && tasks.length === 0 && (
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(16), color: MUTED, marginBottom: s(22) }}>
              Nothing scheduled for today.
            </Text>
          )}

          <View style={{ marginTop: s(4), borderTopWidth: 1, borderTopColor: BORDER, paddingTop: s(20) }}>
            <TouchableOpacity
              onPress={handleCallCaregiver}
              style={{ backgroundColor: NAVY, paddingVertical: s(19), borderRadius: 14, alignItems: 'center', marginBottom: s(12), flexDirection: 'row', justifyContent: 'center' }}
            >
              <Ionicons name="call" size={s(24)} color={WHITE} style={{ marginRight: s(10) }} />
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(19), color: WHITE }}>Call Caregiver</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleEmergency}
              style={{ backgroundColor: DANGER_BG, paddingVertical: s(19), borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
            >
              <Ionicons name="alert-circle" size={s(24)} color={DANGER} style={{ marginRight: s(10) }} />
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(19), color: DANGER }}>Emergency — call 911</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NAVY} />}
      ListFooterComponent={
        <>
          <Modal visible={moodVisible} animationType="slide" transparent>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15,44,107,0.45)' }}>
              <View style={{ backgroundColor: WHITE, borderRadius: 10, padding: s(24), width: '88%' }}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>How are you feeling?</Text>
                {!!moodError && (
                  <View style={{ backgroundColor: '#FDECEA', padding: s(10), borderRadius: 8, marginBottom: s(14) }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: DANGER }}>{moodError}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', marginBottom: s(16) }}>
                  {MOODS.map((m) => (
                    <TouchableOpacity
                      key={m.value}
                      onPress={() => setSelectedMood(m.value)}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: s(8),
                        marginHorizontal: s(2),
                        borderRadius: 8,
                        backgroundColor: selectedMood === m.value ? SURFACE : 'transparent',
                        borderWidth: selectedMood === m.value ? 2 : 0,
                        borderColor: NAVY,
                      }}
                    >
                      <Text style={{ fontSize: s(28) }}>{m.emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(16) }} placeholder="Add a note (optional)" placeholderTextColor={PLACEHOLDER} value={moodNote} onChangeText={setMoodNote} />
                <Button title={moodLoading ? 'Logging...' : 'Log Mood'} onPress={handleLogMood} disabled={!selectedMood || moodLoading} loading={moodLoading} style={{ borderRadius: 8, marginBottom: s(8) }} />
                <Button title="Cancel" onPress={() => { if (moodLoading) return; setMoodVisible(false); setSelectedMood(null); setMoodNote(''); setMoodError(''); }} style={{ backgroundColor: MUTED, borderRadius: 8 }} />
              </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          <Modal visible={vitalsVisible} animationType="slide" transparent>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15,44,107,0.45)' }}>
              <View style={{ backgroundColor: WHITE, borderRadius: 10, padding: s(24), width: '88%' }}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>Log Vital Sign</Text>
                {!!vitalError && (
                  <View style={{ backgroundColor: '#FDECEA', padding: s(10), borderRadius: 8, marginBottom: s(14) }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: DANGER }}>{vitalError}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                  {[{ key: 'blood_pressure', label: 'Blood Pressure' }, { key: 'blood_sugar', label: 'Blood Sugar' }, { key: 'weight', label: 'Weight' }, { key: 'temperature', label: 'Temperature' }, { key: 'heart_rate', label: 'Heart Rate' }, { key: 'oxygen', label: 'Oxygen' }].map((t) => (
                    <TouchableOpacity key={t.key} onPress={() => setVitalType(t.key)} style={{ backgroundColor: vitalType === t.key ? NAVY : SURFACE, paddingHorizontal: s(10), paddingVertical: s(6), borderRadius: 6, marginRight: s(6), marginBottom: s(6) }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(12), color: vitalType === t.key ? WHITE : NAVY }}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {vitalType && (
                  // 'default' keyboard on purpose: entries like "120/80" can't be
                  // typed on a decimal pad.
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(18), color: NAVY, marginBottom: s(16) }} placeholder="Value" placeholderTextColor={PLACEHOLDER} value={vitalValue} onChangeText={setVitalValue} keyboardType="default" />
                )}
                <Button title={vitalLoading ? 'Logging...' : 'Log'} onPress={handleLogVital} disabled={!vitalType || !vitalValue.trim() || vitalLoading} loading={vitalLoading} style={{ borderRadius: 8, marginBottom: s(8) }} />
                <Button title="Cancel" onPress={() => { if (vitalLoading) return; setVitalsVisible(false); setVitalType(''); setVitalValue(''); setVitalError(''); }} style={{ backgroundColor: MUTED, borderRadius: 8 }} />
              </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </>
      }
    />
  );
}
