import { useFocusEffect } from '@react-navigation/native';
const { isValidVitalValue } = require('../lib/careValues');
import { appAlert as Alert } from '../components/AppDialog';
import React, { useState, useCallback } from 'react';
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
import useCustomFonts from '../lib/useCustomFonts';
import Button from '../components/Button';
import { NAVY, WHITE, PLACEHOLDER, SURFACE } from '../theme/colors';

const VITAL_TYPES = [
  { key: 'blood_pressure', label: 'Blood Pressure', unit: 'mmHg', placeholder: '120/80' },
  { key: 'blood_sugar', label: 'Blood Sugar', unit: 'mg/dL', placeholder: '100' },
  { key: 'weight', label: 'Weight', unit: 'lbs', placeholder: '150' },
  { key: 'temperature', label: 'Temperature', unit: '°F', placeholder: '98.6' },
  { key: 'heart_rate', label: 'Heart Rate', unit: 'bpm', placeholder: '72' },
  { key: 'oxygen', label: 'Oxygen Level', unit: '%', placeholder: '98' },
];


export default function VitalsScreen({ route }) {
  const { patientId, isPatient } = route.params;
  const { width } = useWindowDimensions();
  const { fontsLoaded, FontProvider } = useCustomFonts();
  const [vitals, setVitals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [addVisible, setAddVisible] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [vitalValue, setVitalValue] = useState('');
  const [vitalNote, setVitalNote] = useState('');
  const [loading, setLoading] = useState(false);

  const scale = Math.min(1.08, Math.max(0.95, width / 375));
  const s = (size) => Math.round(size * scale);

  const fetchVitals = async () => {
    try {
    const { data, error } = await supabase
      .from('vital_signs')
      .select('*')
      .eq('patient_id', patientId)
      .order('logged_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    setVitals(data || []);
    setLoadError('');
    } catch (error) { setLoadError(error.message || 'Could not load vitals. Please refresh to try again.'); }
  };

  useFocusEffect(useCallback(() => { fetchVitals(); }, [patientId]));

  const onRefresh = async () => {
    setRefreshing(true);
    try { await fetchVitals();
    } catch (error) { Alert.alert('Could not refresh', error.message || 'Please try again.'); }
    finally { setRefreshing(false); }
  };

  if (!fontsLoaded) return <FontProvider />;

  const handleAddVital = async () => {
    if (!selectedType || !vitalValue.trim()) return;
    if (!isValidVitalValue(selectedType.key, vitalValue)) {
      Alert.alert(
        'Invalid reading',
        selectedType.key === 'blood_pressure'
          ? 'Enter blood pressure as two numbers, such as 120/80.'
          : 'Enter a positive number for this reading.'
      );
      return;
    }
    setLoading(true);
    try {

    const { error } = await supabase
      .from('vital_signs')
      .insert({
        patient_id: patientId,
        type: selectedType.key,
        value: vitalValue.trim(),
        unit: selectedType.unit,
        note: vitalNote.trim() || null,
      });

    setLoading(false);
    if (error) {
      Alert.alert('Error', 'Failed to log vital.');
      return;
    }

    setAddVisible(false);
    setSelectedType(null);
    setVitalValue('');
    setVitalNote('');
    fetchVitals();
    } catch (error) {
      Alert.alert('Could not save', error.message || 'Please try again.');
    } finally { setLoading(false); }
  };

  const getTypeIcon = (type) => {
    const icons = {
      blood_pressure: '❤️',
      blood_sugar: '🩸',
      weight: '⚖️',
      temperature: '🌡️',
      heart_rate: '💓',
      oxygen: '💨',
    };
    return icons[type] || '📊';
  };

  const getTypeLabel = (type) => {
    return VITAL_TYPES.find((t) => t.key === type)?.label || type;
  };

  const getLatestByType = () => {
    const latest = {};
    vitals.forEach((v) => {
      if (!latest[v.type]) latest[v.type] = v;
    });
    return Object.values(latest);
  };

  return (
    <FlatList
      data={[]}
      renderItem={null}
      ListHeaderComponent={
        <View style={{ padding: s(20) }}>
          {!!loadError && <Text accessibilityRole="alert" style={{ color: '#C0392B', marginBottom: s(12) }}>{loadError}</Text>}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s(16) }}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(22), color: NAVY }}>Vitals</Text>
            {isPatient && (
              <TouchableOpacity onPress={() => setAddVisible(true)} accessibilityRole="button" accessibilityLabel="Log a vital sign" style={{ minHeight: s(44), justifyContent: 'center', paddingHorizontal: s(6) }}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: NAVY }}>+ Log</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: '#666', marginBottom: s(12) }}>Latest Readings</Text>
          {getLatestByType().length === 0 ? (
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>
              No vitals logged yet
            </Text>
          ) : (
            getLatestByType().map((v) => (
              <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, padding: s(12), borderRadius: 6, marginBottom: s(8) }}>
                <Text style={{ fontSize: s(24), marginRight: s(12) }}>{getTypeIcon(v.type)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY }}>{getTypeLabel(v.type)}</Text>
                  <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), color: NAVY }}>{v.value} {v.unit}</Text>
                </View>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: '#666' }}>
                  {new Date(v.logged_at).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}

          {vitals.length > 0 && (
            <>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: '#666', marginTop: s(16), marginBottom: s(12) }}>History</Text>
              {vitals.slice(0, 20).map((v) => (
                <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', padding: s(10), borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
                  <Text style={{ fontSize: s(18), marginRight: s(8) }}>{getTypeIcon(v.type)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: NAVY }}>{getTypeLabel(v.type)}</Text>
                  </View>
                  <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>{v.value} {v.unit}</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: '#666', marginLeft: s(8) }}>
                    {new Date(v.logged_at).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListFooterComponent={
        <Modal onRequestClose={() => { if (loading) return; setAddVisible(false); }} visible={addVisible} animationType="slide" transparent>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: s(24) }} keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: WHITE, borderRadius: 12, padding: s(24), width: '85%', maxWidth: 440 }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>Log Vital</Text>

              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(8) }}>Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                {VITAL_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.key}
                    onPress={() => setSelectedType(type)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${type.label}`}
                    accessibilityState={{ selected: selectedType?.key === type.key }}
                    style={{
                      backgroundColor: selectedType?.key === type.key ? NAVY : SURFACE,
                      paddingHorizontal: s(12),
                      paddingVertical: s(10),
                      borderRadius: 6,
                      marginRight: s(6),
                      marginBottom: s(6),
                      minHeight: s(44),
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{
                      fontFamily: 'DMSans_500Medium',
                      fontSize: s(14),
                      color: selectedType?.key === type.key ? WHITE : NAVY,
                    }}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {selectedType && (
                <>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>
                    {selectedType.label} ({selectedType.unit})
                  </Text>
                  <TextInput
                    style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(18), color: NAVY, marginBottom: s(12) }}
                    placeholder={selectedType.placeholder}
                    placeholderTextColor={PLACEHOLDER}
                    value={vitalValue}
                    onChangeText={setVitalValue}
                    keyboardType="default"
                  />

                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Note (optional)</Text>
                  <TextInput
                    style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(16) }}
                    placeholder="e.g. After breakfast"
                    placeholderTextColor={PLACEHOLDER}
                    value={vitalNote}
                    onChangeText={setVitalNote}
                  />
                </>
              )}

              <Button title={loading ? 'Logging' : 'Log Vital'} onPress={handleAddVital} disabled={!selectedType || !vitalValue.trim() || loading} loading={loading} style={{ marginBottom: s(8) }} />
              <Button title="Cancel" onPress={() => { setAddVisible(false); setSelectedType(null); setVitalValue(''); setVitalNote(''); }} style={{ backgroundColor: '#999' }} />
            </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      }
    />
  );
}
