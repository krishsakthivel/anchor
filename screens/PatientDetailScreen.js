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
import { supabase as realSupabase } from '../lib/supabase';
import { useCaregiverTour, TourPrompt } from '../components/CaregiverTour';
import * as Crypto from 'expo-crypto';
import Button from '../components/Button';
import MedicationCard from '../components/MedicationCard';
import { CareCard, CareCardHeader, CareSectionHeader, CareAction, CareBody, CareInset, CareMeta, CareEmpty, CareError } from '../components/CarePlanUI';
import WeekdaySelector from '../components/WeekdaySelector';
const { MEDICATION_DAYS, medicationScheduleError, medicationDaysLabel } = require('../lib/medicationSchedule');
import TimePickerInput from '../components/TimePickerInput';
import { writeLocationTag } from '../lib/nfc';
import { NAVY, WHITE, PLACEHOLDER, SURFACE, BORDER, MUTED, WARNING, DANGER } from '../theme/colors';
import { displayTime, planLabels } from '../lib/dailyPlan';
const { localDateKey } = require('../lib/localDate');
const { activePlanEntries, removePlanActivity } = require('../lib/planActivities');

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TABS = ['Medications', 'Tasks', 'Schedule', 'Notes', 'Vitals', 'Appointments', 'Mood', 'Report'];
const REPORT_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export default function PatientDetailScreen({ route, navigation }) {
  const tour = useCaregiverTour();
  const supabase = tour.client || realSupabase;
  const { patientId, patientName, canEdit = true, initialTab = 'Medications' } = route.params;
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState(initialTab);
  const tourTabs = React.useRef(null);
  const tabPositions = React.useRef({});
  const revealTourTab = () => { if (tour.active) tourTabs.current?.scrollTo({ x: tabPositions.current[initialTab] || 0, animated: false }); };
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
  const [editingMedication, setEditingMedication] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [medError, setMedError] = useState('');
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
  const [pillMedication, setPillMedication] = useState(null);
  const [pillCount, setPillCount] = useState('');
  const [pillError, setPillError] = useState('');

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


  const selectMedicationSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setMedTime(schedule?.time ? String(schedule.time).slice(0, 5) : '');
    setMedDays(schedule ? MEDICATION_DAYS.filter(day => normalizeDays(schedule.days).includes(day)) : [...MEDICATION_DAYS]);
  };

  const openMedication = (med = null) => {
    if (!canEdit || loading || loggingId) return;
    setEditingMedication(med);
    setMedName(med?.name || '');
    setMedDosage(med?.dosage || '');
    setMedInstructions(med?.instructions || '');
    setMedTotalPills(med?.total_pills == null ? '' : String(med.total_pills));
    setMedPillsRemaining(med?.pills_remaining == null ? '' : String(med.pills_remaining));
    selectMedicationSchedule(med ? schedules.find(schedule => schedule.medication_id === med.id) : null);
    setMedError('');
    setAddMedVisible(true);
  };

  const handleAddMedication = async () => {
    if (!medName.trim() || loading || !canEdit) return;
    const scheduleValidation = medicationScheduleError(medDays, medTime);
    if (scheduleValidation) { setMedError(scheduleValidation); return; }
    if (editingSchedule && !medTime.trim()) { setMedError('Choose a time for this dose.'); return; }
    const totalPills = medTotalPills.trim() === '' ? null : Number(medTotalPills);
    const pillsRemaining = medPillsRemaining.trim() === '' ? null : Number(medPillsRemaining);
    if ((totalPills !== null && (!Number.isInteger(totalPills) || totalPills < 0))
      || (pillsRemaining !== null && (!Number.isInteger(pillsRemaining) || pillsRemaining < 0))
      || (totalPills !== null && pillsRemaining !== null && pillsRemaining > totalPills)) {
      setMedError('Use whole, non-negative pill counts. Remaining pills cannot exceed the total.');
      return;
    }
    setLoading(true);
    setMedError('');
    try {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setMedError('Your session has expired. Please sign in again.');
      return;
    }

    const enteredTime = medTime.trim();
    if (enteredTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(enteredTime)) {
      setLoading(false);
      setMedError('Choose a valid medicine time.');
      return;
    }

    const values = { name: medName.trim(), dosage: medDosage.trim() || null, instructions: medInstructions.trim() || null };
    if (!editingMedication || totalPills !== editingMedication.total_pills) values.total_pills = totalPills;
    if (!editingMedication || pillsRemaining !== editingMedication.pills_remaining) values.pills_remaining = pillsRemaining;
    const { data: med, error } = editingMedication
      ? await supabase.from('medications').update(values).eq('id', editingMedication.id).eq('patient_id', patientId).select().single()
      : await supabase.from('medications').insert({ patient_id: patientId, created_by: user.id, ...values }).select().single();

    if (error) {
      setLoading(false);
      setMedError(error.message || 'Could not save medication. Please try again.');
      return;
    }

    if (enteredTime) {
      const scheduleValues = { time: enteredTime, frequency: medDays.length === 7 ? 'daily' : 'weekly', days: MEDICATION_DAYS.filter(day => medDays.includes(day)) };
      const { error: scheduleError } = editingSchedule
        ? await supabase.from('medication_schedule').update(scheduleValues).eq('id', editingSchedule.id).eq('medication_id', med.id).eq('patient_id', patientId).select('id').single()
        : await supabase.from('medication_schedule').insert({ medication_id: med.id, patient_id: patientId, ...scheduleValues });

      if (scheduleError) {
        if (!editingMedication) {
          const { error: rollbackError } = await supabase.from('medications').delete().eq('id', med.id);
          if (rollbackError) console.error('medication rollback failed', rollbackError);
        }
        setLoading(false);
        setMedError((editingMedication ? 'Medication details saved, but the schedule failed. Retry saving: ' : '') + (scheduleError.message || 'The medicine schedule could not be saved.'));
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
      setMedError(error.message || 'Could not save. Please try again.');
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

  const handleUpdatePills = (med) => {
    if (!canEdit || loading) return;
    setPillMedication(med);
    setPillCount(med.pills_remaining == null ? '' : String(med.pills_remaining));
    setPillError('');
  };

  const savePillCount = async () => {
    if (!pillMedication || !canEdit || loading) return;
    const count = Number(pillCount.trim());
    if (!/^\d+$/.test(pillCount.trim()) || !Number.isSafeInteger(count) || count > 2147483647 || (pillMedication.total_pills != null && count > pillMedication.total_pills)) {
      setPillError('Enter a whole number from 0 to ' + (pillMedication.total_pills ?? 2147483647) + '.');
      return;
    }
    setLoading(true);
    setPillError('');
    try {
      const { error } = await supabase.from('medications').update({ pills_remaining: count }).eq('id', pillMedication.id).eq('patient_id', patientId).select('id').single();
      if (error) throw error;
      setPillMedication(null);
      await fetchData();
    } catch (error) { setPillError(error.message || 'Could not update the pill count. Please try again.'); }
    finally { setLoading(false); }
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'Medications':
        return (
          <>
            <CareError message={actionError} scale={s} />
            <CareSectionHeader title="Medications" action={canEdit ? '+ Add' : null} onPress={() => openMedication()} scale={s} />
            {medications.length === 0 ? (
              <CareEmpty title="No medications added yet" icon="medical-outline" detail="Medications and their schedules will appear here." scale={s} />
            ) : (
              medications.map(med => <MedicationCard key={med.id}
                medication={med}
                schedules={schedules.filter(schedule => schedule.medication_id === med.id)}
                logs={medLogs} canEdit={canEdit} busy={!!loggingId || loading} scale={s}
                onEdit={() => openMedication(med)}
                onRecord={(schedule, status) => logMedicine(med, schedule, status)}
                onUpdatePills={() => handleUpdatePills(med)}
                onDelete={() => handleDeleteMed(med.id)} />)
            )}
          </>
        );

      case 'Tasks':
        return (
          <>
            <CareSectionHeader title="Tasks" action={canEdit ? '+ Add' : null} onPress={() => openTaskForm()} scale={s} />
            {tasks.length === 0 ? <CareEmpty title="No tasks added yet" icon="checkbox-outline" detail="Daily routines and reminders will appear here." scale={s} /> : tasks.map(task => (
              <CareCard key={task.id} scale={s}>
                <CareCardHeader title={task.title} icon="checkbox-outline" scale={s} action={canEdit && <CareAction label="Edit" accessibilityLabel={'Edit ' + task.title} onPress={() => openTaskForm(task)} disabled={loading} scale={s} />} />
                {!!task.description && <CareBody scale={s}>{task.description}</CareBody>}
                <CareInset scale={s}><CareMeta title={task.time ? displayTime(String(task.time).slice(0, 5)) : 'Any time'} detail={task.days == null ? 'Every day' : medicationDaysLabel(task.days)} scale={s} /></CareInset>
                {canEdit && <View style={{ alignItems: 'flex-end', marginTop: s(6) }}><CareAction label="Delete task" onPress={() => handleDeleteTask(task.id)} disabled={loading} scale={s} /></View>}
              </CareCard>
            ))}
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

        <ScrollView ref={tourTabs} onContentSizeChange={revealTourTab} horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: s(12) }}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              onLayout={event => { tabPositions.current[tab] = event.nativeEvent.layout.x; if (tab === initialTab) revealTourTab(); }}
              onPress={() => setActiveTab(tab)}
              style={{
                ...tour.highlight(`tab-${tab}`),
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
                  <TourPrompt /><Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>{editingMedication ? 'Edit Medication' : 'Add Medication'}</Text>
                  <CareError message={medError} scale={s} />
                  {editingMedication && schedules.filter(schedule => schedule.medication_id === editingMedication.id).length > 1 && <View style={{ marginBottom: s(12) }}><CareBody scale={s}>Choose the dose time to edit. Other dose times stay unchanged.</CareBody><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{schedules.filter(schedule => schedule.medication_id === editingMedication.id).map(schedule => <TouchableOpacity key={schedule.id} onPress={() => selectMedicationSchedule(schedule)} disabled={loading} accessibilityRole="button" accessibilityState={{ selected: editingSchedule?.id === schedule.id }} style={{ padding: s(10), marginRight: s(6), marginBottom: s(6), borderRadius: 8, backgroundColor: editingSchedule?.id === schedule.id ? NAVY : SURFACE }}><Text style={{ color: editingSchedule?.id === schedule.id ? WHITE : NAVY }}>{displayTime(String(schedule.time).slice(0, 5))}</Text></TouchableOpacity>)}</View></View>}

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Name *</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="e.g. Aspirin" placeholderTextColor={PLACEHOLDER} value={medName} onChangeText={setMedName} />

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Dosage</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="e.g. 100mg" placeholderTextColor={PLACEHOLDER} value={medDosage} onChangeText={setMedDosage} />

                  <WeekdaySelector value={medDays} onChange={setMedDays} disabled={loading} />
                  <TimePickerInput label={!editingSchedule && medDays.length === 7 ? 'Medicine time (optional)' : 'Medicine time *'} value={medTime} onChange={setMedTime} optional={!editingSchedule && medDays.length === 7} />
                  {medDays.length > 0 && medDays.length < 7 && !medTime && <Text style={{ color: NAVY, fontFamily: 'DMSans_400Regular', fontSize: s(12), marginBottom: s(12) }}>Choose a time for the selected days.</Text>}

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Instructions</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="e.g. Take with food" placeholderTextColor={PLACEHOLDER} value={medInstructions} onChangeText={setMedInstructions} />

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Total Pills</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="e.g. 30" placeholderTextColor={PLACEHOLDER} value={medTotalPills} onChangeText={setMedTotalPills} keyboardType="numeric" />

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Pills Remaining</Text>
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(16) }} placeholder="e.g. 25" placeholderTextColor={PLACEHOLDER} value={medPillsRemaining} onChangeText={setMedPillsRemaining} keyboardType="numeric" />

                  <Button title={editingMedication ? 'Save changes' : 'Add Medication'} onPress={handleAddMedication} disabled={!medName.trim() || loading || !!medicationScheduleError(medDays, medTime) || (!!editingSchedule && !medTime)} loading={loading} style={{ marginBottom: s(8) }} />
                  <Button title="Cancel" disabled={loading} onPress={() => { setAddMedVisible(false); setMedName(''); setMedDosage(''); setMedTime(''); setMedDays([...MEDICATION_DAYS]); setMedInstructions(''); setMedTotalPills(''); setMedPillsRemaining(''); }} style={{ backgroundColor: '#999' }} />
                </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </Modal>

            <Modal visible={!!pillMedication} transparent animationType="slide" onRequestClose={() => { if (!loading) setPillMedication(null); }}>
              <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: s(20), backgroundColor: 'rgba(0,0,0,0.5)' }}>
                  <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, maxHeight: '90%', width: '100%', maxWidth: 440, backgroundColor: WHITE, borderRadius: 12 }} contentContainerStyle={{ padding: s(24) }}>
                    <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(8) }}>Update pill count</Text>
                    <CareBody scale={s}>{pillMedication?.name}{pillMedication?.total_pills != null ? ` · ${pillMedication.total_pills} total pills` : ''}</CareBody>
                    <CareError message={pillError} scale={s} />
                    <Text style={{ fontFamily: 'DMSans_500Medium', color: NAVY, marginBottom: s(6) }}>Pills remaining</Text>
                    <TextInput accessibilityLabel="Pills remaining" value={pillCount} onChangeText={value => { setPillCount(value); setPillError(''); }} editable={!loading} keyboardType="number-pad" style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: s(12), fontSize: s(18), color: NAVY, marginBottom: s(12) }} />
                    {pillMedication?.total_pills != null && <CareAction label="Refill to full" onPress={() => { setPillCount(String(pillMedication.total_pills)); setPillError(''); }} disabled={loading} scale={s} />}
                    <Button title="Save count" onPress={savePillCount} disabled={loading || !pillCount.trim()} loading={loading} style={{ marginBottom: s(8), marginTop: s(8) }} />
                    <Button title="Cancel" onPress={() => setPillMedication(null)} disabled={loading} style={{ backgroundColor: MUTED }} />
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </Modal>
            <Modal onRequestClose={closeTaskForm} visible={addTaskVisible} animationType="slide" transparent>
              <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: s(24) }} keyboardShouldPersistTaps="handled">
                <View style={{ backgroundColor: WHITE, borderRadius: 12, padding: s(24), width: '85%' }}>
                  <TourPrompt /><Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>{editingTask ? 'Edit Task' : 'Add Task'}</Text>

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
  const tour = useCaregiverTour();
  const supabase = tour.client || realSupabase;
  const { width } = useWindowDimensions();
  const s = (size) => Math.round(size * Math.min(1.08, Math.max(0.95, width / 375)));
  const [plan, setPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [places, setPlaces] = useState([]);
  const [placeName, setPlaceName] = useState('');
  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [checkins, setCheckins] = useState([]);
  const [editingBlock, setEditingBlock] = useState(null);
  const [blockTitle, setBlockTitle] = useState('');
  const [blockTime, setBlockTime] = useState('');
  const [blockMinutes, setBlockMinutes] = useState('');
  const [editError, setEditError] = useState('');
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const editSaving = React.useRef(false);

  const openBlockEditor = (block = { minutes: 30 }, index = null) => {
    if (!canEdit || saving || (index !== null && !plan)) return;
    setEditingBlock({ index, planId: plan?.id, date: plan?.plan_date || localDateKey(new Date()), original: JSON.stringify(block) });
    setBlockTitle(index === null ? '' : block.title || planLabels[block.type] || 'Activity');
    setBlockTime(String(block.start || '').slice(0, 5));
    setBlockMinutes(String(block.minutes ?? 0));
    setEditError('');
    setConfirmingRemoval(false);
  };

  const closeBlockEditor = () => {
    if (editSaving.current) return;
    setEditingBlock(null);
    setEditError('');
    setConfirmingRemoval(false);
  };

  const saveBlock = async (remove = false) => {
    if (!canEdit || !editingBlock || editSaving.current || saving) return;
    const removing = remove === true;
    const adding = editingBlock.index === null;
    const title = blockTitle.trim();
    const minutes = Number(blockMinutes.trim());
    if (!removing && !title) { setEditError('Enter an activity name.'); return; }
    if (!removing && !/^([01]\d|2[0-3]):[0-5]\d$/.test(blockTime)) { setEditError('Choose a valid start time.'); return; }
    if (!removing && (!/^\d+$/.test(blockMinutes.trim()) || !Number.isInteger(minutes) || minutes > 1440)) { setEditError('Enter a duration from 0 to 1440 whole minutes.'); return; }
    editSaving.current = true;
    setSaving(true);
    setEditError('');
    try {
      if (editingBlock.date !== localDateKey(new Date())) throw new Error('This schedule is from a previous day. Close the editor and refresh the schedule.');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Please sign in again before editing the schedule.');
      const { data: latest, error: readError } = await supabase.from('daily_plans').select('*').eq('patient_id', patientId).eq('plan_date', editingBlock.date).maybeSingle();
      if (readError) throw readError;
      if (!adding && (!latest || latest.id !== editingBlock.planId || JSON.stringify(latest.blocks?.[editingBlock.index]) !== editingBlock.original)) throw new Error('This activity changed while you were editing. Close the editor, refresh, and try again.');
      const blocks = adding ? [...(latest?.blocks || []), { type: 'activity', title, start: blockTime, minutes }] : removing ? removePlanActivity(latest.blocks, editingBlock.index) : latest.blocks.map((block, index) => index === editingBlock.index ? { ...block, title, start: blockTime, minutes } : block);
      const values = { blocks, overridden_by: user.id, updated_at: new Date().toISOString() };
      let request = latest
        ? supabase.from('daily_plans').update(values).eq('id', latest.id).eq('patient_id', patientId).eq('plan_date', editingBlock.date)
        : supabase.from('daily_plans').insert({ patient_id: patientId, plan_date: editingBlock.date, ...values });
      if (latest?.updated_at) request = request.eq('updated_at', latest.updated_at);
      const { data, error } = await request.select().single();
      if (error) throw error;
      if (!data) throw new Error('The schedule changed or could not be saved. Refresh and try again.');
      setPlan(data);
      setEditingBlock(null);
    } catch (error) {
      setEditError(error.message || 'Could not save this activity. Please try again.');
    } finally {
      editSaving.current = false;
      setSaving(false);
    }
  };

  const confirmRemoveBlock = () => {
    if (!canEdit || !editingBlock || saving) return;
    setEditError('');
    setConfirmingRemoval(true);
  };

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
      if (tour.active) { setPlaceError('Sticker writing is disabled in practice. Use an installed app and a physical sticker later.'); return; }
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
      <CareError message={loadError || placeError} scale={s} />
      <CareSectionHeader title="Today's schedule" action={canEdit ? '+ Add' : null} onPress={() => openBlockEditor()} scale={s} />
      {!plan ? <CareEmpty title="No schedule yet" icon="calendar-outline" detail={canEdit ? 'Add an activity, or let the patient build a plan from their morning check-in.' : "The patient can build today's plan from their morning check-in."} scale={s} /> : <CareBody scale={s}>{plan.overridden_by ? 'Adjusted by caregiver' : 'Built from the morning check-in'}</CareBody>}
      <View style={{ alignItems: 'flex-start', marginBottom: s(8) }}><CareAction label="Refresh schedule and check-ins" onPress={async () => { try { await fetchPlan(); await fetchPlaces(); setPlaceError(''); } catch (error) { setPlaceError(error.message || 'Could not refresh.'); } }} scale={s} /></View>
      {!!plan && activePlanEntries(plan.blocks || []).length === 0 && <CareEmpty title="No activities scheduled" icon="calendar-outline" detail="There are no activities left on today's schedule." scale={s} />}
      {activePlanEntries(plan?.blocks || []).map(({ block, index }) => {
        const checkin = checkins.find(item => item.block_index === index);
        return <CareCard key={`${block.start}-${index}`} scale={s}>
          <CareCardHeader title={block.title || planLabels[block.type] || 'Activity'} subtitle={`${block.minutes} minutes`} icon={block.type === 'medicine' ? 'medical-outline' : 'calendar-outline'} scale={s} action={canEdit && <CareAction label="Edit" accessibilityLabel={'Edit schedule activity ' + (block.title || planLabels[block.type] || 'Activity')} disabled={saving} onPress={() => openBlockEditor(block, index)} scale={s} />} />
          <CareInset scale={s}>
            <CareMeta title={displayTime(block.start)} detail={block.location_name || 'No place assigned'} scale={s} />
            {!!checkin && <CareMeta icon="checkmark-circle-outline" title={'Arrived at ' + new Date(checkin.checked_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} scale={s} />}
          </CareInset>
          {canEdit && block.type !== 'medicine' && !checkin && places.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: s(12) }}>
            {[null, ...places].map(place => <TouchableOpacity key={place?.id || 'none'} disabled={saving} accessibilityRole="button" accessibilityState={{ selected: block.location_id === (place?.id || null) }} onPress={() => assignPlace(index, place)} style={{ backgroundColor: block.location_id === (place?.id || null) ? NAVY : SURFACE, borderRadius: 20, minHeight: s(44), justifyContent: 'center', paddingHorizontal: s(12), marginRight: s(6) }}><Text style={{ fontFamily: 'DMSans_500Medium', color: block.location_id === (place?.id || null) ? WHITE : NAVY, fontSize: s(12) }}>{place?.name || 'No place'}</Text></TouchableOpacity>)}
          </ScrollView>}
          {canEdit && <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: s(6) }}><CareAction label="−" accessibilityLabel={'Shorten ' + (block.title || planLabels[block.type] || 'activity') + ' by 15 minutes'} disabled={saving} onPress={() => adjustBlock(index, -15)} scale={s} /><CareAction label="+" accessibilityLabel={'Extend ' + (block.title || planLabels[block.type] || 'activity') + ' by 15 minutes'} disabled={saving} onPress={() => adjustBlock(index, 15)} scale={s} /></View>}
        </CareCard>;
      })}
      {canEdit && <CareCard scale={s}>
        <CareCardHeader title="Places & NFC stickers" icon="location-outline" scale={s} />
        <CareBody scale={s}>Add a place, write its sticker, then select that place for an activity above.</CareBody>
        <TextInput value={placeName} onChangeText={setPlaceName} placeholder="e.g. Game room" accessibilityLabel="Place name" placeholderTextColor={PLACEHOLDER} maxLength={80} style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: s(12), backgroundColor: WHITE, color: NAVY, marginBottom: s(10) }} />
        <Button title="Add place" onPress={addPlace} disabled={!placeName.trim() || placeBusy} style={{ marginBottom: s(10) }} />
        {places.map(place => <View key={place.id} style={{ paddingVertical: s(8), borderTopWidth: 1, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', gap: s(8) }}><Text style={{ flex: 1, color: NAVY, fontFamily: 'DMSans_500Medium' }}>{place.name}</Text><CareAction label="Write sticker" accessibilityLabel={'Write sticker for ' + place.name} disabled={placeBusy} onPress={() => programSticker(place)} scale={s} /></View>)}
      </CareCard>}
      <Modal visible={editingBlock !== null} transparent animationType="slide" onRequestClose={closeBlockEditor}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: s(16), backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, maxHeight: '90%', width: '100%', maxWidth: 480, backgroundColor: WHITE, borderRadius: 12 }} contentContainerStyle={{ padding: s(20) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(8) }}>{editingBlock?.index === null ? 'Add schedule activity' : 'Edit schedule activity'}</Text>
              <CareBody scale={s}>Changes apply to today's schedule only. Other activities keep their times.</CareBody>
              {plan?.blocks?.[editingBlock?.index]?.type === 'medicine' && <CareBody scale={s}>This changes the schedule activity only. Medication dose times and reminders stay the same.</CareBody>}
              <TourPrompt /><CareError message={editError} scale={s} />
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Activity name</Text>
              <TextInput accessibilityLabel="Activity name" value={blockTitle} onChangeText={setBlockTitle} editable={!saving} maxLength={120} style={{ fontFamily: 'DMSans_400Regular', fontSize: s(16), color: NAVY, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: s(12), marginBottom: s(12) }} />
              <TimePickerInput key={editingBlock ? `${editingBlock.planId}-${editingBlock.index}` : 'closed'} label="Start time" value={blockTime} onChange={setBlockTime} />
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Duration (minutes)</Text>
              <TextInput accessibilityLabel="Duration in minutes" value={blockMinutes} onChangeText={setBlockMinutes} editable={!saving} keyboardType="number-pad" maxLength={4} style={{ fontFamily: 'DMSans_400Regular', fontSize: s(16), color: NAVY, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: s(12), marginBottom: s(16) }} />
              {confirmingRemoval ? <CareInset scale={s}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY }}>Delete this activity?</Text>
                <CareBody scale={s}>This removes the activity from today's schedule for you and the patient.</CareBody>
                <Button title="Delete activity" onPress={() => saveBlock(true)} disabled={saving} loading={saving} style={{ backgroundColor: DANGER, marginBottom: s(8) }} />
                <Button title="Keep activity" onPress={() => setConfirmingRemoval(false)} disabled={saving} style={{ backgroundColor: MUTED }} />
              </CareInset> : <>
                <Button title={editingBlock?.index === null ? 'Add activity' : 'Save changes'} onPress={saveBlock} loading={saving} disabled={saving || !blockTitle.trim() || !blockTime || !blockMinutes.trim()} style={{ marginBottom: s(8) }} />
                <Button title="Cancel" onPress={closeBlockEditor} disabled={saving} style={{ backgroundColor: MUTED }} />
                {editingBlock?.index !== null && <Button title="Delete activity" onPress={confirmRemoveBlock} disabled={saving} style={{ backgroundColor: WHITE, borderWidth: 1, borderColor: DANGER, marginTop: s(16) }} textStyle={{ color: DANGER }} />}
              </>}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function CareNotesTab({ patientId, canEdit }) {
  const tour = useCaregiverTour();
  const supabase = tour.client || realSupabase;
  const { width } = useWindowDimensions();
  const s = (size) => Math.round(size * Math.min(1.08, Math.max(0.95, width / 375)));
  const [notes, setNotes] = useState([]);
  const [addVisible, setAddVisible] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteError, setNoteError] = useState('');

  const openNote = (note = null) => {
    if (!canEdit || loading) return;
    setEditingNote(note);
    setNoteTitle(note?.title || '');
    setNoteBody(note?.body || '');
    setNoteError('');
    setAddVisible(true);
  };

  const fetchNotes = async () => {
    const { data, error } = await supabase.from('care_notes').select('*').eq('patient_id', patientId).order('pinned', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    setNotes(data || []);
  };

  const loadError = useTabLoader(fetchNotes, patientId);

  const handleAdd = async () => {
    if (!canEdit || loading || !noteTitle.trim() || !noteBody.trim()) return;
    setLoading(true);
    setNoteError('');
    try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Your session has expired. Please sign in again.');
    const values = { title: noteTitle.trim(), body: noteBody.trim() };
    const { error } = editingNote
      ? await supabase.from('care_notes').update(values).eq('id', editingNote.id).eq('patient_id', patientId).select('id').single()
      : await supabase.from('care_notes').insert({ patient_id: patientId, created_by: user.id, ...values });
    if (error) throw error;
    setAddVisible(false);
    setNoteTitle('');
    setNoteBody('');
    fetchNotes().catch(error => Alert.alert('Could not refresh notes', error.message));
    } catch (error) {
      setNoteError(error.message || 'Could not save the note. Please try again.');
    } finally { setLoading(false); }
  };

  const handleTogglePin = async (note) => {
    const { error } = await supabase.from('care_notes').update({ pinned: !note.pinned }).eq('id', note.id);
    if (error) Alert.alert('Error', error.message || 'Could not update this note.');
    else fetchNotes().catch(error => Alert.alert('Could not refresh notes', error.message));
  };

  const handleDeleteNote = (note) => {
    if (!canEdit || loading) return;
    Alert.alert('Delete note?', `Delete "${note.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase.from('care_notes').delete().eq('id', note.id).eq('patient_id', patientId).select('id').single();
          if (error) throw error;
          if (!data) throw new Error('This note could not be deleted. Refresh and try again.');
          setNotes(current => current.filter(item => item.id !== note.id));
        } catch (error) {
          Alert.alert('Could not delete note', error.message || 'Please try again.');
        } finally { setLoading(false); }
      } },
    ]);
  };

  return (
    <>
      <CareError message={loadError} scale={s} />
      <CareSectionHeader title="Care Notes" action={canEdit ? '+ Add' : null} onPress={() => openNote()} scale={s} />
      {notes.length === 0 ? <CareEmpty title="No notes yet" icon="document-text-outline" detail="Care instructions and updates will appear here." scale={s} /> : notes.map(note => (
        <CareCard key={note.id} scale={s}>
          <CareCardHeader title={note.title} subtitle={note.pinned ? 'Pinned note' : 'Care note'} icon={note.pinned ? 'pin-outline' : 'document-text-outline'} scale={s} action={canEdit && <CareAction label={note.pinned ? 'Unpin' : 'Pin'} accessibilityLabel={(note.pinned ? 'Unpin ' : 'Pin ') + note.title} onPress={() => handleTogglePin(note)} scale={s} />} />
          <CareInset scale={s}><Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), lineHeight: s(21), color: NAVY }}>{note.body}</Text></CareInset>
          {canEdit && <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: s(6) }}><CareAction label="Edit" accessibilityLabel={'Edit note ' + note.title} onPress={() => openNote(note)} disabled={loading} scale={s} /><CareAction label="Delete" accessibilityLabel={'Delete note ' + note.title} onPress={() => handleDeleteNote(note)} disabled={loading} scale={s} /></View>}
        </CareCard>
      ))}
      <Modal onRequestClose={() => { if (loading) return; setAddVisible(false); }} visible={addVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: s(24) }} keyboardShouldPersistTaps="handled">
          <View style={{ backgroundColor: WHITE, borderRadius: 12, padding: s(24), width: '85%' }}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>{editingNote ? 'Edit Note' : 'Add Note'}</Text>
            <TourPrompt /><CareError message={noteError} scale={s} />
            <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }} placeholder="Title" placeholderTextColor={PLACEHOLDER} value={noteTitle} onChangeText={setNoteTitle} />
            <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, height: s(100), textAlignVertical: 'top', marginBottom: s(16) }} placeholder="Note" placeholderTextColor={PLACEHOLDER} value={noteBody} onChangeText={setNoteBody} multiline />
                  <Button title={editingNote ? 'Save changes' : 'Add'} onPress={handleAdd} disabled={!noteTitle.trim() || !noteBody.trim() || loading} loading={loading} style={{ marginBottom: s(8) }} />
            <Button title="Cancel" disabled={loading} onPress={() => { setAddVisible(false); setNoteTitle(''); setNoteBody(''); }} style={{ backgroundColor: '#999' }} />
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function VitalsTab({ patientId }) {
  const tour = useCaregiverTour();
  const supabase = tour.client || realSupabase;
  const { width } = useWindowDimensions();
  const s = (size) => Math.round(size * Math.min(1.08, Math.max(0.95, width / 375)));
  const [vitals, setVitals] = useState([]);

  const fetchVitals = async () => {
    const { data, error } = await supabase.from('vital_signs').select('*').eq('patient_id', patientId).order('logged_at', { ascending: false }).limit(20);
    if (error) throw error;
    setVitals(data || []);
  };

  const loadError = useTabLoader(fetchVitals, patientId);

  const getTypeIcon = (type) => ({ blood_pressure: 'heart-outline', blood_sugar: 'water-outline', weight: 'scale-outline', temperature: 'thermometer-outline', heart_rate: 'pulse-outline', oxygen: 'fitness-outline' }[type] || 'analytics-outline');
  const getTypeLabel = (type) => ({ blood_pressure: 'Blood Pressure', blood_sugar: 'Blood Sugar', weight: 'Weight', temperature: 'Temperature', heart_rate: 'Heart Rate', oxygen: 'Oxygen' }[type] || type);

  return (
    <>
      <CareError message={loadError} scale={s} />
      <CareSectionHeader title="Vitals History" scale={s} />
      {vitals.length === 0 ? <CareEmpty title="No vitals logged yet" icon="pulse-outline" detail="The patient's recorded readings will appear here." scale={s} /> : vitals.map(v => (
        <CareCard key={v.id} scale={s}>
          <CareCardHeader title={getTypeLabel(v.type)} icon={getTypeIcon(v.type)} scale={s} />
          <CareInset scale={s}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(24), color: NAVY }}>{v.value} <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: MUTED }}>{v.unit}</Text></Text>
            <CareMeta title={new Date(v.logged_at).toLocaleDateString()} detail={new Date(v.logged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} scale={s} />
          </CareInset>
        </CareCard>
      ))}
    </>
  );
}

function AppointmentsTab({ patientId, navigation, canEdit }) {
  const tour = useCaregiverTour();
  const supabase = tour.client || realSupabase;
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
      <CareError message={loadError} scale={s} />
      <CareSectionHeader title="Upcoming Appointments" action={canEdit ? '+ Add' : 'View all'} onPress={() => navigation.navigate('Appointments', { patientId, isPatient: !canEdit })} scale={s} />
      {upcoming.length === 0 ? <CareEmpty title="No upcoming appointments" icon="calendar-outline" detail="Scheduled visits will appear here." scale={s} /> : upcoming.map(appt => {
        const dt = new Date(appt.appointment_time);
        return <CareCard key={appt.id} scale={s}>
          <CareCardHeader title={appt.title} subtitle={appt.doctor ? 'Dr. ' + appt.doctor : null} icon="calendar-outline" scale={s} />
          <CareInset scale={s}><CareMeta title={dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} detail={dt.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} scale={s} /></CareInset>
        </CareCard>;
      })}
    </>
  );
}

function MoodTab({ patientId }) {
  const tour = useCaregiverTour();
  const supabase = tour.client || realSupabase;
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
      <CareError message={loadError} scale={s} />
      <CareSectionHeader title="Mood History" scale={s} />
      {moods.length === 0 ? <CareEmpty title="No mood entries yet" icon="happy-outline" detail="The patient's mood check-ins will appear here." scale={s} /> : moods.map(m => (
        <CareCard key={m.id} scale={s}>
          <CareCardHeader title={MOODS.find(item => item.value === m.mood)?.label || 'Unknown'} subtitle="Mood check-in" symbol={getEmoji(m.mood)} scale={s} />
          {!!m.note && <CareBody scale={s}>{m.note}</CareBody>}
          <CareInset scale={s}><CareMeta title={new Date(m.logged_at).toLocaleDateString()} detail={new Date(m.logged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} scale={s} /></CareInset>
        </CareCard>
      ))}
    </>
  );
}

function ReportTab({ patientId }) {
  const tour = useCaregiverTour();
  const supabase = tour.client || realSupabase;
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

  if (!report) return <><CareSectionHeader title="Weekly Report" scale={s} />{loadError ? <CareError message={loadError} scale={s} /> : <CareEmpty title="Loading report…" icon="bar-chart-outline" scale={s} />}</>;

  const medRate = report.totalMedSlots > 0 ? Math.round((report.medTaken / report.totalMedSlots) * 100) : 0;
  const taskRate = report.totalTaskSlots > 0 ? Math.round((report.taskDone / report.totalTaskSlots) * 100) : 0;

  return (
    <>
      <CareError message={loadError} scale={s} />
      <CareSectionHeader title="Weekly Report" scale={s} />
      <CareBody scale={s}>Completion over the last seven days</CareBody>
      {[
        { title: 'Medications', icon: 'medical-outline', doneLabel: 'Taken', done: report.medTaken, missed: report.medMissed, rate: medRate },
        { title: 'Tasks', icon: 'checkbox-outline', doneLabel: 'Done', done: report.taskDone, missed: report.taskMissed, rate: taskRate },
      ].map(item => <CareCard key={item.title} scale={s}>
        <CareCardHeader title={item.title} subtitle="Weekly completion" icon={item.icon} scale={s} />
        <CareInset scale={s}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(20) }}>
            <View style={{ flex: 1 }}><Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: MUTED }}>{item.doneLabel}</Text><Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(24), color: NAVY }}>{item.done}</Text></View>
            <View style={{ flex: 1 }}><Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: MUTED }}>Missed</Text><Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(24), color: NAVY }}>{item.missed}</Text></View>
          </View>
          <View accessibilityRole="progressbar" accessibilityLabel={item.title + ' completion'} accessibilityValue={{ min: 0, max: 100, now: item.rate }} style={{ height: s(8), backgroundColor: BORDER, borderRadius: 4, marginTop: s(6), overflow: 'hidden' }}><View style={{ height: '100%', width: `${item.rate}%`, backgroundColor: item.rate >= 80 ? NAVY : item.rate >= 50 ? WARNING : DANGER, borderRadius: 4 }} /></View>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(12), color: NAVY, marginTop: s(4) }}>{item.rate}% completion</Text>
        </CareInset>
      </CareCard>)}
    </>
  );
}
