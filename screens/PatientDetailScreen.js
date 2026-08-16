import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  useWindowDimensions,
  RefreshControl,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import useCustomFonts from '../lib/useCustomFonts';
import Button from '../components/Button';
import { NAVY, WHITE, PLACEHOLDER } from '../theme/colors';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TABS = ['Medications', 'Tasks', 'Notes', 'Vitals', 'Appointments', 'Mood', 'Report'];

export default function PatientDetailScreen({ route, navigation }) {
  const { patientId, patientName } = route.params;
  const { width } = useWindowDimensions();
  const { fontsLoaded, FontProvider } = useCustomFonts();
  const [activeTab, setActiveTab] = useState('Medications');
  const [medications, setMedications] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [addMedVisible, setAddMedVisible] = useState(false);
  const [addTaskVisible, setAddTaskVisible] = useState(false);
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medTime, setMedTime] = useState('');
  const [medInstructions, setMedInstructions] = useState('');
  const [medTotalPills, setMedTotalPills] = useState('');
  const [medPillsRemaining, setMedPillsRemaining] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskTime, setTaskTime] = useState('');
  const [loading, setLoading] = useState(false);

  const scale = width / 375;
  const s = (size) => Math.round(size * scale);

  const fetchData = async () => {
    const { data: meds } = await supabase
      .from('medications')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    setMedications(meds || []);
    setTasks(taskData || []);
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  if (!fontsLoaded) return <FontProvider />;

  const handleAddMedication = async () => {
    if (!medName.trim()) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { data: med, error } = await supabase
      .from('medications')
      .insert({
        patient_id: patientId,
        name: medName.trim(),
        dosage: medDosage.trim() || null,
        instructions: medInstructions.trim() || null,
        total_pills: medTotalPills ? parseInt(medTotalPills) : null,
        pills_remaining: medPillsRemaining ? parseInt(medPillsRemaining) : null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to add medication.');
      return;
    }

    if (medTime.trim()) {
      await supabase
        .from('medication_schedule')
        .insert({
          medication_id: med.id,
          patient_id: patientId,
          time: medTime.trim(),
          frequency: 'daily',
          days: JSON.stringify(DAYS),
        });
    }

    setLoading(false);
    setAddMedVisible(false);
    setMedName('');
    setMedDosage('');
    setMedTime('');
    setMedInstructions('');
    setMedTotalPills('');
    setMedPillsRemaining('');
    fetchData();
  };

  const handleAddTask = async () => {
    if (!taskTitle.trim()) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('tasks')
      .insert({
        patient_id: patientId,
        title: taskTitle.trim(),
        description: taskDesc.trim() || null,
        time: taskTime.trim() || null,
        frequency: 'daily',
        days: JSON.stringify(DAYS),
        created_by: user.id,
      });

    setLoading(false);
    if (error) {
      Alert.alert('Error', 'Failed to add task.');
      return;
    }

    setAddTaskVisible(false);
    setTaskTitle('');
    setTaskDesc('');
    setTaskTime('');
    fetchData();
  };

  const handleDeleteMed = async (medId) => {
    Alert.alert('Delete Medication', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('medication_schedule').delete().eq('medication_id', medId);
          await supabase.from('medications').delete().eq('id', medId);
          fetchData();
        },
      },
    ]);
  };

  const handleDeleteTask = async (taskId) => {
    Alert.alert('Delete Task', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('task_completion').delete().eq('task_id', taskId);
          await supabase.from('tasks').delete().eq('id', taskId);
          fetchData();
        },
      },
    ]);
  };

  const handleUpdatePills = async (med) => {
    Alert.alert('Update Pills', `Remaining: ${med.pills_remaining || 0}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Subtract 1',
        onPress: async () => {
          await supabase
            .from('medications')
            .update({ pills_remaining: (med.pills_remaining || 0) - 1 })
            .eq('id', med.id);
          fetchData();
        },
      },
      {
        text: 'Refill',
        onPress: async () => {
          await supabase
            .from('medications')
            .update({ pills_remaining: med.total_pills || 30 })
            .eq('id', med.id);
          fetchData();
        },
      },
    ]);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'Medications':
        return (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(12) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY }}>Medications</Text>
              <TouchableOpacity onPress={() => setAddMedVisible(true)}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>+ Add</Text>
              </TouchableOpacity>
            </View>
            {medications.length === 0 ? (
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>No medications added yet</Text>
            ) : (
              medications.map((med) => (
                <TouchableOpacity
                  key={med.id}
                  onLongPress={() => handleDeleteMed(med.id)}
                  style={{ backgroundColor: '#F0F4FF', padding: s(12), borderRadius: 8, marginBottom: s(8) }}
                >
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(15), color: NAVY }}>{med.name}</Text>
                  {med.dosage && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#666' }}>{med.dosage}</Text>}
                  {med.instructions && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#999' }}>{med.instructions}</Text>}
                  {med.total_pills && (
                    <TouchableOpacity onPress={() => handleUpdatePills(med)}>
                      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: med.pills_remaining <= (med.refill_alert_at || 10) ? '#C0392B' : '#666', marginTop: s(4) }}>
                        Pills: {med.pills_remaining}/{med.total_pills}
                        {med.pills_remaining <= (med.refill_alert_at || 10) ? ' ⚠️ Low' : ''}
                      </Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))
            )}
          </>
        );

      case 'Tasks':
        return (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(12) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY }}>Tasks</Text>
              <TouchableOpacity onPress={() => setAddTaskVisible(true)}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>+ Add</Text>
              </TouchableOpacity>
            </View>
            {tasks.length === 0 ? (
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>No tasks added yet</Text>
            ) : (
              tasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  onLongPress={() => handleDeleteTask(task.id)}
                  style={{ backgroundColor: '#F5F5F5', padding: s(12), borderRadius: 8, marginBottom: s(8) }}
                >
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(15), color: NAVY }}>{task.title}</Text>
                  {task.description && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#666' }}>{task.description}</Text>}
                </TouchableOpacity>
              ))
            )}
          </>
        );

      case 'Notes':
        return <CareNotesTab patientId={patientId} />;

      case 'Vitals':
        return <VitalsTab patientId={patientId} />;

      case 'Appointments':
        return <AppointmentsTab patientId={patientId} />;

      case 'Mood':
        return <MoodTab patientId={patientId} />;

      case 'Report':
        return <ReportTab patientId={patientId} />;

      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: s(20), paddingBottom: 0 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: s(8) }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(22), color: NAVY, marginBottom: s(12) }}>{patientName}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: s(12) }}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                paddingHorizontal: s(14),
                paddingVertical: s(8),
                borderRadius: 20,
                backgroundColor: activeTab === tab ? NAVY : '#F0F4FF',
                marginRight: s(8),
              }}
            >
              <Text style={{
                fontFamily: 'DMSans_500Medium',
                fontSize: s(13),
                color: activeTab === tab ? WHITE : NAVY,
              }}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={<View style={{ padding: s(20), paddingTop: 0 }}>{renderTab()}</View>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListFooterComponent={
          <>
            <Modal visible={addMedVisible} animationType="slide" transparent>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <ScrollView style={{ backgroundColor: WHITE, borderRadius: 12, padding: s(24), width: '85%', maxHeight: '80%' }}>
                  <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>Add Medication</Text>

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Name *</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="e.g. Aspirin" placeholderTextColor={PLACEHOLDER} value={medName} onChangeText={setMedName} />

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Dosage</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="e.g. 100mg" placeholderTextColor={PLACEHOLDER} value={medDosage} onChangeText={setMedDosage} />

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Time (HH:MM)</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="e.g. 08:00" placeholderTextColor={PLACEHOLDER} value={medTime} onChangeText={setMedTime} />

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Instructions</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="e.g. Take with food" placeholderTextColor={PLACEHOLDER} value={medInstructions} onChangeText={setMedInstructions} />

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Total Pills</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="e.g. 30" placeholderTextColor={PLACEHOLDER} value={medTotalPills} onChangeText={setMedTotalPills} keyboardType="numeric" />

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Pills Remaining</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(16) }} placeholder="e.g. 25" placeholderTextColor={PLACEHOLDER} value={medPillsRemaining} onChangeText={setMedPillsRemaining} keyboardType="numeric" />

                  <Button title={loading ? 'Adding...' : 'Add Medication'} onPress={handleAddMedication} disabled={!medName.trim() || loading} loading={loading} style={{ marginBottom: s(8) }} />
                  <Button title="Cancel" onPress={() => { setAddMedVisible(false); setMedName(''); setMedDosage(''); setMedTime(''); setMedInstructions(''); setMedTotalPills(''); setMedPillsRemaining(''); }} style={{ backgroundColor: '#999' }} />
                </ScrollView>
              </View>
            </Modal>

            <Modal visible={addTaskVisible} animationType="slide" transparent>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <View style={{ backgroundColor: WHITE, borderRadius: 12, padding: s(24), width: '85%' }}>
                  <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>Add Task</Text>

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Title *</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="e.g. Morning walk" placeholderTextColor={PLACEHOLDER} value={taskTitle} onChangeText={setTaskTitle} />

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Description</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="Optional details" placeholderTextColor={PLACEHOLDER} value={taskDesc} onChangeText={setTaskDesc} />

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Time (HH:MM)</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(16) }} placeholder="e.g. 09:00" placeholderTextColor={PLACEHOLDER} value={taskTime} onChangeText={setTaskTime} />

                  <Button title={loading ? 'Adding...' : 'Add Task'} onPress={handleAddTask} disabled={!taskTitle.trim() || loading} loading={loading} style={{ marginBottom: s(8) }} />
                  <Button title="Cancel" onPress={() => { setAddTaskVisible(false); setTaskTitle(''); setTaskDesc(''); setTaskTime(''); }} style={{ backgroundColor: '#999' }} />
                </View>
              </View>
            </Modal>
          </>
        }
      />
    </View>
  );
}

function CareNotesTab({ patientId }) {
  const { width } = useWindowDimensions();
  const s = (size) => Math.round(size * (width / 375));
  const [notes, setNotes] = useState([]);
  const [addVisible, setAddVisible] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchNotes = async () => {
    const { data } = await supabase.from('care_notes').select('*').eq('patient_id', patientId).order('pinned', { ascending: false }).order('created_at', { ascending: false });
    setNotes(data || []);
  };

  useEffect(() => { fetchNotes(); }, []);

  const handleAdd = async () => {
    if (!noteTitle.trim() || !noteBody.trim()) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('care_notes').insert({ patient_id: patientId, created_by: user.id, title: noteTitle.trim(), body: noteBody.trim() });
    setLoading(false);
    setAddVisible(false);
    setNoteTitle('');
    setNoteBody('');
    fetchNotes();
  };

  const handleTogglePin = async (note) => {
    await supabase.from('care_notes').update({ pinned: !note.pinned }).eq('id', note.id);
    fetchNotes();
  };

  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(12) }}>
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY }}>Care Notes</Text>
        <TouchableOpacity onPress={() => setAddVisible(true)}>
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>+ Add</Text>
        </TouchableOpacity>
      </View>
      {notes.length === 0 ? (
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>No notes yet</Text>
      ) : (
        notes.map((note) => (
          <TouchableOpacity key={note.id} onLongPress={() => handleTogglePin(note)} style={{ backgroundColor: note.pinned ? '#FFF8E1' : '#F5F5F5', padding: s(14), borderRadius: 8, marginBottom: s(8), borderLeftWidth: note.pinned ? 3 : 0, borderLeftColor: NAVY }}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(15), color: NAVY }}>{note.pinned ? '📌 ' : ''}{note.title}</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: '#333', marginTop: s(4) }}>{note.body}</Text>
          </TouchableOpacity>
        ))
      )}
      <Modal visible={addVisible} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: WHITE, borderRadius: 12, padding: s(24), width: '85%' }}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>Add Note</Text>
            <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="Title" placeholderTextColor={PLACEHOLDER} value={noteTitle} onChangeText={setNoteTitle} />
            <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, height: s(100), textAlignVertical: 'top', marginBottom: s(16) }} placeholder="Note..." placeholderTextColor={PLACEHOLDER} value={noteBody} onChangeText={setNoteBody} multiline />
            <Button title={loading ? 'Adding...' : 'Add'} onPress={handleAdd} disabled={!noteTitle.trim() || !noteBody.trim() || loading} loading={loading} style={{ marginBottom: s(8) }} />
            <Button title="Cancel" onPress={() => { setAddVisible(false); setNoteTitle(''); setNoteBody(''); }} style={{ backgroundColor: '#999' }} />
          </View>
        </View>
      </Modal>
    </>
  );
}

function VitalsTab({ patientId }) {
  const { width } = useWindowDimensions();
  const s = (size) => Math.round(size * (width / 375));
  const [vitals, setVitals] = useState([]);

  const fetchVitals = async () => {
    const { data } = await supabase.from('vital_signs').select('*').eq('patient_id', patientId).order('logged_at', { ascending: false }).limit(20);
    setVitals(data || []);
  };

  useEffect(() => { fetchVitals(); }, []);

  const getTypeIcon = (type) => ({ blood_pressure: '❤️', blood_sugar: '🩸', weight: '⚖️', temperature: '🌡️', heart_rate: '💓', oxygen: '💨' }[type] || '📊');
  const getTypeLabel = (type) => ({ blood_pressure: 'Blood Pressure', blood_sugar: 'Blood Sugar', weight: 'Weight', temperature: 'Temperature', heart_rate: 'Heart Rate', oxygen: 'Oxygen' }[type] || type);

  return (
    <>
      <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY, marginBottom: s(12) }}>Vitals History</Text>
      {vitals.length === 0 ? (
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>No vitals logged yet</Text>
      ) : (
        vitals.map((v) => (
          <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', padding: s(10), borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
            <Text style={{ fontSize: s(18), marginRight: s(8) }}>{getTypeIcon(v.type)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: NAVY }}>{getTypeLabel(v.type)}</Text>
            </View>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>{v.value} {v.unit}</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(11), color: '#999', marginLeft: s(8) }}>{new Date(v.logged_at).toLocaleDateString()}</Text>
          </View>
        ))
      )}
    </>
  );
}

function AppointmentsTab({ patientId }) {
  const { width } = useWindowDimensions();
  const s = (size) => Math.round(size * (width / 375));
  const [appointments, setAppointments] = useState([]);

  const fetchAppts = async () => {
    const { data } = await supabase.from('appointments').select('*').eq('patient_id', patientId).order('appointment_time', { ascending: true });
    setAppointments(data || []);
  };

  useEffect(() => { fetchAppts(); }, []);

  const now = new Date();
  const upcoming = appointments.filter((a) => new Date(a.appointment_time) >= now && !a.completed);

  return (
    <>
      <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY, marginBottom: s(12) }}>Upcoming Appointments</Text>
      {upcoming.length === 0 ? (
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>No upcoming appointments</Text>
      ) : (
        upcoming.map((appt) => {
          const dt = new Date(appt.appointment_time);
          return (
            <View key={appt.id} style={{ backgroundColor: '#F0F4FF', padding: s(12), borderRadius: 8, marginBottom: s(8) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>{appt.title}</Text>
              {appt.doctor && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#333' }}>Dr. {appt.doctor}</Text>}
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#999', marginTop: s(4) }}>
                {dt.toLocaleDateString()} at {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        })
      )}
    </>
  );
}

function MoodTab({ patientId }) {
  const { width } = useWindowDimensions();
  const s = (size) => Math.round(size * (width / 375));
  const [moods, setMoods] = useState([]);

  const fetchMoods = async () => {
    const { data } = await supabase.from('mood_logs').select('*').eq('patient_id', patientId).order('logged_at', { ascending: false }).limit(14);
    setMoods(data || []);
  };

  useEffect(() => { fetchMoods(); }, []);

  const getEmoji = (mood) => ({ 1: '😢', 2: '😟', 3: '😐', 4: '🙂', 5: '😊' }[mood] || '😐');

  return (
    <>
      <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY, marginBottom: s(12) }}>Mood History</Text>
      {moods.length === 0 ? (
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>No mood entries yet</Text>
      ) : (
        moods.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', padding: s(10), borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
            <Text style={{ fontSize: s(24), marginRight: s(12) }}>{getEmoji(m.mood)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY }}>{['', 'Very Bad', 'Bad', 'Okay', 'Good', 'Great'][m.mood]}</Text>
              {m.note && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#666' }}>{m.note}</Text>}
            </View>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(11), color: '#999' }}>{new Date(m.logged_at).toLocaleDateString()}</Text>
          </View>
        ))
      )}
    </>
  );
}

function ReportTab({ patientId }) {
  const { width } = useWindowDimensions();
  const s = (size) => Math.round(size * (width / 375));
  const [report, setReport] = useState(null);

  const fetchReport = async () => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: medLogs } = await supabase.from('medication_log').select('*').eq('patient_id', patientId).gte('logged_at', weekAgo.toISOString());
    const { data: taskComps } = await supabase.from('task_completion').select('*').eq('patient_id', patientId).gte('completed_at', weekAgo.toISOString());
    const { data: meds } = await supabase.from('medications').select('id').eq('patient_id', patientId);
    const { data: tasks } = await supabase.from('tasks').select('id').eq('patient_id', patientId).eq('active', true);

    const medTaken = (medLogs || []).filter((l) => l.status === 'taken').length;
    const medMissed = (medLogs || []).filter((l) => l.status === 'missed').length;
    const taskDone = (taskComps || []).filter((c) => c.status === 'completed').length;
    const taskMissed = (taskComps || []).filter((c) => c.status === 'missed').length;
    const totalMedSlots = (meds || []).length * 7;
    const totalTaskSlots = (tasks || []).length * 7;

    setReport({ medTaken, medMissed, taskDone, taskMissed, totalMedSlots, totalTaskSlots });
  };

  useEffect(() => { fetchReport(); }, []);

  if (!report) return <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>Loading...</Text>;

  const medRate = report.totalMedSlots > 0 ? Math.round((report.medTaken / report.totalMedSlots) * 100) : 0;
  const taskRate = report.totalTaskSlots > 0 ? Math.round((report.taskDone / report.totalTaskSlots) * 100) : 0;

  return (
    <>
      <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY, marginBottom: s(12) }}>Weekly Report</Text>

      <View style={{ backgroundColor: '#F0F4FF', borderRadius: 12, padding: s(14), marginBottom: s(10) }}>
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(15), color: NAVY, marginBottom: s(6) }}>Medications</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: '#333' }}>Taken: {report.medTaken} | Missed: {report.medMissed}</Text>
        <View style={{ height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginTop: s(6), overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${medRate}%`, backgroundColor: medRate >= 80 ? '#4CAF50' : medRate >= 50 ? '#FF9800' : '#F44336', borderRadius: 4 }} />
        </View>
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(12), color: NAVY, marginTop: s(4) }}>{medRate}% completion</Text>
      </View>

      <View style={{ backgroundColor: '#F0F4FF', borderRadius: 12, padding: s(14) }}>
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(15), color: NAVY, marginBottom: s(6) }}>Tasks</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: '#333' }}>Done: {report.taskDone} | Missed: {report.taskMissed}</Text>
        <View style={{ height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginTop: s(6), overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${taskRate}%`, backgroundColor: taskRate >= 80 ? '#4CAF50' : taskRate >= 50 ? '#FF9800' : '#F44336', borderRadius: 4 }} />
        </View>
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(12), color: NAVY, marginTop: s(4) }}>{taskRate}% completion</Text>
      </View>
    </>
  );
}
