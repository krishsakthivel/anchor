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
import Button from '../components/Button';
import { NAVY, WHITE, PLACEHOLDER, MUTED, DANGER } from '../theme/colors';

// Caregiver-only profile screen. Patients use the separate, simplified
// PatientProfileScreen instead — do not reuse this one for patients.
export default function ProfileScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

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
    // Explicit reset: the navigator's initialRouteName only applies on first
    // mount, so an auth-state change alone won't move us off this screen.
    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('CaregiverHome');
    }
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
