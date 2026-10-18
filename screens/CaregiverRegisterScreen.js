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
import { PLACEHOLDER, WHITE } from '../theme/colors';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
const { TUTORIAL_VERSION } = require('../lib/caregiverTutorial');

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function CaregiverRegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { width, height } = useWindowDimensions();


  const scale = Math.min(1.08, Math.max(0.95, width / 375));
  const s = (size) => Math.round(size * scale);

  const handleRegister = async () => {
    setError('');

    if (!isValidEmail(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    let data;
    let signUpError;
    try {
      ({ data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { role: 'caregiver', caregiver_tutorial_version: TUTORIAL_VERSION, caregiver_tutorial_completed: false },
        },
      }));
    } catch (err) {
      console.error('signUp failed', err);
      setLoading(false);
      setError('Could not connect. Please try again.');
      return;
    }

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (!data.session) {
      navigation.navigate('CaregiverLogin', { registrationPending: true });
      return;
    }

    navigation.navigate('CaregiverTutorial');
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
          Create Caregiver Account
        </Text>
        <Text
          style={[styles.subtitle, { fontSize: s(15), marginBottom: height * 0.04, paddingHorizontal: s(10) }]}
        >
          Set up your account to start caring.
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

        <Text style={[styles.label, { fontSize: s(15), marginBottom: height * 0.01 }]}>Password</Text>
        <TextInput
          style={[
            styles.input,
            { fontSize: s(16), paddingVertical: s(12), paddingHorizontal: s(14), marginBottom: height * 0.02 },
          ]}
          placeholder="Password"
          placeholderTextColor={PLACEHOLDER}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={[styles.label, { fontSize: s(15), marginBottom: height * 0.01 }]}>Confirm Password</Text>
        <TextInput
          style={[
            styles.input,
            { fontSize: s(16), paddingVertical: s(12), paddingHorizontal: s(14), marginBottom: height * 0.02 },
          ]}
          placeholder="Repeat password"
          placeholderTextColor={PLACEHOLDER}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        {error ? (
          <Text style={[styles.errorText, { fontSize: s(13), marginBottom: height * 0.02 }]}>{error}</Text>
        ) : null}

        <Button
          title="Create Account"
          onPress={handleRegister}
          disabled={!email || !password || !confirmPassword || loading}
          loading={loading}
          style={{ marginBottom: height * 0.02 }}
        />

        <Text style={[styles.registerText, { fontSize: s(14), marginBottom: height * 0.02 }]}>
          Already have an account?{' '}
          <Text style={styles.registerLink} onPress={() => navigation.navigate('CaregiverLogin')}>
            Log in
          </Text>
        </Text>

        <Text style={[styles.backLink, { fontSize: s(14) }]} onPress={() => navigation.goBack()}>
          ← Back
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
