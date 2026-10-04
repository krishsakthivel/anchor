import { signOutWithCleanup } from '../lib/session';
import { appAlert as Alert } from '../components/AppDialog';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  useWindowDimensions,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import { NAVY, WHITE, PLACEHOLDER, MUTED, SURFACE, DANGER } from '../theme/colors';
import { getElderMode, setElderMode } from '../lib/accessibility';

export default function PatientProfileScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [signOutVisible, setSignOutVisible] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [elderMode, setElderModeState] = useState(false);

  const scale = Math.min(1.08, Math.max(0.95, width / 375));
  const s = (size) => Math.round(size * scale);

  const loadProfile = async () => {
    setProfileReady(false);
    setLoadError('');
    try {
      setElderModeState(await getElderMode());
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in again.');
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
      setProfileReady(true);
    } catch (error) { setLoadError(error.message || 'Could not load settings. Please try again.'); }
  };
  useEffect(() => { loadProfile(); }, []);

  const handleElderModeChange = async (enabled) => {
    setElderModeState(enabled);
    try {
      await setElderMode(enabled);
    } catch (error) {
      setElderModeState(!enabled);
      Alert.alert('Could not save setting', 'Please try again.');
    }
  };

  const handleSave = async () => {
    if (loading || !profileReady) return;
    setLoading(true);
    setSaveError('');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setSaveError('Your session has expired. Please sign in again.');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), phone: phone.trim() })
        .eq('id', user.id).select('id').single();

      if (error) {
        console.error('profiles update failed', error);
        setSaveError(error.message || 'Could not save. Please try again.');
        return;
      }

      navigation.goBack();
    } catch (err) {
      console.error('handleSave failed', err);
      setSaveError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignOut = async () => {
    if (signOutLoading) return;
    setSignOutLoading(true);
    setSignOutError('');
    try {
      await signOutWithCleanup();
      navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
    } catch (err) {
      console.error('handleConfirmSignOut failed', err);
      setSignOutError('Something went wrong. Please try again.');
    } finally {
      setSignOutLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: WHITE }} contentContainerStyle={{ padding: s(24) }}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s(28) }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="chevron-back" size={s(28)} color={NAVY} />
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(18), color: NAVY, marginLeft: s(4) }}>
          Back
        </Text>
      </TouchableOpacity>

      <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(28), color: NAVY, marginBottom: s(28) }}>
        Settings
      </Text>

      {!!loadError && <><Text style={{ color: DANGER }}>{loadError}</Text><Button title="Retry loading settings" onPress={loadProfile} /></>}
      {!!saveError && (
        <View style={{ backgroundColor: '#FDECEA', padding: s(12), borderRadius: 8, marginBottom: s(20) }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: DANGER }}>{saveError}</Text>
        </View>
      )}

      <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), color: NAVY, marginBottom: s(10) }}>
        Your details
      </Text>

      <View style={{ backgroundColor: SURFACE, padding: s(16), borderRadius: 8, marginBottom: s(24), flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: s(12) }}>
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), color: NAVY }}>Elder Mode</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(15), color: MUTED, marginTop: s(4) }}>
            Uses larger text and more spacious controls on the home screen.
          </Text>
        </View>
        <Switch
          value={elderMode}
          onValueChange={handleElderModeChange}
          trackColor={{ false: '#D7DCE5', true: '#9BB4D8' }}
          thumbColor={elderMode ? NAVY : '#FFFFFF'}
          accessibilityLabel="Elder Mode"
        />
      </View>

      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(18), color: NAVY, marginBottom: s(8) }}>
        Name
      </Text>
      <TextInput
        style={{
          fontFamily: 'DMSans_400Regular',
          borderWidth: 2,
          borderColor: NAVY,
          borderRadius: 8,
          padding: s(16),
          fontSize: s(22),
          color: NAVY,
          marginBottom: s(24),
        }}
        placeholder="Your name"
        placeholderTextColor={PLACEHOLDER}
        value={fullName}
        onChangeText={setFullName}
      />

      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(18), color: NAVY, marginBottom: s(8) }}>
        Phone
      </Text>
      <TextInput
        style={{
          fontFamily: 'DMSans_400Regular',
          borderWidth: 2,
          borderColor: NAVY,
          borderRadius: 8,
          padding: s(16),
          fontSize: s(22),
          color: NAVY,
          marginBottom: s(32),
        }}
        placeholder="+1 555 555 5555"
        placeholderTextColor={PLACEHOLDER}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <Button
        title={loading ? 'Saving' : 'Save changes'}
        onPress={handleSave}
        disabled={loading || !profileReady}
        loading={loading}
        style={{ paddingVertical: s(18), borderRadius: 8, marginBottom: s(16) }}
        textStyle={{ fontSize: s(20) }}
      />

      <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), color: NAVY, marginTop: s(8), marginBottom: s(10) }}>
        Account
      </Text>
      <TouchableOpacity
        onPress={() => { setSignOutError(''); setSignOutVisible(true); }}
        style={{
          backgroundColor: SURFACE,
          paddingVertical: s(18),
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(18), color: DANGER }}>
          Sign Out
        </Text>
      </TouchableOpacity>

      <Modal onRequestClose={() => { if (signOutLoading) return; setSignOutVisible(false); }} visible={signOutVisible} animationType="fade" transparent>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15,44,107,0.45)' }}>
          <View style={{ backgroundColor: WHITE, borderRadius: 10, padding: s(24), width: '85%' }}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(10) }}>
              Sign Out
            </Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(15), color: MUTED, marginBottom: s(18) }}>
              Are you sure you want to sign out? You will need a new code from your caregiver to reconnect.
            </Text>

            {!!signOutError && (
              <View style={{ backgroundColor: '#FDECEA', padding: s(10), borderRadius: 8, marginBottom: s(16) }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(13), color: DANGER }}>{signOutError}</Text>
              </View>
            )}

            <Button
              title={signOutLoading ? 'Signing Out' : 'Sign Out'}
              onPress={handleConfirmSignOut}
              disabled={signOutLoading}
              loading={signOutLoading}
              style={{ backgroundColor: DANGER, borderRadius: 8, marginBottom: s(8) }}
            />
            <Button
              title="Cancel"
              onPress={() => { if (signOutLoading) return; setSignOutVisible(false); }}
              style={{ backgroundColor: MUTED, borderRadius: 8 }}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
