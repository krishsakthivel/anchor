import useTabLoader, { TabRefreshContext } from '../lib/useTabLoader';
const { MOODS, normalizeDays } = require('../lib/careValues');
const { medicationLogError } = require('../lib/medicationLogError');
const { reportWindow, reportTotals } = require('../lib/reportWindow');
import { appAlert as Alert } from '../components/AppDialog';
import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  useWindowDimensions,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import * as Crypto from 'expo-crypto';
import Button from '../components/Button';
import MedicationCard from '../components/MedicationCard';
import WeekdaySelector from '../components/WeekdaySelector';
const { MEDICATION_DAYS, medicationScheduleError, medicationDaysLabel } = require('../lib/medicationSchedule');
import TimePickerInput from '../components/TimePickerInput';
import { writeLocationTag } from '../lib/nfc';
import { NAVY, WHITE, PLACEHOLDER, SURFACE } from '../theme/colors';
import { displayTime, planLabels } from '../lib/dailyPlan';
const { localDateKey } = require('../lib/localDate');

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TABS = ['Medications', 'Tasks', 'Schedule', 'Notes', 'Vitals', 'Appointments', 'Mood', 'Report'];
const REPORT_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export default function PatientDetailScreen({ route, navigation }) {
  const { patientId, patientName, canEdit = true, initialTab = 'Medications' } = route.params;
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [medications, setMedications] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [medLogs, setMedLogs] = useState([]);
  const [loggingId, setLoggingId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const tabRefresh = React.useRef(null);
  const registerRefresh = React.useCallback((loader) => {
    tabRefresh.current = loader;
    return () => { if (tabRefresh.current === loader) tabRefresh.current = null; };
  }, []);
  const [addMedVisible, setAddMedVisible] = useState(false);
  const [addTaskVisible, setAddTaskVisible] = useState(false);
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medTime, setMedTime] = useState('');
  const [medDays, setMedDays] = useState([...MEDICATION_DAYS]);
  const [medInstructions, setMedInstructions] = useState('');
  const [medTotalPills, setMedTotalPills] = useState('');
  const [medPillsRemaining, setMedPillsRemaining] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [taskDays, setTaskDays] = useState([...DAYS]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskTime, setTaskTime] = useState('');
  const [loading, setLoading] = useState(false);

  const scale = Math.min(1.08, Math.max(0.95, width / 375));
  const s = (size) => Math.round(size * scale);

  const fetchData = async () => {
    try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: meds, error: medsError } = await supabase
      .from('medications')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    const { data: taskData, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    const { data: scheduleRows, error: scheduleError } = await supabase.from('medication_schedule').select('*').eq('patient_id', patientId).eq('active', true);
    const { data: logRows, error: logError } = await supabase.from('medication_log').select('*').eq('patient_id', patientId).eq('log_day', localDateKey(todayStart));

    if (medsError || tasksError || scheduleError || logError) {
      console.error('patient detail fetch failed', medsError || tasksError || scheduleError || logError);
      setActionError('Could not load this care plan. Pull down to try again.');
      return;
    }
    setActionError('');
    setMedications(meds || []);
    setTasks(taskData || []);
    setSchedules(scheduleRows || []);
    setMedLogs(logRows || []);
    } catch (error) { setActionError(error.message || 'Could not load this care plan. Please refresh.'); }
  };

  const logMedicine = async (med, schedule, status) => {
    const slotId = schedule?.id || med.id;
    if (loggingId || !canEdit) return;
    setLoggingId(slotId);
    setActionError('');
    try {
      const { error } = await supabase.from('medication_log').insert({
        medication_id: med.id, patient_id: patientId, schedule_id: schedule?.id || null, status, log_day: localDateKey(new Date()),
      });
      if (error) throw error;
      await fetchData();
    } catch (error) {
      setActionError(medicationLogError(error));
    } finally {
      setLoggingId(null);
    }
  };

  useFocusEffect(React.useCallback(() => { fetchData(); }, [patientId]));

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchData();
      await tabRefresh.current?.();
    } catch (error) {
      setActionError(error.message || 'Could not refresh. Please try again.');
    } finally { setRefreshing(false); }
  };


  const handleAddMedication = async () => {
    if (!medName.trim() || loading || !canEdit) return;
    const scheduleValidation = medicationScheduleError(medDays, medTime);
    if (scheduleValidation) { Alert.alert('Check medication schedule', scheduleValidation); return; }
    const totalPills = medTotalPills.trim() === '' ? null : Number(medTotalPills);
    const pillsRemaining = medPillsRemaining.trim() === '' ? null : Number(medPillsRemaining);
    if ((totalPills !== null && (!Number.isInteger(totalPills) || totalPills < 0))
      || (pillsRemaining !== null && (!Number.isInteger(pillsRemaining) || pillsRemaining < 0))
      || (totalPills !== null && pillsRemaining !== null && pillsRemaining > totalPills)) {
      Alert.alert('Invalid pill count', 'Use whole, non-negative numbers. Remaining pills cannot be more than the total.');
      return;
    }
    setLoading(true);
    try {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      Alert.alert('Session expired', 'Please sign in again before adding medication.');
      return;
    }

    const enteredTime = medTime.trim();
    if (enteredTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(enteredTime)) {
      setLoading(false);
      Alert.alert('Invalid time', 'Use 24-hour HH:MM format, for example 08:30.');
      return;
    }

    const { data: med, error } = await supabase
      .from('medications')
      .insert({
        patient_id: patientId,
        name: medName.trim(),
        dosage: medDosage.trim() || null,
        instructions: medInstructions.trim() || null,
        total_pills: totalPills,
        pills_remaining: pillsRemaining,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      setLoading(false);
      Alert.alert('Could not add medication', error.message || 'Please try again.');
      return;
    }

    if (enteredTime) {
      const { error: scheduleError } = await supabase
        .from('medication_schedule')
        .insert({
          medication_id: med.id,
          patient_id: patientId,
          time: enteredTime,
          frequency: medDays.length === 7 ? 'daily' : 'weekly',
          days: MEDICATION_DAYS.filter(day => medDays.includes(day)),
        });

      if (scheduleError) {
          const { error: rollbackError } = await supabase.from('medications').delete().eq('id', med.id);
          if (rollbackError) console.error('medication rollback failed', rollbackError);
        setLoading(false);
        Alert.alert('Could not add medication', scheduleError.message || 'The medicine schedule could not be created.');
        return;
      }
    }

    setLoading(false);
    setAddMedVisible(false);
    setMedName('');
    setMedDosage('');
    setMedTime('');
    setMedDays([...MEDICATION_DAYS]);
    setMedInstructions('');
    setMedTotalPills('');
    setMedPillsRemaining('');
    fetchData();
    } catch (error) {
      Alert.alert('Could not save', error.message || 'Please try again.');
    } finally { setLoading(false); }
  };

  const closeTaskForm = () => {
    if (loading) return;
    setAddTaskVisible(false);
    setEditingTask(null);
    setTaskTitle('');
    setTaskDesc('');
    setTaskTime('');
    setTaskDays([...DAYS]);
  };

  const openTaskForm = (task = null) => {
    if (!canEdit || loading) return;
    setEditingTask(task);
    setTaskTitle(task?.title || '');
    setTaskDesc(task?.description || '');
    setTaskTime(task?.time ? String(task.time).slice(0, 5) : '');
    setTaskDays(task?.days == null ? [...DAYS] : DAYS.filter(day => normalizeDays(task.days).includes(day)));
    setAddTaskVisible(true);
  };

  const handleSaveTask = async () => {
    if (!taskTitle.trim() || !canEdit || loading) return;
    if (!taskDays.length) { Alert.alert('Choose task days', 'Select at least one day for this task.'); return; }
    const enteredTime = taskTime.trim();
    if (enteredTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(enteredTime)) {
      Alert.alert('Invalid time', 'Use 24-hour HH:MM format, for example 08:30.');
      return;
    }
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Your session has expired. Please sign in again.');
      const values = {
        title: taskTitle.trim(),
        description: taskDesc.trim() || null,
        time: enteredTime || null,
        frequency: taskDays.length === 7 ? 'daily' : 'weekly',
        days: DAYS.filter(day => taskDays.includes(day)),
      };
      const request = editingTask
        ? supabase.from('tasks').update(values).eq('id', editingTask.id).eq('patient_id', patientId).select('id').single()
        : supabase.from('tasks').insert({ ...values, patient_id: patientId, created_by: user.id }).select('id').single();
      const { error } = await request;
      if (error) throw error;
      setAddTaskVisible(false);
      setEditingTask(null);
      setTaskTitle('');
      setTaskDesc('');
      setTaskTime('');
      setTaskDays([...DAYS]);
      await fetchData();
    } catch (error) {
      Alert.alert(editingTask ? 'Could not update task' : 'Could not add task', error.message || 'Please try again.');
    } finally { setLoading(false); }
  };

  const handleDeleteMed = async (medId) => {
    Alert.alert('Delete Medication', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('medications').delete().eq('id', medId);
          if (error) {
            Alert.alert('Error', error.message || 'Could not delete this medication.');
            return;
          }
          await fetchData();
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
          const { error } = await supabase.from('tasks').delete().eq('id', taskId);
          if (error) {
            Alert.alert('Error', error.message || 'Could not delete this task.');
            return;
          }
          await fetchData();
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
          const { error } = await supabase
            .from('medications')
            .update({ pills_remaining: Math.max(0, (med.pills_remaining || 0) - 1) })
            .eq('id', med.id);
          if (error) Alert.alert('Error', error.message || 'Could not update the pill count.');
          else await fetchData();
        },
      },
      {
        text: 'Refill',
        onPress: async () => {
          const { error } = await supabase
            .from('medications')
            .update({ pills_remaining: med.total_pills ?? 30 })
            .eq('id', med.id);
          if (error) Alert.alert('Error', error.message || 'Could not update the pill count.');
          else await fetchData();
        },
      },
    ]);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'Medications':
        return (
          <>
            {!!actionError && <Text style={{ color: '#C0392B', marginBottom: s(10), fontSize: s(14) }}>{actionError}</Text>}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(12) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY }}>Medications</Text>
              {canEdit && <TouchableOpacity onPress={() => setAddMedVisible(true)}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>+ Add</Text>
              </TouchableOpacity>}
            </View>
            {medications.length === 0 ? (
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>No medications added yet</Text>
            ) : (
              medications.map(med => <MedicationCard key={med.id}
                medication={med}
                schedules={schedules.filter(schedule => schedule.medication_id === med.id)}
                logs={medLogs} canEdit={canEdit} busy={!!loggingId} scale={s}
                onRecord={(schedule, status) => logMedicine(med, schedule, status)}
                onUpdatePills={() => handleUpdatePills(med)}
                onDelete={() => handleDeleteMed(med.id)} />)
            )}
          </>
        );

      case 'Tasks':
        return (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(12) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY }}>Tasks</Text>
              {canEdit && <TouchableOpacity onPress={() => openTaskForm()}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>+ Add</Text>
              </TouchableOpacity>}
            </View>
            {tasks.length === 0 ? (
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>No tasks added yet</Text>
            ) : (
              tasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  onLongPress={() => canEdit && handleDeleteTask(task.id)}
                  style={{ backgroundColor: '#F5F5F5', padding: s(12), borderRadius: 8, marginBottom: s(8) }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(8) }}>
                    <Text style={{ flex: 1, fontFamily: 'DMSans_700Bold', fontSize: s(16), color: NAVY }}>{task.title}</Text>
                    {canEdit && <TouchableOpacity onPress={() => openTaskForm(task)} disabled={loading} accessibilityRole="button" accessibilityLabel={'Edit ' + task.title} style={{ minHeight: s(44), minWidth: s(48), justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>Edit</Text>
                    </TouchableOpacity>}
                  </View>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#6B7280', marginTop: s(4) }}>{task.days == null ? 'Every day' : medicationDaysLabel(task.days)}{task.time ? ' · ' + displayTime(String(task.time).slice(0, 5)) : ''}</Text>
                  {!!task.description && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#666' }}>{task.description}</Text>}
                </TouchableOpacity>
              ))
            )}
          </>
        );

      case 'Notes':
        return <CareNotesTab patientId={patientId} canEdit={canEdit} />;

      case 'Schedule':
        return <DailyScheduleTab patientId={patientId} canEdit={canEdit} />;

      case 'Vitals':
        return <VitalsTab patientId={patientId} />;

      case 'Appointments':
        return <AppointmentsTab patientId={patientId} navigation={navigation} canEdit={canEdit} />;

      case 'Mood':
        return <MoodTab patientId={patientId} />;

      case 'Report':
        return <ReportTab patientId={patientId} />;

      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      <View style={{ padding: s(20), paddingBottom: 0 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: s(8) }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(22), color: NAVY, marginBottom: s(12) }}>{patientName}</Text>
        <Button title="Refresh care plan" onPress={onRefresh} disabled={refreshing} loading={refreshing} style={{ marginBottom: s(12) }} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: s(12) }}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                paddingHorizontal: s(14),
                paddingVertical: s(8),
                borderRadius: 20,
                backgroundColor: activeTab === tab ? NAVY : SURFACE,
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
        ListHeaderComponent={<TabRefreshContext.Provider value={registerRefresh}><View style={{ padding: s(20), paddingTop: 0 }}>{!!actionError && activeTab !== 'Medications' && <Text style={{ color: '#C0392B', marginBottom: s(10) }}>{actionError}</Text>}{renderTab()}</View></TabRefreshContext.Provider>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListFooterComponent={
          <>
            <Modal onRequestClose={() => { if (loading) return; setAddMedVisible(false); }} visible={addMedVisible} animationType="slide" transparent>
              <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: s(24) }} style={{ backgroundColor: WHITE, borderRadius: 12, width: '90%', maxWidth: 480, maxHeight: '85%' }}>
                  <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>Add Medication</Text>

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Name *</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="e.g. Aspirin" placeholderTextColor={PLACEHOLDER} value={medName} onChangeText={setMedName} />

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Dosage</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="e.g. 100mg" placeholderTextColor={PLACEHOLDER} value={medDosage} onChangeText={setMedDosage} />

                  <WeekdaySelector value={medDays} onChange={setMedDays} disabled={loading} />
                  <TimePickerInput label={medDays.length === 7 ? 'Medicine time (optional)' : 'Medicine time *'} value={medTime} onChange={setMedTime} optional={medDays.length === 7} />
                  {medDays.length > 0 && medDays.length < 7 && !medTime && <Text style={{ color: NAVY, fontFamily: 'DMSans_400Regular', fontSize: s(12), marginBottom: s(12) }}>Choose a time for the selected days.</Text>}

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Instructions</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="e.g. Take with food" placeholderTextColor={PLACEHOLDER} value={medInstructions} onChangeText={setMedInstructions} />

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Total Pills</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="e.g. 30" placeholderTextColor={PLACEHOLDER} value={medTotalPills} onChangeText={setMedTotalPills} keyboardType="numeric" />

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Pills Remaining</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(16) }} placeholder="e.g. 25" placeholderTextColor={PLACEHOLDER} value={medPillsRemaining} onChangeText={setMedPillsRemaining} keyboardType="numeric" />

                  <Button title={loading ? 'Adding' : 'Add Medication'} onPress={handleAddMedication} disabled={!medName.trim() || loading || !!medicationScheduleError(medDays, medTime)} loading={loading} style={{ marginBottom: s(8) }} />
                  <Button title="Cancel" disabled={loading} onPress={() => { setAddMedVisible(false); setMedName(''); setMedDosage(''); setMedTime(''); setMedDays([...MEDICATION_DAYS]); setMedInstructions(''); setMedTotalPills(''); setMedPillsRemaining(''); }} style={{ backgroundColor: '#999' }} />
                </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </Modal>

            <Modal onRequestClose={closeTaskForm} visible={addTaskVisible} animationType="slide" transparent>
              <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: s(24) }} keyboardShouldPersistTaps="handled">
                <View style={{ backgroundColor: WHITE, borderRadius: 12, padding: s(24), width: '85%' }}>
                  <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>{editingTask ? 'Edit Task' : 'Add Task'}</Text>

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Title *</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="e.g. Morning walk" placeholderTextColor={PLACEHOLDER} value={taskTitle} onChangeText={setTaskTitle} />

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Description</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="Optional details" placeholderTextColor={PLACEHOLDER} value={taskDesc} onChangeText={setTaskDesc} />

                  <WeekdaySelector value={taskDays} onChange={setTaskDays} disabled={loading} itemLabel="task" />
                  <TimePickerInput label="Task time (optional)" value={taskTime} onChange={setTaskTime} optional />

                  <Button title={loading ? 'Saving' : editingTask ? 'Save changes' : 'Add Task'} onPress={handleSaveTask} disabled={!taskTitle.trim() || !taskDays.length || loading} loading={loading} style={{ marginBottom: s(8) }} />
                  <Button title="Cancel" disabled={loading} onPress={closeTaskForm} style={{ backgroundColor: '#999' }} />
                </View>
                </ScrollView>
              </KeyboardAvoidingView>
            </Modal>
          </>
        }
      />
    </View>
  );
}

