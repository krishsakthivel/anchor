const { reportWindow, reportTotals } = require('../lib/reportWindow');
import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import { View, Text, useWindowDimensions, ScrollView, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import useCustomFonts from '../lib/useCustomFonts';
import { NAVY, SURFACE } from '../theme/colors';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SCHEDULE_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];


export default function WeeklyReportScreen({ route }) {
  const { patientId } = route.params;
  const { width } = useWindowDimensions();
  const { fontsLoaded, FontProvider } = useCustomFonts();
  const [report, setReport] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const scale = Math.min(1.08, Math.max(0.95, width / 375));
  const s = (size) => Math.round(size * scale);

  const fetchReport = async () => {
    try {
    const now = new Date();
    const { start, end, startDay, endDay } = reportWindow(now);
    const firstDayStr = start.toISOString();
    const dayAfterTodayStr = end.toISOString();

    const { data: medLogs, error: medLogsError } = await supabase
      .from('medication_log')
      .select('*')
      .eq('patient_id', patientId)
      .gte('log_day', startDay)
      .lt('log_day', endDay);

    const { data: taskComps, error: taskCompsError } = await supabase
      .from('task_completion')
      .select('*')
      .eq('patient_id', patientId)
      .gte('completion_day', startDay)
      .lt('completion_day', endDay);

    const { data: moodData, error: moodError } = await supabase
      .from('mood_logs')
      .select('*')
      .eq('patient_id', patientId)
      .gte('logged_at', firstDayStr)
      .lt('logged_at', dayAfterTodayStr);

    const { data: meds, error: medsError } = await supabase
      .from('medications')
      .select('id, created_at')
      .eq('patient_id', patientId);

    const { data: medicationSchedules, error: medicationSchedulesError } = await supabase
      .from('medication_schedule')
      .select('*')
      .eq('patient_id', patientId)
      .eq('active', true);

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, days, created_at')
      .eq('patient_id', patientId)
      .eq('active', true);

    const requestError = [medLogsError, taskCompsError, moodError, medsError, medicationSchedulesError, tasksError].find(Boolean);
    if (requestError) throw requestError;


    const dailyMood = {};
    (moodData || []).forEach((m) => {
      const day = new Date(m.logged_at).getDay();
      if (!dailyMood[day]) dailyMood[day] = [];
      dailyMood[day].push(m.mood);
    });

    const avgMoodByDay = {};
    Object.keys(dailyMood).forEach((day) => {
      const avg = dailyMood[day].reduce((a, b) => a + b, 0) / dailyMood[day].length;
      avgMoodByDay[day] = avg;
    });

    const totals = reportTotals(meds, medicationSchedules, tasks, medLogs, taskComps, now);

    setReport({
      ...totals,
      avgMoodByDay,
      moodCount: (moodData || []).length,
    });
    setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Could not load the weekly report. Pull down to try again.');
    }
  };

  useFocusEffect(useCallback(() => { fetchReport(); }, [patientId]));

  const onRefresh = async () => {
    setRefreshing(true);
    try { await fetchReport(); } finally { setRefreshing(false); }
  };

  if (!fontsLoaded) return <FontProvider />;
  if (loadError && !report) return <View style={{ flex: 1, justifyContent: 'center', padding: s(24) }}><Text style={{ color: '#C0392B', marginBottom: s(12) }}>{loadError}</Text><Text onPress={fetchReport} style={{ color: NAVY }}>Try again</Text></View>;
  if (!report) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Loading</Text></View>;

  const medRate = report.totalMedSlots > 0 ? Math.round((report.medTaken / report.totalMedSlots) * 100) : 0;
  const taskRate = report.totalTaskSlots > 0 ? Math.round((report.taskDone / report.totalTaskSlots) * 100) : 0;

  const getMoodEmoji = (avg) => {
    if (avg >= 4.5) return '😊';
    if (avg >= 3.5) return '😐';
    if (avg >= 2.5) return '😟';
    if (avg >= 1.5) return '😢';
    return '🤒';
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={{ padding: s(20) }}>
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(22), color: NAVY, marginBottom: s(20) }}>Weekly Report</Text>
        {!!loadError && <Text style={{ color: '#C0392B', marginBottom: s(12) }}>{loadError} Showing the last loaded report.</Text>}

        <View style={{ backgroundColor: SURFACE, borderRadius: 6, padding: s(16), marginBottom: s(12) }}>
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: NAVY, marginBottom: s(8) }}>Medications</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#333' }}>
            Taken: {report.medTaken} | Missed: {report.medMissed} | Skipped: {report.medSkipped}
          </Text>
          <View style={{ height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginTop: s(8), overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${medRate}%`, backgroundColor: medRate >= 80 ? NAVY : medRate >= 50 ? '#FF9800' : '#F44336', borderRadius: 4 }} />
          </View>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: NAVY, marginTop: s(4) }}>{medRate}% completion</Text>
        </View>

        <View style={{ backgroundColor: SURFACE, borderRadius: 6, padding: s(16), marginBottom: s(12) }}>
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: NAVY, marginBottom: s(8) }}>Tasks</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#333' }}>
            Done: {report.taskDone} | Missed: {report.taskMissed}
          </Text>
          <View style={{ height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginTop: s(8), overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${taskRate}%`, backgroundColor: taskRate >= 80 ? NAVY : taskRate >= 50 ? '#FF9800' : '#F44336', borderRadius: 4 }} />
          </View>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: NAVY, marginTop: s(4) }}>{taskRate}% completion</Text>
        </View>

        <View style={{ backgroundColor: SURFACE, borderRadius: 6, padding: s(16), marginBottom: s(12) }}>
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: NAVY, marginBottom: s(8) }}>Mood This Week</Text>
          {report.moodCount === 0 ? (
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>No mood entries</Text>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {DAYS.map((day, i) => (
                <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(11), color: '#666' }}>{day}</Text>
                  <Text style={{ fontSize: s(20), marginTop: s(4) }}>
                    {report.avgMoodByDay[i] ? getMoodEmoji(report.avgMoodByDay[i]) : '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
