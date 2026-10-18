import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import styles from './CaregiverLoginScreen.styles';
import { PLACEHOLDER, WHITE } from '../theme/colors';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
const { needsCaregiverTutorial } = require('../lib/caregiverTutorial');

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function CaregiverLoginScreen({ navigation, route }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { width, height } = useWindowDimensions();


  const scale = Math.min(1.08, Math.max(0.95, width / 375));
  const s = (size) => Math.round(size * scale);

  const handleLogin = async () => {
    setError('');

    if (!isValidEmail(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    let signInError;
    let data;
    try {
      ({ data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      }));
    } catch (err) {
      console.error('signInWithPassword failed', err);
      setLoading(false);
      setError('Could not connect. Please try again.');
      return;
    }

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    navigation.navigate(needsCaregiverTutorial(data?.user || data?.session?.user) ? 'CaregiverTutorial' : 'CaregiverHome');
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
          Caregiver Login
        </Text>
        <Text
          style={[styles.subtitle, { fontSize: s(15), marginBottom: height * 0.04, paddingHorizontal: s(10) }]}
        >
          Sign in to manage your patient's care.
        </Text>

        {!!route?.params?.registrationPending && <Text style={[styles.subtitle, { fontSize: s(14), marginBottom: s(16) }]}>Check your email for account confirmation, then log in to start your caregiver tutorial.</Text>}
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

        {error ? (
          <Text style={[styles.errorText, { fontSize: s(13), marginBottom: height * 0.02 }]}>{error}</Text>
        ) : null}

        <Button
          title="Log In"
          onPress={handleLogin}
          disabled={!email || !password || loading}
          loading={loading}
          style={{ marginBottom: height * 0.02 }}
        />

        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={[styles.registerText, { fontSize: s(14), marginBottom: height * 0.02 }]}>
            Forgot password?
          </Text>
        </TouchableOpacity>

        <Text style={[styles.registerText, { fontSize: s(14), marginBottom: height * 0.02 }]}>
          Don't have an account?{' '}
          <Text style={styles.registerLink} onPress={() => navigation.navigate('CaregiverRegister')}>
            Register
          </Text>
        </Text>

        <Text style={[styles.backLink, { fontSize: s(14) }]} onPress={() => navigation.goBack()}>
          ← Back
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
