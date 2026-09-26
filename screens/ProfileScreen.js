import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  useWindowDimensions,
  ScrollView,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import * as Crypto from 'expo-crypto';
import Button from '../components/Button';
import { NAVY, WHITE, PLACEHOLDER, MUTED, DANGER } from '../theme/colors';

export default function ProfileScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);

  const scale = width / 375;
  const s = (size) => Math.round(size * scale);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setEmail(user.email || '');

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .single();

    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }

    const { data: cp } = await supabase
      .from('caregiver_phone')
      .select('phone')
      .eq('user_id', user.id)
      .single();

    if (cp) setCaregiverPhone(cp.phone || '');

    const { data: patientRows } = await supabase.from('patients').select('id, name').eq('created_by', user.id).order('name');
    setPatients(patientRows || []);
  };

  useEffect(() => { fetchData(); }, []);


  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: fullName.trim(),
        phone: phone.trim(),
      });

    if (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to save profile.');
      return;
    }

    const contactRequest = caregiverPhone.trim()
      ? supabase.from('caregiver_phone').upsert({ user_id: user.id, phone: caregiverPhone.trim() })
      : supabase.from('caregiver_phone').delete().eq('user_id', user.id);
    const { error: cpError } = await contactRequest;
    if (cpError) {
      console.error('caregiver_phone save failed', cpError);
      setLoading(false);
      Alert.alert('Error', 'Failed to save the phone number.');
      return;
    }

    setLoading(false);
    navigation.goBack();
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('signOut failed', error);
      Alert.alert('Error', 'Could not sign out. Please try again.');
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('CaregiverHome');
    }
  };

  const makeFamilyCode = async (patient) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const code = Array.from(Crypto.getRandomValues(new Uint32Array(8)), (value) => String(value % 10)).join('');
    const { error } = await supabase.from('family_codes').insert({ patient_id: patient.id, caregiver_id: user.id, code });
    if (error) {
      Alert.alert('Could not make a code', 'Please try again.');
      return;
    }
    Alert.alert(`Family code for ${patient.name}`, `${code}\n\nHave them sign in, then enter this code. It expires in 7 days.`);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: WHITE }}>
      <View style={{ padding: s(20) }}>
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(22), color: NAVY, marginBottom: s(20) }}>Profile</Text>

        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: MUTED, marginBottom: s(16) }}>{email}</Text>

        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Full Name</Text>
        <TextInput
          style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }}
          placeholder="Your name"
          placeholderTextColor={PLACEHOLDER}
          value={fullName}
          onChangeText={setFullName}
        />

        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Phone</Text>
        <TextInput
          style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }}
          placeholder="+1 555 555 5555"
          placeholderTextColor={PLACEHOLDER}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Your Phone (for patients to call)</Text>
        <TextInput
          style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }}
          placeholder="+1 555 555 5555"
          placeholderTextColor={PLACEHOLDER}
          value={caregiverPhone}
          onChangeText={setCaregiverPhone}
          keyboardType="phone-pad"
        />

        <Button
          title={loading ? 'Saving...' : 'Save'}
          onPress={handleSave}
          disabled={loading}
          loading={loading}
          style={{ marginBottom: s(12) }}
        />

        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), color: NAVY, marginTop: s(16), marginBottom: s(6) }}>Family access</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: MUTED, marginBottom: s(10) }}>Family only sees medication status and important care updates.</Text>
        {patients.map((patient) => <Button key={patient.id} title={`Make code for ${patient.name}`} onPress={() => makeFamilyCode(patient)} style={{ backgroundColor: '#343434', marginBottom: s(8) }} />)}

        <Button
          title="Sign Out"
          onPress={handleSignOut}
          style={{ backgroundColor: DANGER }}
        />

        <Button
          title="Go Back"
          onPress={handleBack}
          style={{ backgroundColor: '#343434', marginTop: s(32), alignSelf: 'center', width: '78%' }}
        />
      </View>
    </ScrollView>
  );
}
