import { useFocusEffect } from '@react-navigation/native';
const { MOODS, isValidVitalValue } = require('../lib/careValues');
const { medicationLogError } = require('../lib/medicationLogError');
const { activePlanEntries } = require('../lib/planActivities');
import { appAlert as Alert } from '../components/AppDialog';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, FlatList, ScrollView, useWindowDimensions, RefreshControl, TouchableOpacity, Linking, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { dispatchHelpNotification } from '../lib/helpNotifications';
const { getRoutineStatus } = require('../lib/routineStatus');
import { NAVY, WHITE, PLACEHOLDER, MUTED, SURFACE, BORDER, SUCCESS, SUCCESS_BG, WARNING, WARNING_BG, DANGER, DANGER_BG } from '../theme/colors';
import Button from '../components/Button';
import { schedulePatientMedicationReminders, schedulePlanReminders } from '../lib/notifications';
import { buildDailyPlan, displayTime, planLabels } from '../lib/dailyPlan';
import { readLocationTag } from '../lib/nfc';
import { getElderMode } from '../lib/accessibility';
const { localDateKey } = require('../lib/localDate');

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const VITAL_UNITS = {
  blood_pressure: 'mmHg',
  blood_sugar: 'mg/dL',
  weight: 'lbs',
  temperature: '°F',
  heart_rate: 'bpm',
  oxygen: '%',
};

const isDayConfigured = (days, day) => {
  if (Array.isArray(days)) return days.includes(day);
  return typeof days === 'string' && days.includes(day);
};

const formatScheduleTime = (time) => {
  if (!time) return '';
  const [hour = '', minute = ''] = String(time).split(':');
  if (!hour || !minute) return '';
  const hourNumber = Number(hour);
  if (!Number.isFinite(hourNumber)) return '';
  const suffix = hourNumber >= 12 ? 'PM' : 'AM';
  const displayHour = hourNumber % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
};

