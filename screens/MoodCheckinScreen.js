import { useFocusEffect } from '@react-navigation/native';
const { MOODS } = require('../lib/careValues');
import { appAlert as Alert } from '../components/AppDialog';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  useWindowDimensions,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import useCustomFonts from '../lib/useCustomFonts';
import Button from '../components/Button';
import { NAVY, WHITE, PLACEHOLDER, SURFACE } from '../theme/colors';


export default function MoodCheckinScreen({ route }) {
  const { patientId, isPatient } = route.params;
  const { width } = useWindowDimensions();
  const { fontsLoaded, FontProvider } = useCustomFonts();
  const [moodLogs, setMoodLogs] = useState([]);
  const [selectedMood, setSelectedMood] = useState(null);
  const [moodNote, setMoodNote] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);

  const scale = Math.min(1.08, Math.max(0.95, width / 375));
  const s = (size) => Math.round(size * scale);

  const fetchMoods = async () => {
    try {
    const { data, error } = await supabase
      .from('mood_logs')
      .select('*')
      .eq('patient_id', patientId)
      .order('logged_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    setMoodLogs(data || []);
    setLoadError('');
    } catch (error) { setLoadError(error.message || 'Could not load mood. Please refresh to try again.'); }
  };

  useFocusEffect(useCallback(() => { fetchMoods(); }, [patientId]));

  const onRefresh = async () => {
    setRefreshing(true);
    try { await fetchMoods();
    } catch (error) { Alert.alert('Could not refresh', error.message || 'Please try again.'); }
    finally { setRefreshing(false); }
  };

  if (!fontsLoaded) return <FontProvider />;

  const handleLogMood = async () => {
    if (!selectedMood) return;
    setLoading(true);
    try {

    const { error } = await supabase
      .from('mood_logs')
      .insert({
        patient_id: patientId,
        mood: selectedMood,
        note: moodNote.trim() || null,
      });

    setLoading(false);
    if (error) {
      Alert.alert('Error', 'Failed to log mood.');
      return;
    }

    setSelectedMood(null);
    setMoodNote('');
    Alert.alert('Logged', 'Your mood has been recorded.');
    fetchMoods();
    } catch (error) {
      Alert.alert('Could not save', error.message || 'Please try again.');
    } finally { setLoading(false); }
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const alreadyLoggedToday = moodLogs.some((m) => new Date(m.logged_at) >= todayStart);

  const getMoodEmoji = (mood) => {
    return MOODS.find((m) => m.value === mood)?.emoji || '😐';
  };

  const getMoodLabel = (mood) => {
    return MOODS.find((m) => m.value === mood)?.label || '';
  };

  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);
    const dayMoods = moodLogs.filter((m) => {
      const ml = new Date(m.logged_at);
      return ml >= d && ml < nextDay;
    });
    const avg = dayMoods.length > 0 ? dayMoods.reduce((a, b) => a + b.mood, 0) / dayMoods.length : null;
    last7Days.push({
      day: d.toLocaleDateString('en', { weekday: 'short' }),
      date: d.getDate(),
      avg,
    });
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={{ padding: s(20) }}>
          {!!loadError && <Text accessibilityRole="alert" style={{ color: '#C0392B', marginBottom: s(12) }}>{loadError}</Text>}
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(22), color: NAVY, marginBottom: s(20) }}>Mood</Text>

        {isPatient && !alreadyLoggedToday && (
          <View style={{ marginBottom: s(24) }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(16), color: NAVY, marginBottom: s(12) }}>
              How are you feeling today?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(16) }}>
              {MOODS.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => setSelectedMood(m.value)}
                  accessibilityRole="button"
                  accessibilityLabel={m.label}
                  accessibilityState={{ selected: selectedMood === m.value }}
                  style={{
                    alignItems: 'center',
                    padding: s(10),
                    borderRadius: 6,
                    backgroundColor: selectedMood === m.value ? SURFACE : 'transparent',
                    borderWidth: selectedMood === m.value ? 2 : 0,
                    borderColor: NAVY,
                  }}
                >
                  <Text style={{ fontSize: s(32) }}>{m.emoji}</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#666', marginTop: s(4) }}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }}
              placeholder="Add a note (optional)"
              placeholderTextColor={PLACEHOLDER}
              value={moodNote}
              onChangeText={setMoodNote}
            />

            <Button
              title={loading ? 'Logging' : 'Log Mood'}
              onPress={handleLogMood}
              disabled={!selectedMood || loading}
              loading={loading}
            />
          </View>
        )}

        {isPatient && alreadyLoggedToday && (
          <View style={{ backgroundColor: SURFACE, padding: s(14), borderRadius: 6, marginBottom: s(20) }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY }}>
              You've logged your mood for today ✓
            </Text>
          </View>
        )}

        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: '#666', marginBottom: s(12) }}>This Week</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(20) }}>
          {last7Days.map((day, i) => (
            <View key={i} style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#666' }}>{day.day}</Text>
              <Text style={{ fontSize: s(24), marginTop: s(4) }}>
                {day.avg ? getMoodEmoji(Math.round(day.avg)) : '—'}
              </Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#666' }}>{day.date}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: '#666', marginBottom: s(8) }}>Recent Entries</Text>
        {moodLogs.length === 0 ? (
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>
            No mood entries yet
          </Text>
        ) : (
          moodLogs.map((log) => (
            <View key={log.id} style={{ flexDirection: 'row', alignItems: 'center', padding: s(10), borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
              <Text style={{ fontSize: s(24), marginRight: s(12) }}>{getMoodEmoji(log.mood)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY }}>{getMoodLabel(log.mood)}</Text>
                {!!log.note && (
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#666' }}>{log.note}</Text>
                )}
              </View>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: '#666' }}>
                {new Date(log.logged_at).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
