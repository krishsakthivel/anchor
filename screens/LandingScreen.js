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
} from 'react-native';
import styles from './LandingScreen.styles';
import { PLACEHOLDER } from '../theme/colors';
import useCustomFonts from '../lib/useCustomFonts';
import Button from '../components/Button';

export default function LandingScreen({ navigation }) {
  const [code, setCode] = useState('');
  const { width, height } = useWindowDimensions();
  const { fontsLoaded, FontProvider } = useCustomFonts();

  const heroFade = useRef(new Animated.Value(0)).current;
  const labelFade = useRef(new Animated.Value(0)).current;
  const inputFade = useRef(new Animated.Value(0)).current;
  const footerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!fontsLoaded) return;

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
  }, [fontsLoaded]);

  if (!fontsLoaded) return <FontProvider />;

  const scale = width / 375;
  const s = (size) => Math.round(size * scale);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.centerContent}>
        <Animated.View style={[styles.hero, { opacity: heroFade }]}>
          <Image
            source={require('../assets/logo.png')}
            style={{ width: s(110), height: s(110), marginBottom: height * 0.03 }}
            resizeMode="contain"
          />
          <Text style={[styles.tagline, { fontSize: s(19), lineHeight: s(27), paddingHorizontal: s(10) }]}>
            The simplest app to anchor a caregiver and a patient together.
          </Text>
        </Animated.View>

        <View style={[styles.formSection, { marginTop: height * 0.05 }]}>
          <Animated.Text
            style={[
              styles.label,
              { fontSize: s(17), marginBottom: height * 0.015, opacity: labelFade, textAlign: 'center' },
            ]}
          >
            Enter the code your caregiver gave you :)
          </Animated.Text>
          <Animated.View style={{ opacity: inputFade }}>
            <TextInput
              style={[styles.input, { fontSize: s(22), paddingVertical: s(18), paddingHorizontal: s(16), textAlign: 'center', letterSpacing: s(2) }]}
              placeholder="Enter 6 digit code"
              placeholderTextColor={PLACEHOLDER}
              value={code}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={6}
              onChangeText={setCode}
            />
            <Button
              title="Continue"
              onPress={() => navigation.navigate('PatientHome', { code })}
              disabled={code.length !== 6}
              style={{ marginTop: height * 0.02 }}
            />
          </Animated.View>
        </View>
      </View>

      <Animated.View style={[styles.footer, { marginBottom: height * 0.05, opacity: footerFade }]}>
        <Text style={[styles.footerText, { fontSize: s(15) }]}>
          Caregiver?{' '}
          <Text style={styles.footerLink} onPress={() => navigation.navigate('CaregiverLogin')}>
            Click here.
          </Text>
        </Text>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