export default function PatientHomeScreen({ route, navigation }) {
  const { width, height } = useWindowDimensions();
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
  const [dailyPlan, setDailyPlan] = useState(null);
  const [activityCheckins, setActivityCheckins] = useState([]);
  const [checkinError, setCheckinError] = useState('');
  const [scanningBlock, setScanningBlock] = useState(null);
  const [planVisible, setPlanVisible] = useState(false);
  const [planAnswers, setPlanAnswers] = useState({ sleep: '', feeling: '', energy: '', play: '', needsCare: '' });
  const [planSaving, setPlanSaving] = useState(false);
  const [elderMode, setElderMode] = useState(false);
  const [latestSafetyCheckin, setLatestSafetyCheckin] = useState(null);
  const [upcomingAppointment, setUpcomingAppointment] = useState(null);
  const [safetySaving, setSafetySaving] = useState(false);

  const [fetchError, setFetchError] = useState('');
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [claimedPatientId, setClaimedPatientId] = useState(null);
  const pendingMedLogs = useRef(new Set());
  const pendingTaskCompletions = useRef(new Set());
  const promptedPlanDate = useRef(null);
  const loadedDate = useRef(localDateKey(new Date()));
  const latestFetch = useRef(null);
  const dayRefreshInFlight = useRef(false);

  const scale = elderMode
    ? Math.min(1.2, Math.max(1.05, width / 330))
    : Math.min(1.08, Math.max(0.95, width / 375));
  const s = (size) => Math.round(size * scale);
  const planModalHeight = Math.min(height * 0.9, Math.max(s(360), height - s(28)));

  const code = route?.params?.code;
  const routePatientId = route?.params?.patientId;
  const patientId = routePatientId || claimedPatientId;
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
    setCodeInvalid(false);
    try {
      let { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError && !userError.message?.toLowerCase().includes('auth session missing')) throw userError;

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
          return;
        }
        user = anonData.user;
      }

      if (code && !user.is_anonymous) {
        setCodeInvalid(true);
        setFetchError('This device is signed in as a caregiver. Open the welcome screen on the patient’s device to enter the pairing code.');
        return;
      }

      let patientData = null;

      if (patientId) {
        const { data, error } = await supabase.from('patients').select('*').eq('id', patientId).single();
        if (error) throw error;
        patientData = data;
      } else if (code) {
        const { data: claimed, error: claimError } = await supabase.rpc('claim_patient_code', {
          p_code: code.toUpperCase(),
        });

        if (claimError || !claimed) {
          console.error('claim_patient_code failed', claimError);
          setCodeInvalid(true);
          setFetchError(claimError?.message || 'This code is invalid, expired, or has already been used. Ask your caregiver for a new code.');
          return;
        }

        patientData = claimed;
        setClaimedPatientId(claimed.id);
        navigation.setParams({ patientId: claimed.id, code: undefined });
      }

      if (!patientData) {
        setCodeInvalid(true);
        setFetchError('No patient is connected to this session. Enter a pairing code from the welcome screen.');
        return;
      }
      setPatient(patientData);

      const [safetyResult, appointmentResult] = await Promise.all([
        supabase.from('safety_checkins').select('*').eq('patient_id', patientData.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('appointments').select('*').eq('patient_id', patientData.id).eq('completed', false).gte('appointment_time', new Date().toISOString()).order('appointment_time', { ascending: true }).limit(1).maybeSingle(),
      ]);
      if (safetyResult.error) throw safetyResult.error;
      if (appointmentResult.error) throw appointmentResult.error;
      setLatestSafetyCheckin(safetyResult.data || null);
      setUpcomingAppointment(appointmentResult.data || null);

      const { data: schedules, error: schedulesError } = await supabase.from('medication_schedule').select('*').eq('patient_id', patientData.id).eq('active', true);
      if (schedulesError) throw schedulesError;
      const { data: meds, error: medsError } = await supabase.from('medications').select('*').eq('patient_id', patientData.id);
      if (medsError) throw medsError;
    const todayMeds = [];
    (meds || []).forEach((med) => {
      const medSchedules = (schedules || []).filter((schedule) => schedule.medication_id === med.id);
      const dueSchedules = medSchedules.filter((schedule) => isDayConfigured(schedule.days, today));
      if (!medSchedules.length) {
        todayMeds.push({ ...med, schedule_id: null, schedule_time: null, slotKey: `${med.id}:default` });
      } else {
        dueSchedules.forEach((schedule) => {
          todayMeds.push({
            ...med,
            schedule_id: schedule.id,
            schedule_time: schedule.time,
            slotKey: schedule.id,
          });
        });
      }
    });
      setMedications(todayMeds);
      const medicationsById = new Map((meds || []).map((med) => [med.id, med]));
      const reminderEntries = (schedules || []).map((schedule) => ({
        id: schedule.medication_id,
        name: medicationsById.get(schedule.medication_id)?.name || 'Medicine',
        schedule_id: schedule.id,
        schedule_time: String(schedule.time).slice(0, 5),
        days: schedule.days,
      }));
      schedulePatientMedicationReminders(reminderEntries, user.id).catch(() => {});

      const { data: taskData, error: tasksError } = await supabase.from('tasks').select('*').eq('patient_id', patientData.id).eq('active', true);
      if (tasksError) throw tasksError;
      const todayTasks = (taskData || []).filter((t) => !t.days || isDayConfigured(t.days, today));
      setTasks(todayTasks);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

      const { data: logs, error: logsError } = await supabase.from('medication_log').select('*').eq('patient_id', patientData.id).eq('log_day', localDateKey(todayStart));
      if (logsError) throw logsError;
      setMedLogs(logs || []);

      const { data: comps, error: compsError } = await supabase.from('task_completion').select('*').eq('patient_id', patientData.id).eq('completion_day', localDateKey(todayStart));
      if (compsError) throw compsError;
      setTaskCompletions(comps || []);

      const { data: caregiver, error: caregiverError } = await supabase.from('caregiver_phone').select('phone').eq('user_id', patientData.created_by).maybeSingle();
      if (caregiverError) throw caregiverError;
      setCaregiverPhone(caregiver?.phone || '');

      const { data: notes, error: notesError } = await supabase.from('care_notes').select('*').eq('patient_id', patientData.id).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3);
      if (notesError) throw notesError;
      setCareNotes(notes || []);

      const { data: todayMood, error: moodError } = await supabase.from('mood_logs').select('*').eq('patient_id', patientData.id).gte('logged_at', todayStart.toISOString()).order('logged_at', { ascending: false }).limit(1);
      if (moodError) throw moodError;
      setMoodToday(todayMood?.[0] || null);

      const planDate = localDateKey(new Date());
      const { data: plan, error: planError } = await supabase.from('daily_plans').select('*').eq('patient_id', patientData.id).eq('plan_date', planDate).maybeSingle();
      if (planError) throw planError;
      setDailyPlan(plan || null);
      if (plan) schedulePlanReminders(plan.blocks || [], user.id).catch(() => {});
      if (plan) {
        const { data: checkins, error: checkinLoadError } = await supabase.from('activity_checkins').select('id, block_index, checked_at').eq('plan_id', plan.id);
        if (checkinLoadError) setCheckinError('Activity check-ins could not load. Ask your caregiver to check setup.');
        else { setActivityCheckins(checkins || []); setCheckinError(''); }
      } else {
        setActivityCheckins([]);
        setCheckinError('');
      }
      if (!plan && promptedPlanDate.current !== planDate) {
        promptedPlanDate.current = planDate;
        setPlanVisible(true);
      }
      loadedDate.current = planDate;
    } catch (err) {
      console.error('PatientHome fetch failed', err);
      setFetchError(err?.message ? `Could not load your care plan: ${err.message}` : 'Could not load your care plan. Please try again.');
    } finally {
      setLoadingInitial(false);
    }
  };

  latestFetch.current = fetchData;

  useEffect(() => { fetchData(); }, [routePatientId, code, claimedPatientId]);

  useFocusEffect(React.useCallback(() => {
    let active = true;
    getElderMode().then(value => { if (active) setElderMode(value); }).catch(() => {});
    return () => { active = false; };
  }, []));

  useEffect(() => {
    const refreshForNewDay = () => {
      const currentDate = localDateKey(new Date());
      if (currentDate === loadedDate.current || dayRefreshInFlight.current) return;
      dayRefreshInFlight.current = true;
      Promise.resolve(latestFetch.current?.()).finally(() => { dayRefreshInFlight.current = false; });
    };
    const timer = setInterval(refreshForNewDay, 60000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshForNewDay();
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const getMedStatus = (medication) => medLogs.find((log) => (
    log.medication_id === medication.id &&
    (medication.schedule_id ? log.schedule_id === medication.schedule_id : !log.schedule_id)
  ))?.status;
  const getTaskStatus = (taskId) => taskCompletions.find((completion) => completion.task_id === taskId)?.status;

  const handleLogMed = async (medication, status) => {
    if (!patient) return;
    const logKey = `${medication.id}:${medication.schedule_id || 'default'}`;
    const alreadyLogged = medLogs.some((log) => (
      log.medication_id === medication.id &&
      (medication.schedule_id ? log.schedule_id === medication.schedule_id : !log.schedule_id)
    ));
    if (alreadyLogged || pendingMedLogs.current.has(logKey)) return;
    pendingMedLogs.current.add(logKey);
    try {
      const { data: savedLog, error } = await supabase
        .from('medication_log')
        .insert({
          medication_id: medication.id,
          patient_id: patient.id,
          schedule_id: medication.schedule_id || null,
          status,
          log_day: localDateKey(new Date()),
        })
        .select('id')
        .single();
      if (error) {
        console.error('medication_log insert failed', error);
        Alert.alert('Could not save', medicationLogError(error));
        return;
      }
      await fetchData();
      Alert.alert('Medication updated', `${medication.name} was marked ${status}.`, [
        {
          text: 'Undo',
          style: 'destructive',
          onPress: async () => {
            const { error: undoError } = await supabase.from('medication_log').delete().eq('id', savedLog.id);
            if (undoError) Alert.alert('Could not undo', 'Please try again.');
            await fetchData();
          },
        },
        { text: 'Done' },
      ]);
    } catch (err) {
      console.error('handleLogMed failed', err);
      Alert.alert('Could not save', 'Something went wrong. Please try again.');
    } finally {
      pendingMedLogs.current.delete(logKey);
    }
  };

  const handleCompleteTask = async (taskId, status) => {
    if (!patient || taskCompletions.some((completion) => completion.task_id === taskId) || pendingTaskCompletions.current.has(taskId)) return;
    pendingTaskCompletions.current.add(taskId);
    try {
      const { data: savedCompletion, error } = await supabase
        .from('task_completion')
        .insert({ task_id: taskId, patient_id: patient.id, status, completion_day: localDateKey(new Date()) })
        .select('id')
        .single();
      if (error) {
        console.error('task_completion insert failed', error);
        Alert.alert('Could not save', error.message || 'Please try again.');
        return;
      }
      await fetchData();
      const taskName = tasks.find((task) => task.id === taskId)?.title || 'Task';
      Alert.alert('Task updated', `${taskName} was marked ${status === 'completed' ? 'done' : status}.`, [
        {
          text: 'Undo',
          style: 'destructive',
          onPress: async () => {
            const { error: undoError } = await supabase.from('task_completion').delete().eq('id', savedCompletion.id);
            if (undoError) Alert.alert('Could not undo', 'Please try again.');
            await fetchData();
          },
        },
        { text: 'Done' },
      ]);
    } catch (err) {
      console.error('handleCompleteTask failed', err);
      Alert.alert('Could not save', 'Something went wrong. Please try again.');
    } finally {
      pendingTaskCompletions.current.delete(taskId);
    }
  };

  const handleLogMood = async () => {
    if (!selectedMood || moodLoading) return;
    if (!patient) {
      setMoodError('Still loading your info, please wait a moment and try again.');
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

  const saveDailyPlan = async () => {
    if (Object.values(planAnswers).some((answer) => !answer) || !patient || planSaving) return;
    setPlanSaving(true);
    try {
    const blocks = buildDailyPlan(planAnswers, medications);
    const planDate = localDateKey(new Date());
    const { data, error } = await supabase
      .from('daily_plans')
      .upsert({ patient_id: patient.id, plan_date: planDate, answers: planAnswers, blocks }, { onConflict: 'patient_id,plan_date' })
      .select()
      .single();
    setPlanSaving(false);
    if (error) {
      Alert.alert('Could not build today’s schedule', 'Please try again.');
      return;
    }
    setDailyPlan(data);
    schedulePlanReminders(blocks, patient.paired_user_id).catch(() => {});
    setPlanVisible(false);
    } catch (error) {
      Alert.alert('Could not save', error.message || 'Please try again.');
    } finally { setPlanSaving(false); }
  };

  const scanActivitySticker = async (index) => {
    if (!dailyPlan || dailyPlan.blocks[index]?.removed || scanningBlock !== null) return;
    setScanningBlock(index);
    setCheckinError('');
    try {
      const token = await readLocationTag();
      const { data, error } = await supabase.rpc('check_in_activity', {
        p_plan_id: dailyPlan.id, p_block_index: index, p_tag_token: token,
      });
      if (error) throw error;
      setActivityCheckins((current) => [...current, data]);
      Alert.alert('Checked in', `You arrived at ${dailyPlan.blocks[index]?.location_name || 'your activity'}.`);
    } catch (error) {
      setCheckinError(error.message || 'Could not check in. Try scanning the sticker again.');
    } finally {
      setScanningBlock(null);
    }
  };

  const handleLogVital = async () => {
    if (!vitalType || !vitalValue.trim() || vitalLoading) return;
    if (!patient) {
      setVitalError('Still loading your info, please wait a moment and try again.');
      return;
    }
    if (!isValidVitalValue(vitalType, vitalValue)) {
      setVitalError(vitalType === 'blood_pressure' ? 'Enter two positive numbers, such as 120/80.' : 'Enter a positive number for this reading.');
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

  const handleSafetyCheckin = async (status) => {
    if (!patient || safetySaving) return;
    setSafetySaving(true);
    try {
    const { data, error } = await supabase
      .from('safety_checkins')
      .insert({ patient_id: patient.id, status })
      .select()
      .single();
    setSafetySaving(false);
    if (error) {
      Alert.alert('Could not send check-in', 'Please try again or call your caregiver.');
      return;
    }
    setLatestSafetyCheckin(data);
    if (status !== 'okay') dispatchHelpNotification(data.id).catch(() => {});
    if (status === 'urgent') {
      Alert.alert('Urgent help requested', 'Call 911 if you are in immediate danger.', [
        { text: 'Call 911', style: 'destructive', onPress: () => Linking.openURL('tel:911') },
        { text: 'Close', style: 'cancel' },
      ]);
    } else if (status === 'needs_help') {
      Alert.alert('Help request saved', 'Your caregiver can see your request in Anchor. If you need immediate help, call them.');
    } else {
      Alert.alert('Check-in sent', 'Your caregiver can see that you are okay.');
    }
    } catch (error) {
      Alert.alert('Could not save', error.message || 'Please try again.');
    } finally { setSafetySaving(false); }
  };

  const openSafetyCheckin = () => {
    Alert.alert('How are you right now?', 'Choose the option that best fits.', [
      { text: 'I am okay', onPress: () => handleSafetyCheckin('okay') },
      { text: 'I need help', onPress: () => handleSafetyCheckin('needs_help') },
      { text: 'Urgent help', style: 'destructive', onPress: () => handleSafetyCheckin('urgent') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const getMoodEmoji = (mood) => MOODS.find((m) => m.value === mood)?.emoji || '😐';
  const routineItems = [
    ...medications.map((medication) => {
      const status = getMedStatus(medication);
      const routineStatus = getRoutineStatus('medicine', status);
      return {
        key: `med-${medication.slotKey || medication.id}`,
        kind: 'medicine',
        title: medication.name,
        detail: [medication.dosage, medication.instructions].filter(Boolean).join(', '),
        time: medication.schedule_time,
        status,
        ...routineStatus,
        medication,
      };
    }),
    ...tasks.map((task) => {
      const status = getTaskStatus(task.id);
      const routineStatus = getRoutineStatus('task', status);
      return {
        key: `task-${task.id}`,
        kind: 'task',
        title: task.title,
        detail: task.description || '',
        time: task.time,
        status,
        ...routineStatus,
        task,
      };
    }),
  ].sort((a, b) => {
    if (!a.time && !b.time) return a.title.localeCompare(b.title);
    if (!a.time) return 1;
    if (!b.time) return -1;
    return String(a.time).localeCompare(String(b.time));
  });
  const handledRoutineCount = routineItems.filter((item) => item.handled).length;
  const nextRoutineItem = routineItems.find((item) => !item.handled);

  const openRoutineItem = (item) => {
    if (item.handled) return;
    if (item.kind === 'medicine') {
      Alert.alert('Mark Medication', `How did ${item.title} go?`, [
        { text: 'Taken', onPress: () => handleLogMed(item.medication, 'taken') },
        { text: 'Skipped', onPress: () => handleLogMed(item.medication, 'skipped') },
        { text: 'Missed', onPress: () => handleLogMed(item.medication, 'missed') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert('Complete Task', `Mark "${item.title}" as:`, [
      { text: 'Done', onPress: () => handleCompleteTask(item.task.id, 'completed') },
      { text: 'Skipped', onPress: () => handleCompleteTask(item.task.id, 'skipped') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

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
          onPress={() => { if (codeInvalid) navigation.navigate('Landing'); else { setLoadingInitial(true); fetchData(); } }}
          style={{ backgroundColor: NAVY, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8 }}
        >
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 16, color: WHITE }}>{codeInvalid ? 'Enter another code' : 'Try Again'}</Text>
        </TouchableOpacity>
        {!codeInvalid && <TouchableOpacity onPress={() => navigation.navigate('Landing')} style={{ padding: 16 }} accessibilityRole="button">
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 16, color: NAVY }}>Enter another code</Text>
        </TouchableOpacity>}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      <FlatList
        data={[]}
        renderItem={null}
        contentContainerStyle={{ paddingBottom: s(96) }}
        ListHeaderComponent={
        <View style={{ padding: s(22), paddingBottom: s(30) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s(24) }}>
            <Image source={require('../assets/logo.png')} style={{ width: s(34), height: s(34) }} resizeMode="contain" />
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: MUTED, marginLeft: s(8) }}>Today</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: s(24) }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(17), color: MUTED }}>Good {greeting}</Text>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(30), color: NAVY, marginTop: s(2) }}>
                Hi, {patient?.name || 'there'}
              </Text>
            </View>
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

          {upcomingAppointment && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Appointments', { patientId: patient.id, isPatient: true })}
              accessibilityRole="button"
              style={{ backgroundColor: SURFACE, padding: s(18), borderRadius: 6, marginBottom: s(18), flexDirection: 'row', alignItems: 'center' }}
            >
              <Ionicons name="calendar-outline" size={s(28)} color={NAVY} style={{ marginRight: s(12) }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), color: NAVY }}>Next appointment</Text>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(16), color: NAVY, marginTop: s(3) }}>{upcomingAppointment.title}</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(15), color: MUTED, marginTop: s(3) }}>
                  {new Date(upcomingAppointment.appointment_time).toLocaleDateString()} at {new Date(upcomingAppointment.appointment_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
                {!!upcomingAppointment.location && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(15), color: MUTED, marginTop: s(2) }}>{upcomingAppointment.location}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={s(22)} color={NAVY} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setPlanVisible(true)}
            style={{ backgroundColor: dailyPlan ? SUCCESS_BG : SURFACE, padding: s(18), borderRadius: 6, marginBottom: s(18), flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name={dailyPlan ? 'calendar' : 'sparkles-outline'} size={s(28)} color={NAVY} style={{ marginRight: s(12) }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(19), color: NAVY }}>{dailyPlan ? 'Your schedule is ready' : 'Build today’s schedule'}</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(16), color: MUTED, marginTop: s(2) }}>{dailyPlan ? `${activePlanEntries(dailyPlan.blocks || []).length} gentle plans for today` : 'Answer five quick questions'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={s(22)} color={NAVY} />
          </TouchableOpacity>

          {routineItems.length > 0 && (
            <View style={{ marginBottom: s(24) }}>
              <View style={{ backgroundColor: nextRoutineItem ? WARNING_BG : SUCCESS_BG, padding: s(18), borderRadius: 6, marginBottom: s(18) }}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(13), color: MUTED, marginBottom: s(5), textTransform: 'uppercase', letterSpacing: 0.7 }}>
                  {nextRoutineItem ? 'Up next' : 'Today'}
                </Text>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(21), color: NAVY }}>
                  {nextRoutineItem ? nextRoutineItem.title : 'You are all done for now'}
                </Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(17), color: MUTED, marginTop: s(4) }}>
                  {nextRoutineItem
                    ? [nextRoutineItem.detail, formatScheduleTime(nextRoutineItem.time)].filter(Boolean).join(', ')
                    : 'Your caregiver can see that today’s routine is complete.'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(7) }}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY }}>Today’s plan</Text>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: MUTED }}>{handledRoutineCount} of {routineItems.length} checked</Text>
              </View>
              <View style={{ height: s(8), backgroundColor: BORDER, borderRadius: s(4), overflow: 'hidden', marginBottom: s(14) }}>
                <View style={{ height: '100%', width: `${(handledRoutineCount / routineItems.length) * 100}%`, backgroundColor: SUCCESS, borderRadius: s(4) }} />
              </View>

              {routineItems.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  disabled={item.handled}
                  activeOpacity={0.7}
                  onPress={() => openRoutineItem(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}${item.time ? ` at ${formatScheduleTime(item.time)}` : ''}${item.handled ? `, ${item.status}` : ''}`}
                  accessibilityState={{ disabled: item.handled }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: item.complete ? SUCCESS_BG : item.handled ? WARNING_BG : SURFACE,
                    padding: s(16),
                    borderRadius: 6,
                    marginBottom: s(10),
                    minHeight: s(82),
                  }}
                >
                  <View style={{ width: s(54), marginRight: s(8) }}>
                    <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>
                      {formatScheduleTime(item.time) || 'Today'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(19), color: NAVY }}>{item.title}</Text>
                    {!!item.detail && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(16), color: MUTED, marginTop: s(2) }}>{item.detail}</Text>}
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: item.complete ? SUCCESS : item.handled ? WARNING : MUTED, marginTop: s(3) }}>
                      {item.label}
                    </Text>
                  </View>
                  <Ionicons name={item.complete ? 'checkmark-circle' : item.handled ? 'remove-circle' : 'ellipse-outline'} size={s(30)} color={item.complete ? SUCCESS : item.handled ? WARNING : NAVY} style={{ marginLeft: s(10) }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {routineItems.length === 0 && (
            <View style={{ backgroundColor: SUCCESS_BG, padding: s(18), borderRadius: 6, marginBottom: s(24) }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: SUCCESS }}>Nothing scheduled for today</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(16), color: MUTED, marginTop: s(4) }}>You are all caught up.</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={openSafetyCheckin}
            disabled={safetySaving}
            accessibilityRole="button"
            accessibilityLabel="Send a safety check-in"
            style={{ backgroundColor: latestSafetyCheckin?.status === 'needs_help' || latestSafetyCheckin?.status === 'urgent' ? DANGER_BG : SURFACE, padding: s(18), borderRadius: 6, marginBottom: s(18), flexDirection: 'row', alignItems: 'center', minHeight: s(82) }}
          >
            <Ionicons name={latestSafetyCheckin?.status === 'okay' ? 'checkmark-circle-outline' : 'hand-left-outline'} size={s(30)} color={latestSafetyCheckin?.status === 'okay' ? SUCCESS : DANGER} style={{ marginRight: s(14) }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(19), color: NAVY }}>{latestSafetyCheckin?.status === 'okay' ? 'You checked in okay' : 'How are you?'}</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(16), color: MUTED, marginTop: s(2) }}>{latestSafetyCheckin?.status === 'okay' ? 'Tap to send another check-in' : 'Let your caregiver know if you need help'}</Text>
            </View>
          </TouchableOpacity>

          {!moodToday ? (
            <TouchableOpacity
              onPress={() => { setMoodError(''); setMoodVisible(true); }}
              style={{ backgroundColor: WARNING_BG, padding: s(18), borderRadius: 6, marginBottom: s(18), flexDirection: 'row', alignItems: 'center', minHeight: s(82) }}
            >
              <Text style={{ fontSize: s(30), marginRight: s(14) }}>😊</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(19), color: NAVY }}>How are you feeling?</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(16), color: MUTED, marginTop: s(2) }}>Tap to check in for today</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={{ backgroundColor: SUCCESS_BG, padding: s(16), borderRadius: 6, marginBottom: s(18), flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: s(26), marginRight: s(12) }}>{getMoodEmoji(moodToday.mood)}</Text>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: SUCCESS }}>Mood logged for today</Text>
            </View>
          )}

          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), color: NAVY, marginBottom: s(10) }}>More</Text>
          <View style={{ flexDirection: 'row', marginBottom: s(24) }}>
            <TouchableOpacity onPress={() => { setVitalError(''); setVitalsVisible(true); }} style={{ flex: 1, backgroundColor: SURFACE, borderRadius: 6, padding: s(14), marginRight: s(6), minHeight: s(76) }}>
              <Ionicons name="pulse-outline" size={s(22)} color={NAVY} />
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY, marginTop: s(5) }}>Log a vital</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('PatientProfile')} style={{ flex: 1, backgroundColor: SURFACE, borderRadius: 6, padding: s(14), marginLeft: s(6), minHeight: s(76) }}>
              <Ionicons name="settings-outline" size={s(22)} color={NAVY} />
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(17), color: NAVY, marginTop: s(5) }}>Settings</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: s(4), borderTopWidth: 1, borderTopColor: BORDER, paddingTop: s(20) }}>
            <TouchableOpacity
              onPress={handleEmergency}
              style={{ backgroundColor: DANGER_BG, paddingVertical: s(19), borderRadius: 6, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
            >
              <Ionicons name="alert-circle" size={s(24)} color={DANGER} style={{ marginRight: s(10) }} />
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(19), color: DANGER }}>Emergency, call 911</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NAVY} />}
        ListFooterComponent={
        <>
          <Modal onRequestClose={() => { if (moodLoading) return; setMoodVisible(false); }} visible={moodVisible} animationType="slide" transparent>
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
                      accessibilityRole="button"
                      accessibilityLabel={m.label}
                      accessibilityState={{ selected: selectedMood === m.value }}
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
                <Button title={moodLoading ? 'Logging' : 'Log Mood'} onPress={handleLogMood} disabled={!selectedMood || moodLoading} loading={moodLoading} style={{ borderRadius: 8, marginBottom: s(8) }} />
                <Button title="Cancel" onPress={() => { if (moodLoading) return; setMoodVisible(false); setSelectedMood(null); setMoodNote(''); setMoodError(''); }} style={{ backgroundColor: MUTED, borderRadius: 8 }} />
              </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          <Modal onRequestClose={() => { if (planSaving) return; setPlanVisible(false); }} visible={planVisible} animationType="slide" transparent>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15,44,107,0.45)' }}>
                <View style={{ backgroundColor: WHITE, borderRadius: 12, padding: s(22), width: '90%', maxHeight: planModalHeight, overflow: 'hidden' }}>
                  <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(21), color: NAVY, marginBottom: s(5) }}>{dailyPlan ? 'Today’s schedule' : 'A quick morning check-in'}</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: MUTED, marginBottom: s(16) }}>{dailyPlan ? 'Your caregiver can view this schedule too.' : 'There are no wrong answers.'}</Text>
                  {dailyPlan ? (
                    <>
                      {!!checkinError && <Text style={{ color: DANGER, marginBottom: s(10) }}>{checkinError}</Text>}
                      <FlatList
                        data={activePlanEntries(dailyPlan.blocks || [])}
                        keyExtractor={({ block, index }) => `${block.start}-${index}`}
                        ListEmptyComponent={<Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: MUTED }}>No activities scheduled for today.</Text>}
                        renderItem={({ item: { block: item, index } }) => {
                          const checked = activityCheckins.find((entry) => entry.block_index === index);
                          return <View style={{ flexDirection: 'row', paddingVertical: s(10), borderBottomWidth: 1, borderBottomColor: BORDER }}>
                            <Text style={{ width: s(72), fontFamily: 'DMSans_700Bold', fontSize: s(13), color: NAVY }}>{displayTime(item.start)}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(15), color: NAVY }}>{item.title || planLabels[item.type]}</Text>
                              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: MUTED }}>{item.minutes} minutes{item.location_name ? `, ${item.location_name}` : ''}</Text>
                              {checked ? <Text style={{ color: SUCCESS, fontFamily: 'DMSans_500Medium', marginTop: s(6) }}>Checked in at {new Date(checked.checked_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text> : item.location_id && item.type !== 'medicine' ? <TouchableOpacity disabled={scanningBlock !== null} onPress={() => scanActivitySticker(index)} accessibilityRole="button" style={{ backgroundColor: NAVY, padding: s(9), borderRadius: 7, alignSelf: 'flex-start', marginTop: s(7) }}><Text style={{ color: WHITE, fontFamily: 'DMSans_700Bold' }}>{scanningBlock === index ? 'Ready to scan' : `Scan ${item.location_name || 'place'} sticker`}</Text></TouchableOpacity> : null}
                            </View>
                          </View>;
                        }}
                        style={{ flexGrow: 0, maxHeight: Math.max(s(160), planModalHeight - s(150)) }}
                      />
                    </>
                  ) : (
                    <ScrollView
                      style={{ flexGrow: 0, maxHeight: Math.max(s(180), planModalHeight - s(150)) }}
                      contentContainerStyle={{ paddingBottom: s(4) }}
                      keyboardShouldPersistTaps="handled"
                    >
                      {[
                        ['sleep', 'How was your sleep?', ['Very bad', 'Okay', 'Good']],
                        ['feeling', 'How are you feeling?', ['Not well', 'Okay', 'Good']],
                        ['energy', 'How much energy do you have?', ['Low', 'Some', 'A lot']],
                        ['play', 'Would you like some activity time?', ['Yes', 'No']],
                        ['needsCare', 'Would you like extra care time?', ['Yes', 'No']],
                      ].map(([key, question, options]) => <View key={key} style={{ marginBottom: s(13) }}>
                        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: NAVY, marginBottom: s(7) }}>{question}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{options.map((option, index) => {
                          const answer = key === 'play' || key === 'needsCare' ? option.toLowerCase() : String(index + 1);
                          return <TouchableOpacity key={option} onPress={() => setPlanAnswers((current) => ({ ...current, [key]: answer }))} style={{ flex: 1, minWidth: 0, minHeight: s(48), backgroundColor: planAnswers[key] === answer ? NAVY : SURFACE, borderRadius: 8, padding: s(9), marginRight: index < options.length - 1 ? s(6) : 0, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: planAnswers[key] === answer ? WHITE : NAVY, textAlign: 'center' }}>{option}</Text></TouchableOpacity>;
                        })}</View>
                      </View>)}
                    </ScrollView>
                  )}
                  <Button title={dailyPlan ? 'Close' : (planSaving ? 'Building' : 'Build my schedule')} onPress={dailyPlan ? () => setPlanVisible(false) : saveDailyPlan} disabled={!dailyPlan && (Object.values(planAnswers).some((answer) => !answer) || planSaving)} loading={!dailyPlan && planSaving} style={{ marginTop: s(8), marginBottom: s(8) }} />
                  {!dailyPlan && <Button title="Cancel" onPress={() => setPlanVisible(false)} style={{ backgroundColor: MUTED }} />}
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          <Modal onRequestClose={() => { if (vitalLoading) return; setVitalsVisible(false); }} visible={vitalsVisible} animationType="slide" transparent>
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
                    <TouchableOpacity key={t.key} onPress={() => setVitalType(t.key)} accessibilityRole="button" accessibilityLabel={`Log ${t.label}`} accessibilityState={{ selected: vitalType === t.key }} style={{ backgroundColor: vitalType === t.key ? NAVY : SURFACE, paddingHorizontal: s(12), paddingVertical: s(9), borderRadius: 6, marginRight: s(6), marginBottom: s(6), minHeight: s(44), justifyContent: 'center' }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: vitalType === t.key ? WHITE : NAVY }}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!!vitalType && (
                  <TextInput style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(18), color: NAVY, marginBottom: s(16) }} placeholder="Value" placeholderTextColor={PLACEHOLDER} value={vitalValue} onChangeText={value => { setVitalValue(value); setVitalError(''); }} keyboardType="default" />
                )}
                <Button title={vitalLoading ? 'Logging' : 'Log'} onPress={handleLogVital} disabled={!vitalType || !vitalValue.trim() || vitalLoading} loading={vitalLoading} style={{ borderRadius: 8, marginBottom: s(8) }} />
                <Button title="Cancel" onPress={() => { if (vitalLoading) return; setVitalsVisible(false); setVitalType(''); setVitalValue(''); setVitalError(''); }} style={{ backgroundColor: MUTED, borderRadius: 8 }} />
              </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </>
        }
      />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: s(22), paddingTop: s(10), paddingBottom: s(14), backgroundColor: WHITE, borderTopWidth: 1, borderTopColor: BORDER }}>
        <TouchableOpacity
          onPress={handleCallCaregiver}
          accessibilityRole="button"
          accessibilityLabel="Call caregiver"
          style={{ backgroundColor: NAVY, minHeight: s(58), borderRadius: 6, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
        >
          <Ionicons name="call" size={s(24)} color={WHITE} style={{ marginRight: s(10) }} />
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(19), color: WHITE }}>Call Caregiver</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
