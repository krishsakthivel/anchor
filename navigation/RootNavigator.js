import * as React from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import useAppFonts from '../lib/useAppFonts';
import LoadingState from '../components/LoadingState';
import { setReminderUser } from '../lib/notifications';
const { withTimeout, initialDestination } = require('../lib/startup');

import LandingScreen from '../screens/LandingScreen';
import CaregiverLoginScreen from '../screens/CaregiverLoginScreen';
import CaregiverRegisterScreen from '../screens/CaregiverRegisterScreen';
import CaregiverTutorialScreen from '../screens/CaregiverTutorialScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import PatientHomeScreen from '../screens/PatientHomeScreen';
import CaregiverHomeScreen from '../screens/CaregiverHomeScreen';
import PatientDetailScreen from '../screens/PatientDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PatientProfileScreen from '../screens/PatientProfileScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import CareNotesScreen from '../screens/CareNotesScreen';
import MoodCheckinScreen from '../screens/MoodCheckinScreen';
import VitalsScreen from '../screens/VitalsScreen';
import WeeklyReportScreen from '../screens/WeeklyReportScreen';
import { supabase } from '../lib/supabase';

const Stack = createNativeStackNavigator();
const linking = {
  prefixes: ['anchor://', '/', 'http://localhost:8081'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
    },
  },
};

export default function RootNavigator() {
  const navigationRef = React.useRef(null);
  const [initialRoute, setInitialRoute] = React.useState(null);
  const [initialPatientId, setInitialPatientId] = React.useState(null);
  const [routeError, setRouteError] = React.useState(null);
  const [attempt, setAttempt] = React.useState(0);
  const [fontsLoaded, fontError, retryFonts] = useAppFonts();

  React.useEffect(() => {
    let active = true;
    let generation = 0;
    const timers = new Set();
    const loadRoute = async (suppliedSession, supplied = false) => {
      const current = ++generation;
      try {
        const destination = await withTimeout(async () => {
          let session = suppliedSession;
          if (!supplied) {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            session = data.session;
          }
          if (!active || current !== generation) return null;
          await setReminderUser(session?.user?.id || null);
          if (session && navigationRef.current?.getCurrentRoute()?.name === 'ResetPassword') return null;
          return initialDestination(supabase, session);
        });
        if (!active || current !== generation || !destination) return;
        setInitialPatientId(destination.patientId);
        setInitialRoute(destination.route);
        setRouteError(null);
      } catch (error) {
        if (active && current === generation) setRouteError(error);
      }
    };
    loadRoute();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      const timer = setTimeout(() => { timers.delete(timer); if (active) loadRoute(session, true); }, 0);
      timers.add(timer);
    });
    return () => { active = false; generation++; timers.forEach(clearTimeout); subscription.unsubscribe(); };
  }, [attempt]);

  const retry = () => {
    setRouteError(null);
    setInitialRoute(null);
    retryFonts();
    setAttempt(value => value + 1);
  };
  if (fontError || routeError || initialRoute === null || !fontsLoaded) {
    return <SafeAreaProvider><LoadingState error={fontError || routeError} onRetry={retry} /></SafeAreaProvider>;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
        <NavigationContainer ref={navigationRef} linking={linking}>
          <Stack.Navigator key={initialRoute} initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="CaregiverLogin" component={CaregiverLoginScreen} />
            <Stack.Screen name="CaregiverRegister" component={CaregiverRegisterScreen} />
            <Stack.Screen name="CaregiverTutorial" component={CaregiverTutorialScreen} options={{ headerBackButtonMenuEnabled: false }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            <Stack.Screen
              name="PatientHome"
              component={PatientHomeScreen}
              initialParams={initialRoute === 'PatientHome' ? { patientId: initialPatientId } : undefined}
            />
            <Stack.Screen name="CaregiverHome" component={CaregiverHomeScreen} />
            <Stack.Screen name="PatientDetail" component={PatientDetailScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="PatientProfile" component={PatientProfileScreen} />
            <Stack.Screen name="Appointments" component={AppointmentsScreen} />
            <Stack.Screen name="CareNotes" component={CareNotesScreen} />
            <Stack.Screen name="MoodCheckin" component={MoodCheckinScreen} />
            <Stack.Screen name="Vitals" component={VitalsScreen} />
            <Stack.Screen name="WeeklyReport" component={WeeklyReportScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