function DailyScheduleTab({ patientId, canEdit }) {
  const { width } = useWindowDimensions();
  const s = (size) => Math.round(size * Math.min(1.08, Math.max(0.95, width / 375)));
  const [plan, setPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [places, setPlaces] = useState([]);
  const [placeName, setPlaceName] = useState('');
  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [checkins, setCheckins] = useState([]);
  const today = localDateKey(new Date());

  const fetchPlan = async () => {
    const { data, error } = await supabase.from('daily_plans').select('*').eq('patient_id', patientId).eq('plan_date', localDateKey(new Date())).maybeSingle();
    if (error) throw error;
    setPlan(data || null);
    if (data) {
      const { data: rows, error: checkinError } = await supabase.from('activity_checkins').select('block_index, checked_at').eq('plan_id', data.id);
      if (checkinError) throw checkinError;
      else setCheckins(rows || []);
    } else setCheckins([]);
  };

  const fetchPlaces = async () => {
    if (!canEdit) return;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Please sign in again to manage NFC places.');
    const { data, error } = await supabase.from('checkin_locations').select('*').eq('caregiver_id', user.id).order('name');
    if (error) throw error;
    else setPlaces(data || []);
  };

  const loadError = useTabLoader(async () => { await fetchPlan(); await fetchPlaces(); }, patientId);

  const addPlace = async () => {
    const name = placeName.trim();
    if (!name || placeBusy) return;
    setPlaceBusy(true);
    setPlaceError('');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Please sign in again.');
      const { error } = await supabase.from('checkin_locations').insert({ caregiver_id: user.id, name, tag_token: Crypto.randomUUID() });
      if (error) throw error;
      setPlaceName('');
      await fetchPlaces();
    } catch (error) {
      setPlaceError(error.message || 'Could not add this place.');
    } finally { setPlaceBusy(false); }
  };

  const programSticker = async (place) => {
    if (placeBusy) return;
    setPlaceBusy(true);
    setPlaceError('');
    try {
      await writeLocationTag(place.tag_token);
      Alert.alert('Sticker ready', `${place.name} is ready for activity check-ins.`);
    } catch (error) {
      setPlaceError(error.message || 'Could not write this sticker. Try another NFC sticker.');
    } finally { setPlaceBusy(false); }
  };

  const assignPlace = async (index, place) => {
    if (!plan || saving || checkins.some((item) => item.block_index === index)) return;
    setSaving(true);
    try {
    setPlaceError('');
    const blocks = plan.blocks.map((block, blockIndex) => blockIndex === index
      ? { ...block, location_id: place?.id || null, location_name: place?.name || null }
      : block);
    const { data, error } = await supabase.from('daily_plans').update({ blocks, updated_at: new Date().toISOString() }).eq('id', plan.id).select().single();
    setSaving(false);
    if (error) setPlaceError(error.message || 'Could not assign this place.');
    else setPlan(data);
    } catch (error) {
      Alert.alert('Could not save', error.message || 'Please try again.');
    } finally { setSaving(false); }
  };

  const adjustBlock = async (index, amount) => {
    if (!plan || saving) return;
    const blocks = plan.blocks.map((block, blockIndex) => blockIndex === index ? { ...block, minutes: Math.max(0, Number(block.minutes || 0) + amount) } : block);
    setSaving(true);
    try {
    const { data, error } = await supabase
      .from('daily_plans')
      .update({ blocks, overridden_by: (await supabase.auth.getUser()).data.user?.id || null, updated_at: new Date().toISOString() })
      .eq('id', plan.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      Alert.alert('Could not update schedule', 'Please try again.');
      return;
    }
    setPlan(data);
    } catch (error) {
      Alert.alert('Could not save', error.message || 'Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <>
      {!!loadError && <Text style={{ color: '#C0392B', marginBottom: s(10) }}>{loadError}</Text>}
      <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY, marginBottom: s(5) }}>Today’s schedule</Text>
      {!!placeError && <Text style={{ color: '#C0392B', marginBottom: s(10) }}>{placeError}</Text>}
      {!plan ? <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666', marginBottom: s(12) }}>The patient has not completed today’s check-in yet.</Text> : <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: '#666', marginBottom: s(12) }}>{plan.overridden_by ? 'Adjusted by caregiver' : 'Built from the morning check-in'}</Text>}
      <TouchableOpacity onPress={async () => { try { await fetchPlan(); await fetchPlaces(); setPlaceError(''); } catch (error) { setPlaceError(error.message || 'Could not refresh.'); } }} style={{ marginBottom: s(12) }}><Text style={{ color: NAVY, fontFamily: 'DMSans_500Medium' }}>Refresh schedule and check-ins</Text></TouchableOpacity>
      {(plan?.blocks || []).map((block, index) => (
        <View key={`${block.start}-${index}`} style={{ backgroundColor: SURFACE, borderRadius: 6, padding: s(12), marginBottom: s(8), flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ width: s(66), fontFamily: 'DMSans_700Bold', fontSize: s(12), color: NAVY }}>{displayTime(block.start)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(15), color: NAVY }}>{block.title || planLabels[block.type]}</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: '#666' }}>{block.minutes} minutes{block.location_name ? `, ${block.location_name}` : ''}</Text>
            {checkins.some((item) => item.block_index === index) && <Text style={{ color: '#217346', fontFamily: 'DMSans_500Medium', marginTop: s(4) }}>Arrived at {new Date(checkins.find((item) => item.block_index === index).checked_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>}
            {canEdit && block.type !== 'medicine' && !checkins.some((item) => item.block_index === index) && places.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: s(7) }}>
              {[null, ...places].map((place) => <TouchableOpacity key={place?.id || 'none'} disabled={saving} onPress={() => assignPlace(index, place)} style={{ backgroundColor: block.location_id === (place?.id || null) ? NAVY : WHITE, borderRadius: 6, paddingVertical: s(6), paddingHorizontal: s(8), marginRight: s(5) }}><Text style={{ color: block.location_id === (place?.id || null) ? WHITE : NAVY, fontSize: s(12) }}>{place?.name || 'No place'}</Text></TouchableOpacity>)}
            </ScrollView>}
          </View>
          {canEdit && <View style={{ flexDirection: 'row' }}><TouchableOpacity disabled={saving} onPress={() => adjustBlock(index, -15)} style={{ padding: s(8) }}><Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), color: NAVY }}>−</Text></TouchableOpacity><TouchableOpacity disabled={saving} onPress={() => adjustBlock(index, 15)} style={{ padding: s(8) }}><Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), color: NAVY }}>+</Text></TouchableOpacity></View>}
        </View>
      ))}
      {canEdit && <View style={{ marginTop: s(16), padding: s(14), backgroundColor: SURFACE, borderRadius: 6 }}>
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: NAVY }}>Places & NFC stickers</Text>
        <Text style={{ color: '#666', marginTop: s(4), marginBottom: s(10) }}>Add a place, write its sticker, then select that place for an activity above.</Text>
        <TextInput value={placeName} onChangeText={setPlaceName} placeholder="e.g. Game room" placeholderTextColor={PLACEHOLDER} maxLength={80} style={{ borderWidth: 1, borderColor: NAVY, borderRadius: 8, padding: s(10), backgroundColor: WHITE, color: NAVY, marginBottom: s(8) }} />
        <Button title="Add place" onPress={addPlace} disabled={!placeName.trim() || placeBusy} style={{ marginBottom: s(10) }} />
        {places.map((place) => <View key={place.id} style={{ paddingVertical: s(8), borderTopWidth: 1, borderColor: '#D8E0F0', flexDirection: 'row', alignItems: 'center' }}><Text style={{ flex: 1, color: NAVY, fontFamily: 'DMSans_500Medium' }}>{place.name}</Text><TouchableOpacity disabled={placeBusy} onPress={() => programSticker(place)} accessibilityRole="button" style={{ padding: s(8) }}><Text style={{ color: NAVY, fontFamily: 'DMSans_700Bold' }}>Write sticker</Text></TouchableOpacity></View>)}
      </View>}
    </>
  );
}

