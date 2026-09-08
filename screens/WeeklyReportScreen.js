import React, { useState, useEffect } from 'react';
import { View, Text, useWindowDimensions, ScrollView, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import useCustomFonts from '../lib/useCustomFonts';
import { NAVY } from '../theme/colors';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WeeklyReportScreen({ route }) {
  const { patientId } = route.params;
  const { width } = useWindowDimensions();
  const { fontsLoaded, FontProvider } = useCustomFonts();
  const [report, setReport] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const scale = width / 375;
  const s = (size) => Math.round(size * scale);

  const fetchReport = async () => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekAgoStr = weekAgo.toISOString();
    const nowStr = now.toISOString();

    const { data: medLogs } = await supabase
      .from('medication_log')
      .select('*')
      .eq('patient_id', patientId)
      .gte('logged_at', weekAgoStr)
      .lte('logged_at', nowStr);

    const { data: taskComps } = await supabase
      .from('task_completion')
      .select('*')
      .eq('patient_id', patientId)
      .gte('completed_at', weekAgoStr)
      .lte('completed_at', nowStr);

    const { data: moodData } = await supabase
      .from('mood_logs')
      .select('*')
      .eq('patient_id', patientId)
      .gte('logged_at', weekAgoStr)
      .lte('logged_at', nowStr);

    const { data: meds } = await supabase
      .from('medications')
      .select('id')
      .eq('patient_id', patientId);

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('patient_id', patientId)
      .eq('active', true);

    const medTaken = (medLogs || []).filter((l) => l.status === 'taken').length;
    const medMissed = (medLogs || []).filter((l) => l.status === 'missed').length;
    const medSkipped = (medLogs || []).filter((l) => l.status === 'skipped').length;
    const taskDone = (taskComps || []).filter((c) => c.status === 'completed').length;
    const taskMissed = (taskComps || []).filter((c) => c.status === 'missed').length;

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

    const totalMedSlots = (meds || []).length * 7;
    const totalTaskSlots = (tasks || []).length * 7;

    setReport({
      medTaken,
      medMissed,
      medSkipped,
      taskDone,
      taskMissed,
      totalMedSlots,
      totalTaskSlots,
      avgMoodByDay,
      moodCount: (moodData || []).length,
    });
  };

  useEffect(() => { fetchReport(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReport();
    setRefreshing(false);
  };

  if (!fontsLoaded) return <FontProvider />;
  if (!report) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Loading...</Text></View>;

  const medRate = report.totalMedSlots > 0 ? Math.round((report.medTaken / report.totalMedSlots) * 100) : 0;
  const taskRate = report.totalTaskSlots > 0 ? Math.round((report.taskDone / report.totalTaskSlots) * 100) : 0;

  const getMoodEmoji = (avg) => {
    if (avg >= 4.5) return '😊';
    if (avg >= 3.5) return '🙂';
    if (avg >= 2.5) return '😐';
    if (avg >= 1.5) return '😟';
    return '😢';
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={{ padding: s(20) }}>
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(22), color: NAVY, marginBottom: s(20) }}>Weekly Report</Text>

        <View style={{ backgroundColor: '#F0F4FF', borderRadius: 12, padding: s(16), marginBottom: s(12) }}>
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: NAVY, marginBottom: s(8) }}>Medications</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#333' }}>
            Taken: {report.medTaken} | Missed: {report.medMissed} | Skipped: {report.medSkipped}
          </Text>
          <View style={{ height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginTop: s(8), overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${medRate}%`, backgroundColor: medRate >= 80 ? '#4CAF50' : medRate >= 50 ? '#FF9800' : '#F44336', borderRadius: 4 }} />
          </View>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: NAVY, marginTop: s(4) }}>{medRate}% completion</Text>
        </View>

        <View style={{ backgroundColor: '#F0F4FF', borderRadius: 12, padding: s(16), marginBottom: s(12) }}>
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: NAVY, marginBottom: s(8) }}>Tasks</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#333' }}>
            Done: {report.taskDone} | Missed: {report.taskMissed}
          </Text>
          <View style={{ height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginTop: s(8), overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${taskRate}%`, backgroundColor: taskRate >= 80 ? '#4CAF50' : taskRate >= 50 ? '#FF9800' : '#F44336', borderRadius: 4 }} />
          </View>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: NAVY, marginTop: s(4) }}>{taskRate}% completion</Text>
        </View>

        <View style={{ backgroundColor: '#F0F4FF', borderRadius: 12, padding: s(16), marginBottom: s(12) }}>
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: NAVY, marginBottom: s(8) }}>Mood This Week</Text>
          {report.moodCount === 0 ? (
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>No mood entries</Text>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {DAYS.map((day, i) => (
                <View key={i} style={{ alignItems: 'center' }}>
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