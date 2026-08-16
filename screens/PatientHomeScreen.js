import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, useWindowDimensions, RefreshControl, TouchableOpacity, Alert, Linking, TextInput, Modal } from 'react-native';
import styles from './PlaceholderHome.styles';
import { supabase } from '../lib/supabase';
import useCustomFonts from '../lib/useCustomFonts';
import { NAVY, WHITE, PLACEHOLDER } from '../theme/colors';
import Button from '../components/Button';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MOODS = [
  { value: 1, emoji: '😢' },
  { value: 2, emoji: '😟' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😊' },
];

export default function PatientHomeScreen({ route }) {
  const { width } = useWindowDimensions();
  const { fontsLoaded, FontProvider } = useCustomFonts();
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
  const [refreshing, setRefreshing] = useState(false);
  const [vitalsVisible, setVitalsVisible] = useState(false);
  const [vitalType, setVitalType] = useState('');
  const [vitalValue, setVitalValue] = useState('');
  const [vitalLoading, setVitalLoading] = useState(false);

  const scale = width / 375;
  const s = (size) => Math.round(size * scale);

  const code = route?.params?.code;
  const patientId = route?.params?.patientId;
  const today = DAYS[new Date().getDay()];

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let patientData = null;

    if (patientId) {
      const { data } = await supabase.from('patients').select('*').eq('id', patientId).single();
      patientData = data;
    } else if (code) {
      const { data: codeData } = await supabase.from('pairing_codes').select('*').eq('code', code.toUpperCase()).eq('used', false).single();
      if (!codeData) {
        Alert.alert('Invalid Code', 'This code is invalid or has already been used.');
        return;
      }
      const { data: existingPatient } = await supabase.from('patients').select('*').eq('pair_code', code.toUpperCase()).single();
      if (existingPatient) {
        patientData = existingPatient;
      } else {
        const { data: newPatient } = await supabase.from('patients').insert({ name: 'Patient', created_by: codeData.caregiver_id, paired_user_id: user.id, pair_code: code.toUpperCase() }).select().single();
        await supabase.from('pairing_codes').update({ used: true }).eq('id', codeData.id);
        patientData = newPatient;
      }
    }

    if (!patientData) return;
    setPatient(patientData);

    const { data: schedules } = await supabase.from('medication_schedule').select('*').eq('patient_id', patientData.id).eq('active', true);
    const { data: meds } = await supabase.from('medications').select('*').eq('patient_id', patientData.id);
    const todayMeds = (meds || []).filter((med) => {
      const schedule = (schedules || []).find((s) => s.medication_id === med.id);
      return schedule && schedule.days.includes(today);
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
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const isMedTaken = (medId) => medLogs.some((l) => l.medication_id === medId && l.status === 'taken');
  const isTaskDone = (taskId) => taskCompletions.some((c) => c.task_id === taskId && c.status === 'completed');

  const handleLogMed = async (medId, status) => {
    await supabase.from('medication_log').insert({ medication_id: medId, patient_id: patient.id, status });
    fetchData();
  };

  const handleCompleteTask = async (taskId, status) => {
    await supabase.from('task_completion').insert({ task_id: taskId, patient_id: patient.id, status });
    fetchData();
  };

  const handleLogMood = async () => {
    if (!selectedMood) return;
    setMoodLoading(true);
    await supabase.from('mood_logs').insert({ patient_id: patient.id, mood: selectedMood, note: moodNote.trim() || null });
    setMoodLoading(false);
    setMoodVisible(false);
    setSelectedMood(null);
    setMoodNote('');
    fetchData();
  };

  const handleLogVital = async () => {
    if (!vitalType || !vitalValue.trim()) return;
    setVitalLoading(true);
    await supabase.from('vital_signs').insert({ patient_id: patient.id, type: vitalType, value: vitalValue.trim(), unit: '' });
    setVitalLoading(false);
    setVitalsVisible(false);
    setVitalType('');
    setVitalValue('');
    Alert.alert('Logged', 'Vital sign recorded.');
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

  if (!fontsLoaded) return <FontProvider />;

  return (
    <FlatList
      data={[]}
      renderItem={null}
      ListHeaderComponent={
        <View style={{ padding: s(20) }}>
          <Text style={[styles.title, { fontSize: s(22), marginBottom: s(4) }]}>
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}
          </Text>
          {patient && <Text style={[styles.subtitle, { fontSize: s(14), marginBottom: s(20) }]}>{patient.name}'s Day</Text>}

          {!moodToday && (
            <TouchableOpacity onPress={() => setMoodVisible(true)} style={{ backgroundColor: '#FFF8E1', padding: s(14), borderRadius: 8, marginBottom: s(16), flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: s(24), marginRight: s(10) }}>😊</Text>
              <View>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY }}>How are you feeling today?</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#666' }}>Tap to check in</Text>
              </View>
            </TouchableOpacity>
          )}

          {moodToday && (
            <View style={{ backgroundColor: '#F0F4FF', padding: s(12), borderRadius: 8, marginBottom: s(16), flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: s(24), marginRight: s(10) }}>{getMoodEmoji(moodToday.mood)}</Text>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: NAVY }}>Mood logged for today ✓</Text>
            </View>
          )}

          {careNotes.length > 0 && (
            <>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY, marginBottom: s(8) }}>Notes from Caregiver</Text>
              {careNotes.map((note) => (
                <View key={note.id} style={{ backgroundColor: note.pinned ? '#FFF8E1' : '#F5F5F5', padding: s(12), borderRadius: 8, marginBottom: s(8), borderLeftWidth: note.pinned ? 3 : 0, borderLeftColor: NAVY }}>
                  <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>{note.pinned ? '📌 ' : ''}{note.title}</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: '#333', marginTop: s(2) }}>{note.body}</Text>
                </View>
              ))}
            </>
          )}

          {medications.length > 0 && (
            <>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY, marginBottom: s(8) }}>Medications</Text>
              {medications.map((med) => {
                const taken = isMedTaken(med.id);
                return (
                  <View key={med.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: taken ? '#E8F5E9' : '#FFF3E0', padding: s(12), borderRadius: 8, marginBottom: s(8) }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(15), color: NAVY }}>{taken ? '✓ ' : ''}{med.name}</Text>
                      {med.dosage && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#666' }}>{med.dosage}</Text>}
                    </View>
                    {!taken && (
                      <TouchableOpacity onPress={() => Alert.alert('Mark Medication', `How did ${med.name} go?`, [
                        { text: 'Taken', onPress: () => handleLogMed(med.id, 'taken') },
                        { text: 'Skipped', onPress: () => handleLogMed(med.id, 'skipped') },
                        { text: 'Cancel', style: 'cancel' },
                      ])} style={{ backgroundColor: NAVY, paddingHorizontal: s(12), paddingVertical: s(6), borderRadius: 6 }}>
                        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(12), color: WHITE }}>Log</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {tasks.length > 0 && (
            <>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY, marginTop: s(16), marginBottom: s(8) }}>Tasks</Text>
              {tasks.map((task) => {
                const done = isTaskDone(task.id);
                return (
                  <View key={task.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: done ? '#E8F5E9' : '#F5F5F5', padding: s(12), borderRadius: 8, marginBottom: s(8) }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(15), color: NAVY }}>{done ? '✓ ' : ''}{task.title}</Text>
                      {task.description && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#666' }}>{task.description}</Text>}
                    </View>
                    {!done && (
                      <TouchableOpacity onPress={() => Alert.alert('Complete Task', `Mark "${task.title}" as:`, [
                        { text: 'Done', onPress: () => handleCompleteTask(task.id, 'completed') },
                        { text: 'Skipped', onPress: () => handleCompleteTask(task.id, 'skipped') },
                        { text: 'Cancel', style: 'cancel' },
                      ])} style={{ backgroundColor: NAVY, paddingHorizontal: s(12), paddingVertical: s(6), borderRadius: 6 }}>
                        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(12), color: WHITE }}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {medications.length === 0 && tasks.length === 0 && (
            <Text style={[styles.subtitle, { fontSize: s(14), marginTop: s(20) }]}>Nothing scheduled for today.</Text>
          )}

          <View style={{ marginTop: s(24) }}>
            <TouchableOpacity onPress={() => setVitalsVisible(true)} style={{ backgroundColor: '#F0F4FF', padding: s(14), borderRadius: 8, alignItems: 'center', marginBottom: s(10) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(15), color: NAVY }}>Log Vitals</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleCallCaregiver} style={{ backgroundColor: NAVY, padding: s(16), borderRadius: 8, alignItems: 'center', marginBottom: s(10) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: WHITE }}>Call Caregiver</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleEmergency} style={{ backgroundColor: '#C0392B', padding: s(16), borderRadius: 8, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: WHITE }}>Emergency</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListFooterComponent={
        <>
          <Modal visible={moodVisible} animationType="slide" transparent>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <View style={{ backgroundColor: WHITE, borderRadius: 12, padding: s(24), width: '85%' }}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>How are you feeling?</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(16) }}>
                  {MOODS.map((m) => (
                    <TouchableOpacity key={m.value} onPress={() => setSelectedMood(m.value)} style={{ alignItems: 'center', padding: s(10), borderRadius: 12, backgroundColor: selectedMood === m.value ? '#F0F4FF' : 'transparent', borderWidth: selectedMood === m.value ? 2 : 0, borderColor: NAVY }}>
                      <Text style={{ fontSize: s(32) }}>{m.emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(16) }} placeholder="Add a note (optional)" placeholderTextColor={PLACEHOLDER} value={moodNote} onChangeText={setMoodNote} />
                <Button title={moodLoading ? 'Logging...' : 'Log Mood'} onPress={handleLogMood} disabled={!selectedMood || moodLoading} loading={moodLoading} style={{ marginBottom: s(8) }} />
                <Button title="Cancel" onPress={() => { setMoodVisible(false); setSelectedMood(null); setMoodNote(''); }} style={{ backgroundColor: '#999' }} />
              </View>
            </View>
          </Modal>

          <Modal visible={vitalsVisible} animationType="slide" transparent>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <View style={{ backgroundColor: WHITE, borderRadius: 12, padding: s(24), width: '85%' }}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>Log Vital Sign</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                  {[{ key: 'blood_pressure', label: 'Blood Pressure' }, { key: 'blood_sugar', label: 'Blood Sugar' }, { key: 'weight', label: 'Weight' }, { key: 'temperature', label: 'Temperature' }, { key: 'heart_rate', label: 'Heart Rate' }, { key: 'oxygen', label: 'Oxygen' }].map((t) => (
                    <TouchableOpacity key={t.key} onPress={() => setVitalType(t.key)} style={{ backgroundColor: vitalType === t.key ? NAVY : '#F0F4FF', paddingHorizontal: s(10), paddingVertical: s(6), borderRadius: 6, marginRight: s(6), marginBottom: s(6) }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(12), color: vitalType === t.key ? WHITE : NAVY }}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {vitalType && (
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(18), color: NAVY, marginBottom: s(16) }} placeholder="Value" placeholderTextColor={PLACEHOLDER} value={vitalValue} onChangeText={setVitalValue} keyboardType="decimal-pad" />
                )}
                <Button title={vitalLoading ? 'Logging...' : 'Log'} onPress={handleLogVital} disabled={!vitalType || !vitalValue.trim() || vitalLoading} loading={vitalLoading} style={{ marginBottom: s(8) }} />
                <Button title="Cancel" onPress={() => { setVitalsVisible(false); setVitalType(''); setVitalValue(''); }} style={{ backgroundColor: '#999' }} />
              </View>
            </View>
          </Modal>
        </>
      }
    />
  );
}