function CareNotesTab({ patientId, canEdit }) {
  const { width } = useWindowDimensions();
  const s = (size) => Math.round(size * Math.min(1.08, Math.max(0.95, width / 375)));
  const [notes, setNotes] = useState([]);
  const [addVisible, setAddVisible] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchNotes = async () => {
    const { data, error } = await supabase.from('care_notes').select('*').eq('patient_id', patientId).order('pinned', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    setNotes(data || []);
  };

  const loadError = useTabLoader(fetchNotes, patientId);

  const handleAdd = async () => {
    if (!noteTitle.trim() || !noteBody.trim()) return;
    setLoading(true);
    try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      Alert.alert('Session expired', 'Please sign in again before adding a note.');
      return;
    }
    const { error } = await supabase.from('care_notes').insert({ patient_id: patientId, created_by: user.id, title: noteTitle.trim(), body: noteBody.trim() });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message || 'Could not add this note.');
      return;
    }
    setAddVisible(false);
    setNoteTitle('');
    setNoteBody('');
    fetchNotes().catch(error => Alert.alert('Could not refresh notes', error.message));
    } catch (error) {
      Alert.alert('Could not save', error.message || 'Please try again.');
    } finally { setLoading(false); }
  };

  const handleTogglePin = async (note) => {
    const { error } = await supabase.from('care_notes').update({ pinned: !note.pinned }).eq('id', note.id);
    if (error) Alert.alert('Error', error.message || 'Could not update this note.');
    else fetchNotes().catch(error => Alert.alert('Could not refresh notes', error.message));
  };

  return (
    <>
      {!!loadError && <Text style={{ color: '#C0392B', marginBottom: s(10) }}>{loadError}</Text>}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(12) }}>
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY }}>Care Notes</Text>
        {canEdit && <TouchableOpacity onPress={() => setAddVisible(true)}>
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>+ Add</Text>
        </TouchableOpacity>}
      </View>
      {notes.length === 0 ? (
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>No notes yet</Text>
      ) : (
        notes.map((note) => (
          <TouchableOpacity key={note.id} onLongPress={() => canEdit && handleTogglePin(note)} style={{ backgroundColor: note.pinned ? '#FFF8E1' : '#F5F5F5', padding: s(14), borderRadius: 8, marginBottom: s(8), borderLeftWidth: note.pinned ? 3 : 0, borderLeftColor: NAVY }}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(15), color: NAVY }}>{note.pinned ? '📌 ' : ''}{note.title}</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: '#333', marginTop: s(4) }}>{note.body}</Text>
          </TouchableOpacity>
        ))
      )}
      <Modal onRequestClose={() => { if (loading) return; setAddVisible(false); }} visible={addVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: WHITE, borderRadius: 12, padding: s(24), width: '85%' }}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>Add Note</Text>
            <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="Title" placeholderTextColor={PLACEHOLDER} value={noteTitle} onChangeText={setNoteTitle} />
            <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, height: s(100), textAlignVertical: 'top', marginBottom: s(16) }} placeholder="Note" placeholderTextColor={PLACEHOLDER} value={noteBody} onChangeText={setNoteBody} multiline />
                  <Button title={loading ? 'Adding' : 'Add'} onPress={handleAdd} disabled={!noteTitle.trim() || !noteBody.trim() || loading} loading={loading} style={{ marginBottom: s(8) }} />
            <Button title="Cancel" onPress={() => { setAddVisible(false); setNoteTitle(''); setNoteBody(''); }} style={{ backgroundColor: '#999' }} />
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function VitalsTab({ patientId }) {
  const { width } = useWindowDimensions();
  const s = (size) => Math.round(size * Math.min(1.08, Math.max(0.95, width / 375)));
  const [vitals, setVitals] = useState([]);

  const fetchVitals = async () => {
    const { data, error } = await supabase.from('vital_signs').select('*').eq('patient_id', patientId).order('logged_at', { ascending: false }).limit(20);
    if (error) throw error;
    setVitals(data || []);
  };

  const loadError = useTabLoader(fetchVitals, patientId);

  const getTypeIcon = (type) => ({ blood_pressure: '❤️', blood_sugar: '🩸', weight: '⚖️', temperature: '🌡️', heart_rate: '💓', oxygen: '💨' }[type] || '📊');
  const getTypeLabel = (type) => ({ blood_pressure: 'Blood Pressure', blood_sugar: 'Blood Sugar', weight: 'Weight', temperature: 'Temperature', heart_rate: 'Heart Rate', oxygen: 'Oxygen' }[type] || type);

  return (
    <>
      {!!loadError && <Text style={{ color: '#C0392B', marginBottom: s(10) }}>{loadError}</Text>}
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

function AppointmentsTab({ patientId, navigation, canEdit }) {
  const { width } = useWindowDimensions();
  const s = (size) => Math.round(size * Math.min(1.08, Math.max(0.95, width / 375)));
  const [appointments, setAppointments] = useState([]);

  const fetchAppts = async () => {
    const { data, error } = await supabase.from('appointments').select('*').eq('patient_id', patientId).order('appointment_time', { ascending: true });
    if (error) throw error;
    setAppointments(data || []);
  };

  const loadError = useTabLoader(fetchAppts, patientId);

  const now = new Date();
  const upcoming = appointments.filter((a) => new Date(a.appointment_time) >= now && !a.completed);

  return (
    <>
      {!!loadError && <Text style={{ color: '#C0392B', marginBottom: s(10) }}>{loadError}</Text>}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(12) }}><Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY }}>Upcoming Appointments</Text><TouchableOpacity onPress={() => navigation.navigate('Appointments', { patientId, isPatient: !canEdit })}><Text style={{ color: NAVY, fontFamily: 'DMSans_700Bold' }}>{canEdit ? '+ Add' : 'View all'}</Text></TouchableOpacity></View>
      {upcoming.length === 0 ? (
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>No upcoming appointments</Text>
      ) : (
        upcoming.map((appt) => {
          const dt = new Date(appt.appointment_time);
          return (
            <View key={appt.id} style={{ backgroundColor: SURFACE, padding: s(12), borderRadius: 6, marginBottom: s(8) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>{appt.title}</Text>
              {!!appt.doctor && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#333' }}>Dr. {appt.doctor}</Text>}
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
  const s = (size) => Math.round(size * Math.min(1.08, Math.max(0.95, width / 375)));
  const [moods, setMoods] = useState([]);

  const fetchMoods = async () => {
    const { data, error } = await supabase.from('mood_logs').select('*').eq('patient_id', patientId).order('logged_at', { ascending: false }).limit(14);
    if (error) throw error;
    setMoods(data || []);
  };

  const loadError = useTabLoader(fetchMoods, patientId);

  const getEmoji = (mood) => ({ 1: '🤒', 2: '😢', 3: '😟', 4: '😐', 5: '😊' }[mood] || '😐');

  return (
    <>
      {!!loadError && <Text style={{ color: '#C0392B', marginBottom: s(10) }}>{loadError}</Text>}
      <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY, marginBottom: s(12) }}>Mood History</Text>
      {moods.length === 0 ? (
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>No mood entries yet</Text>
      ) : (
        moods.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', padding: s(10), borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
            <Text style={{ fontSize: s(24), marginRight: s(12) }}>{getEmoji(m.mood)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY }}>{MOODS.find(item => item.value === m.mood)?.label || 'Unknown'}</Text>
              {!!m.note && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#666' }}>{m.note}</Text>}
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
  const s = (size) => Math.round(size * Math.min(1.08, Math.max(0.95, width / 375)));
  const [report, setReport] = useState(null);

  const fetchReport = async () => {
    const now = new Date();
    const { startDay, endDay } = reportWindow(now);

    const { data: medLogs, error: medLogsError } = await supabase.from('medication_log').select('*').eq('patient_id', patientId).gte('log_day', startDay).lt('log_day', endDay);
    const { data: taskComps, error: taskCompsError } = await supabase.from('task_completion').select('*').eq('patient_id', patientId).gte('completion_day', startDay).lt('completion_day', endDay);
    const { data: meds, error: medsError } = await supabase.from('medications').select('id, created_at').eq('patient_id', patientId);
    const { data: medicationSchedules, error: medicationSchedulesError } = await supabase
      .from('medication_schedule')
      .select('*')
      .eq('patient_id', patientId)
      .eq('active', true);
    const { data: tasks, error: tasksError } = await supabase.from('tasks').select('id, days, created_at').eq('patient_id', patientId).eq('active', true);

    const requestError = [medLogsError, taskCompsError, medsError, medicationSchedulesError, tasksError].find(Boolean);
    if (requestError) throw requestError;
    const totals = reportTotals(meds, medicationSchedules, tasks, medLogs, taskComps, now);

    setReport(totals);
  };

  const loadError = useTabLoader(fetchReport, patientId);

  if (!report && loadError) return <Text style={{ color: '#C0392B' }}>{loadError}</Text>;
  if (!report) return <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>Loading...</Text>;

  const medRate = report.totalMedSlots > 0 ? Math.round((report.medTaken / report.totalMedSlots) * 100) : 0;
  const taskRate = report.totalTaskSlots > 0 ? Math.round((report.taskDone / report.totalTaskSlots) * 100) : 0;

  return (
    <>
      {!!loadError && <Text style={{ color: '#C0392B', marginBottom: s(10) }}>{loadError}</Text>}
      <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY, marginBottom: s(12) }}>Weekly Report</Text>

      <View style={{ backgroundColor: SURFACE, borderRadius: 6, padding: s(14), marginBottom: s(10) }}>
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(15), color: NAVY, marginBottom: s(6) }}>Medications</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: '#333' }}>Taken: {report.medTaken} | Missed: {report.medMissed}</Text>
        <View style={{ height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginTop: s(6), overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${medRate}%`, backgroundColor: medRate >= 80 ? NAVY : medRate >= 50 ? '#FF9800' : '#F44336', borderRadius: 4 }} />
        </View>
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(12), color: NAVY, marginTop: s(4) }}>{medRate}% completion</Text>
      </View>

      <View style={{ backgroundColor: SURFACE, borderRadius: 6, padding: s(14) }}>
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(15), color: NAVY, marginBottom: s(6) }}>Tasks</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: '#333' }}>Done: {report.taskDone} | Missed: {report.taskMissed}</Text>
        <View style={{ height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginTop: s(6), overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${taskRate}%`, backgroundColor: taskRate >= 80 ? NAVY : taskRate >= 50 ? '#FF9800' : '#F44336', borderRadius: 4 }} />
        </View>
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(12), color: NAVY, marginTop: s(4) }}>{taskRate}% completion</Text>
      </View>
    </>
  );
}
