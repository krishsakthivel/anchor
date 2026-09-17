import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  useWindowDimensions,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import useCustomFonts from '../lib/useCustomFonts';
import Button from '../components/Button';
import { NAVY, WHITE, PLACEHOLDER } from '../theme/colors';

export default function AppointmentsScreen({ route }) {
  const { patientId, isPatient } = route.params;
  const { width } = useWindowDimensions();
  const { fontsLoaded, FontProvider } = useCustomFonts();
  const [appointments, setAppointments] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [doctor, setDoctor] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const scale = width / 375;
  const s = (size) => Math.round(size * scale);

  const fetchAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('patient_id', patientId)
      .order('appointment_time', { ascending: true });

    setAppointments(data || []);
  };

  useEffect(() => { fetchAppointments(); }, [patientId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  };

  if (!fontsLoaded) return <FontProvider />;

  const handleAdd = async () => {
    if (!title.trim() || !date.trim() || !time.trim()) return;
    setLoading(true);

    // Free-text fields: validate before building a Date, because an invalid
    // input makes toISOString() throw and crash the handler.
    const dateStr = date.trim();
    const timeStr = time.trim();
    const parsed = new Date(`${dateStr}T${timeStr}:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr) || isNaN(parsed.getTime())) {
      setLoading(false);
      Alert.alert('Invalid date or time', 'Please use YYYY-MM-DD for the date and HH:MM for the time.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      Alert.alert('Error', 'Your session has expired. Please sign in again.');
      return;
    }
    const appointmentTime = parsed.toISOString();

    const { error } = await supabase
      .from('appointments')
      .insert({
        patient_id: patientId,
        created_by: user.id,
        title: title.trim(),
        doctor: doctor.trim() || null,
        location: location.trim() || null,
        appointment_time: appointmentTime,
        notes: notes.trim() || null,
      });

    setLoading(false);
    if (error) {
      Alert.alert('Error', 'Failed to add appointment.');
      return;
    }

    setAddVisible(false);
    setTitle('');
    setDoctor('');
    setLocation('');
    setDate('');
    setTime('');
    setNotes('');
    fetchAppointments();
  };

  const handleComplete = async (appt) => {
    await supabase
      .from('appointments')
      .update({ completed: true })
      .eq('id', appt.id);
    fetchAppointments();
  };

  const handleDelete = async (apptId) => {
    Alert.alert('Delete Appointment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('appointments').delete().eq('id', apptId);
          fetchAppointments();
        },
      },
    ]);
  };

  const now = new Date();
  const upcoming = appointments.filter((a) => new Date(a.appointment_time) >= now && !a.completed);
  const past = appointments.filter((a) => new Date(a.appointment_time) < now || a.completed);

  return (
    <FlatList
      data={[]}
      renderItem={null}
      ListHeaderComponent={
        <View style={{ padding: s(20) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s(16) }}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(22), color: NAVY }}>Appointments</Text>
            {!isPatient && (
              <TouchableOpacity onPress={() => setAddVisible(true)}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>

          {upcoming.length === 0 && past.length === 0 && (
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>
              No appointments scheduled
            </Text>
          )}

          {upcoming.length > 0 && (
            <>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: '#666', marginBottom: s(8) }}>Upcoming</Text>
              {upcoming.map((appt) => {
                const dt = new Date(appt.appointment_time);
                return (
                  <TouchableOpacity
                    key={appt.id}
                    onLongPress={() => !isPatient && handleDelete(appt.id)}
                    style={{ backgroundColor: '#F0F4FF', padding: s(14), borderRadius: 8, marginBottom: s(8) }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(15), color: NAVY, flex: 1 }}>{appt.title}</Text>
                      {!isPatient && (
                        <TouchableOpacity onPress={() => handleComplete(appt)}>
                          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(12), color: NAVY }}>Done</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {appt.doctor && (
                      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: '#333', marginTop: s(2) }}>Dr. {appt.doctor}</Text>
                    )}
                    {appt.location && (
                      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#666', marginTop: s(2) }}>📍 {appt.location}</Text>
                    )}
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#999', marginTop: s(4) }}>
                      {dt.toLocaleDateString()} at {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {appt.notes && (
                      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#666', marginTop: s(4) }}>{appt.notes}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {past.length > 0 && (
            <>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: '#666', marginTop: s(16), marginBottom: s(8) }}>Past</Text>
              {past.map((appt) => {
                const dt = new Date(appt.appointment_time);
                return (
                  <View key={appt.id} style={{ backgroundColor: '#F5F5F5', padding: s(12), borderRadius: 8, marginBottom: s(8), opacity: 0.7 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: '#666' }}>
                      {appt.completed ? '✓ ' : ''}{appt.title}
                    </Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#999' }}>
                      {dt.toLocaleDateString()}
                    </Text>
                  </View>
                );
              })}
            </>
          )}
        </View>
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListFooterComponent={
        <Modal visible={addVisible} animationType="slide" transparent>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ backgroundColor: WHITE, borderRadius: 12, padding: s(24), width: '85%' }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>Add Appointment</Text>

              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Title *</Text>
              <TextInput
                style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }}
                placeholder="e.g. Checkup"
                placeholderTextColor={PLACEHOLDER}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Doctor</Text>
              <TextInput
                style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }}
                placeholder="e.g. Smith"
                placeholderTextColor={PLACEHOLDER}
                value={doctor}
                onChangeText={setDoctor}
              />

              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Location</Text>
              <TextInput
                style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }}
                placeholder="e.g. City Hospital"
                placeholderTextColor={PLACEHOLDER}
                value={location}
                onChangeText={setLocation}
              />

              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }}
                placeholder="2026-08-20"
                placeholderTextColor={PLACEHOLDER}
                value={date}
                onChangeText={setDate}
              />

              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Time (HH:MM) *</Text>
              <TextInput
                style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }}
                placeholder="14:30"
                placeholderTextColor={PLACEHOLDER}
                value={time}
                onChangeText={setTime}
              />

              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Notes</Text>
              <TextInput
                style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(16) }}
                placeholder="Optional notes"
                placeholderTextColor={PLACEHOLDER}
                value={notes}
                onChangeText={setNotes}
              />

              <Button title={loading ? 'Adding...' : 'Add Appointment'} onPress={handleAdd} disabled={!title.trim() || !date.trim() || !time.trim() || loading} loading={loading} style={{ marginBottom: s(8) }} />
              <Button title="Cancel" onPress={() => { setAddVisible(false); setTitle(''); setDoctor(''); setLocation(''); setDate(''); setTime(''); setNotes(''); }} style={{ backgroundColor: '#999' }} />
            </View>
          </View>
        </Modal>
      }
    />
  );
}
