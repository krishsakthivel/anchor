import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import styles from './CaregiverLoginScreen.styles';
import { PLACEHOLDER } from '../theme/colors';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { width, height } = useWindowDimensions();


  const scale = Math.min(1.08, Math.max(0.95, width / 375));
  const s = (size) => Math.round(size * scale);

  const handleReset = async () => {
    setError('');
    setSuccess(false);

    if (!isValidEmail(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    let resetError;
    try {
      const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password`
        : 'anchor://reset-password';
      ({ error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      }));
    } catch (err) {
      console.error('resetPasswordForEmail failed', err);
      setLoading(false);
      setError('Could not connect. Please try again.');
      return;
    }

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccess(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={[styles.centerContent, { flexGrow: 1 }]} keyboardShouldPersistTaps="handled">
        <Image
          source={require('../assets/logo.png')}
          style={[styles.logo, { width: s(70), height: s(70), marginBottom: height * 0.02 }]}
          resizeMode="contain"
        />

        <Text style={[styles.title, { fontSize: s(24), marginBottom: height * 0.01 }]}>
          Reset Password
        </Text>
        <Text
          style={[styles.subtitle, { fontSize: s(15), marginBottom: height * 0.04, paddingHorizontal: s(10) }]}
        >
          Enter your email and we'll send you a reset link.
        </Text>

        <Text style={[styles.label, { fontSize: s(15), marginBottom: height * 0.01 }]}>Email</Text>
        <TextInput
          style={[
            styles.input,
            { fontSize: s(16), paddingVertical: s(12), paddingHorizontal: s(14), marginBottom: height * 0.02 },
          ]}
          placeholder="you@example.com"
          placeholderTextColor={PLACEHOLDER}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {error ? (
          <Text style={[styles.errorText, { fontSize: s(13), marginBottom: height * 0.02 }]}>{error}</Text>
        ) : null}

        {success ? (
          <Text style={[styles.registerLink, { fontSize: s(14), marginBottom: height * 0.02, textAlign: 'center' }]}>
            Check your email for the reset link.
          </Text>
        ) : null}

        <Button
          title="Send Reset Link"
          onPress={handleReset}
          disabled={!email || loading}
          loading={loading}
          style={{ marginBottom: height * 0.02 }}
        />

        <Text style={[styles.backLink, { fontSize: s(14) }]} onPress={() => navigation.goBack()}>
          ← Back to Login
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
