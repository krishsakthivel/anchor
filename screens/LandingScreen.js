import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Animated,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import styles from './LandingScreen.styles';
import { PLACEHOLDER } from '../theme/colors';
import Button from '../components/Button';

export default function LandingScreen({ navigation }) {
  const [code, setCode] = useState('');
  const { width, height } = useWindowDimensions();

  const heroFade = useRef(new Animated.Value(0)).current;
  const labelFade = useRef(new Animated.Value(0)).current;
  const inputFade = useRef(new Animated.Value(0)).current;
  const footerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(labelFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(inputFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(footerFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);


  const scale = Math.min(1.08, Math.max(0.95, width / 375));
  const s = (size) => Math.round(size * scale);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={[styles.centerContent, { flexGrow: 1 }]} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.hero, { opacity: heroFade }]}>
          <Image
            source={require('../assets/logo.png')}
            style={{ width: s(110), height: s(110), marginBottom: height * 0.03 }}
            resizeMode="contain"
          />
          <Text style={[styles.tagline, { fontSize: s(19), lineHeight: s(27), paddingHorizontal: s(10) }]}>
            Make your life simple, with your caregiver next to you.
          </Text>
        </Animated.View>

        <View style={[styles.formSection, { marginTop: height * 0.05 }]}>
          <Animated.Text
            style={[
              styles.label,
              { fontSize: s(17), marginBottom: height * 0.015, opacity: labelFade, textAlign: 'center' },
            ]}
          >
             Enter the eight-digit code from your caregiver
          </Animated.Text>
          <Animated.View style={{ opacity: inputFade }}>
            <TextInput
              style={[styles.input, { fontSize: s(22), paddingVertical: s(18), paddingHorizontal: s(16), textAlign: 'center', letterSpacing: s(2) }]}
               placeholder="Enter 8 digit code"
              placeholderTextColor={PLACEHOLDER}
              value={code}
              keyboardType="number-pad"
              inputMode="numeric"
               maxLength={8}
               onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
            />
            <Button
              title="Continue"
              onPress={() => navigation.navigate('PatientHome', { code })}
               disabled={code.length !== 8}
              style={{ marginTop: height * 0.02 }}
            />
          </Animated.View>
        </View>
      </ScrollView>

      <Animated.View style={[styles.footer, { marginBottom: height * 0.05, opacity: footerFade }]}>
        <Text style={[styles.footerText, { fontSize: s(15) }]}>
          Are you a caregiver?{' '}
          <Text style={styles.footerLink} onPress={() => navigation.navigate('CaregiverLogin')}>
            Sign in.
          </Text>
        </Text>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
