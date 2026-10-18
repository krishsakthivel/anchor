import { signOutWithCleanup } from '../lib/session';
import { appAlert as Alert } from '../components/AppDialog';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  useWindowDimensions,
  ScrollView,
  } from 'react-native';
import { supabase as realSupabase } from '../lib/supabase';
import { useCaregiverTour } from '../components/CaregiverTour';
import { registerCaregiverPushToken } from '../lib/helpNotifications';
import Button from '../components/Button';
import { NAVY, WHITE, PLACEHOLDER, MUTED, DANGER } from '../theme/colors';

export default function ProfileScreen({ navigation }) {
  const tour = useCaregiverTour();
  const supabase = tour.client || realSupabase;
  const { width } = useWindowDimensions();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');

  const enableHelpNotifications = async () => {
    if (tour.active) { setPushMessage('Practice only. Enable real help notifications later on an installed phone app.'); return; }
    if (pushBusy) return;
    setPushBusy(true);
    setPushMessage('');
    try {
      await registerCaregiverPushToken();
      setPushMessage('This device is registered for help notifications.');
    } catch (error) { setPushMessage(error.message || 'Could not register this device. Please try again.'); }
    finally { setPushBusy(false); }
  };

  const scale = Math.min(1.08, Math.max(0.95, width / 375));
  const s = (size) => Math.round(size * scale);

  const fetchData = async () => {
    setProfileReady(false);
    setLoadError('');
    try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in again.');

    setEmail(user.email || '');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }

    const { data: cp, error: phoneError } = await supabase
      .from('caregiver_phone')
      .select('phone')
      .eq('user_id', user.id)
      .maybeSingle();
    if (phoneError) throw phoneError;

    if (cp) setCaregiverPhone(cp.phone || '');

    setProfileReady(true);
    } catch (error) { setLoadError(error.message || 'Could not load settings. Please try again.'); }
  };

  useEffect(() => { fetchData(); }, []);


  const handleSave = async () => {
    if (loading || !profileReady) return;
    setLoading(true);
    try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
      }).eq('id', user.id).select('id').single();

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
    } catch (error) {
      Alert.alert('Could not save', error.message || 'Please try again.');
    } finally { setLoading(false); }
  };

  const handleSignOut = async () => {
    if (tour.active) return;
    try {
      await signOutWithCleanup();
      navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
    } catch (error) { Alert.alert('Could not sign out', error.message || 'Please try again.'); }
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
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(22), color: NAVY, marginBottom: s(20) }}>Settings</Text>

        {!!loadError && <><Text style={{ color: DANGER }}>{loadError}</Text><Button title="Retry loading settings" onPress={fetchData} /></>}
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: MUTED, marginBottom: s(16) }}>Account email: {email}</Text>

        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), color: NAVY, marginBottom: s(10) }}>Your details</Text>

        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Name</Text>
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

        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Phone for caregiver calls</Text>
        <TextInput
          style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }}
          placeholder="+1 555 555 5555"
          placeholderTextColor={PLACEHOLDER}
          value={caregiverPhone}
          onChangeText={setCaregiverPhone}
          keyboardType="phone-pad"
        />

        <Button
          title={loading ? 'Saving' : 'Save changes'}
          onPress={handleSave}
          disabled={loading || !profileReady}
          loading={loading}
          style={[{ marginBottom: s(12) }, tour.highlight('profile-save')]}
        />


        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), color: NAVY, marginTop: s(16), marginBottom: s(10) }}>Account</Text>
        <Button title="Enable help notifications" onPress={enableHelpNotifications} loading={pushBusy} disabled={pushBusy} style={{ marginBottom: s(12) }} />
        {!!pushMessage && <Text style={{ color: NAVY, marginBottom: s(12) }}>{pushMessage}</Text>}
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
