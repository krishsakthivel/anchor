import { signOutWithCleanup } from '../lib/session';
import React, { useEffect, useState } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';
import { NAVY, PLACEHOLDER, DANGER } from '../theme/colors';

const { establishRecoverySession } = require('../lib/authRecovery');
const { withTimeout } = require('../lib/startup');

export default function ResetPasswordScreen({ navigation }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    let generation = 0;
    const establishSession = async (url) => {
      const current = ++generation;
      if (mounted) { setReady(false); setError(''); }
      try {
        const hasSession = await withTimeout(() => establishRecoverySession(supabase.auth, url));
        if (mounted && current === generation) setReady(hasSession);
      } catch (error) {
        if (mounted && current === generation) { setReady(false); setError(error.message || 'Could not open this reset link. Request a new one.'); }
      }
    };

    Linking.getInitialURL().then(establishSession).catch(error => { if (mounted) setError(error.message || 'Could not open the reset link.'); });
    const subscription = Linking.addEventListener('url', ({ url }) => establishSession(url));
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted && event === 'SIGNED_OUT') setReady(false);
    });

    return () => {
      mounted = false;
      subscription.remove();
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleUpdate = async () => {
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || 'Could not update your password.');
        return;
      }
      await signOutWithCleanup();
      navigation.reset({ index: 0, routes: [{ name: 'CaregiverLogin' }] });
    } catch (err) {
      console.error('password update failed', err);
      setError('Could not connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 28, color: NAVY, marginBottom: 10 }}>Choose a new password</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#666', marginBottom: 24 }}>
          {ready ? 'Enter a new password for your caregiver account.' : 'Open this screen from the reset link in your email.'}
        </Text>
        {!!error && <Text style={{ fontFamily: 'DMSans_500Medium', color: DANGER, marginBottom: 16 }}>{error}</Text>}
        <TextInput
          style={{ borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 12 }}
          placeholder="New password"
          placeholderTextColor={PLACEHOLDER}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={ready && !loading}
        />
        <TextInput
          style={{ borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 18 }}
          placeholder="Confirm new password"
          placeholderTextColor={PLACEHOLDER}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={ready && !loading}
        />
        <Button title={loading ? 'Saving' : 'Save new password'} onPress={handleUpdate} disabled={!ready || loading} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
