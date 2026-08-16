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
} from 'react-native';
import styles from './CaregiverLoginScreen.styles';
import { PLACEHOLDER, WHITE } from '../theme/colors';
import { supabase } from '../lib/supabase';
import useCustomFonts from '../lib/useCustomFonts';
import Button from '../components/Button';

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function CaregiverLoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { width, height } = useWindowDimensions();
  const { fontsLoaded, FontProvider } = useCustomFonts();

  if (!fontsLoaded) return <FontProvider />;

  const scale = width / 375;
  const s = (size) => Math.round(size * scale);

  const handleLogin = async () => {
    setError('');

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    navigation.navigate('CaregiverHome');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.centerContent}>
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
          placeholder="••••••••"
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
      </View>
    </KeyboardAvoidingView>
  );
}
