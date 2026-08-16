import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  useWindowDimensions,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  TouchableOpacity,
} from 'react-native';
import styles from './PlaceholderHome.styles';
import { supabase } from '../lib/supabase';
import useCustomFonts from '../lib/useCustomFonts';
import Button from '../components/Button';
import { NAVY, WHITE, PLACEHOLDER } from '../theme/colors';

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export default function CaregiverHomeScreen({ navigation }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const { width } = useWindowDimensions();
  const { fontsLoaded, FontProvider } = useCustomFonts();

  const scale = width / 375;
  const s = (size) => Math.round(size * scale);

  const fetchPatients = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    setPatients(data || []);
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPatients();
    setRefreshing(false);
  };

  if (!fontsLoaded) return <FontProvider />;

  const handleAddPatient = async () => {
    if (!newPatientName.trim()) return;

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const code = generateCode();

    const { error: codeError } = await supabase
      .from('pairing_codes')
      .insert({ caregiver_id: user.id, code });

    if (codeError) {
      setLoading(false);
      Alert.alert('Error', 'Failed to generate pairing code.');
      return;
    }

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .insert({
        name: newPatientName.trim(),
        created_by: user.id,
        pair_code: code,
      })
      .select()
      .single();

    setLoading(false);

    if (patientError) {
      Alert.alert('Error', 'Failed to add patient.');
      return;
    }

    if (newPatientPhone.trim()) {
      await supabase
        .from('emergency_contacts')
        .insert({
          patient_id: patient.id,
          name: 'Patient Phone',
          phone: newPatientPhone.trim(),
          priority: 1,
        });
    }

    Alert.alert('Patient Added', `Pairing code: ${code}\n\nShare this code with your patient.`);
    setAddModalVisible(false);
    setNewPatientName('');
    setNewPatientPhone('');
    fetchPatients();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            <Text style={[styles.title, { fontSize: s(24), marginBottom: s(8) }]}>Caregiver Home</Text>
            <Text style={[styles.subtitle, { fontSize: s(15), marginBottom: s(24) }]}>
              Manage your patients
            </Text>

            <Button
              title="Add Patient"
              onPress={() => setAddModalVisible(true)}
              style={{ marginBottom: s(16) }}
            />

            <Text style={[styles.subtitle, { fontSize: s(17), marginBottom: s(8), textAlign: 'left', width: '100%' }]}>
              Your Patients
            </Text>
            {patients.length === 0 ? (
              <Text style={[styles.subtitle, { fontSize: s(14), marginBottom: s(16) }]}>
                No patients yet. Add one to get started.
              </Text>
            ) : (
              patients.map((patient) => (
                <TouchableOpacity
                  key={patient.id}
                  style={{ backgroundColor: '#F0F4FF', padding: s(14), borderRadius: 8, marginBottom: s(8), width: '100%' }}
                  onPress={() => navigation.navigate('PatientDetail', { patientId: patient.id, patientName: patient.name })}
                >
                  <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(16), color: NAVY }}>
                    {patient.name}
                  </Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(12), color: '#666', marginTop: s(4) }}>
                    {patient.paired_user_id ? 'Paired' : `Code: ${patient.pair_code}`}
                  </Text>
                </TouchableOpacity>
              ))
            )}

            <View style={{ marginTop: s(24) }}>
              <Button
                title="Sign Out"
                onPress={handleSignOut}
                style={{ backgroundColor: '#C0392B' }}
              />
            </View>
          </>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      <Modal visible={addModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: WHITE, borderRadius: 12, padding: s(24), width: '85%' }}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>
              Add Patient
            </Text>

            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>
              Patient Name
            </Text>
            <TextInput
              style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }}
              placeholder="e.g. Mom"
              placeholderTextColor={PLACEHOLDER}
              value={newPatientName}
              onChangeText={setNewPatientName}
            />

            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>
              Phone (optional)
            </Text>
            <TextInput
              style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(16) }}
              placeholder="+1 555 555 5555"
              placeholderTextColor={PLACEHOLDER}
              value={newPatientPhone}
              onChangeText={setNewPatientPhone}
              keyboardType="phone-pad"
            />

            <Button
              title={loading ? 'Adding...' : 'Add Patient'}
              onPress={handleAddPatient}
              disabled={!newPatientName.trim() || loading}
              loading={loading}
              style={{ marginBottom: s(8) }}
            />
            <Button
              title="Cancel"
              onPress={() => { setAddModalVisible(false); setNewPatientName(''); setNewPatientPhone(''); }}
              style={{ backgroundColor: '#999' }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
