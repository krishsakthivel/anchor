import * as React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';

import LandingScreen from '../screens/LandingScreen';
import CaregiverLoginScreen from '../screens/CaregiverLoginScreen';
import CaregiverRegisterScreen from '../screens/CaregiverRegisterScreen';
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
  const [initialRoute, setInitialRoute] = React.useState(null);
  const [initialPatientId, setInitialPatientId] = React.useState(null);
  // Ref mirror of initialRoute: the auth-state subscription closes over the
  // first render's state, so reading the state variable inside its callback
  // would always see null.
  const initialRouteRef = React.useRef(null);
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  React.useEffect(() => {
    const resolveRoute = async (session) => {
      let route;
      setInitialPatientId(null);
      if (!session) {
        route = 'Landing';
      } else if (session.user?.is_anonymous) {
        // Patients authenticate anonymously (no email/password), so an
        // anonymous session means this is a patient, not a caregiver.
        const { data: patientRow } = await supabase
          .from('patients')
          .select('id')
          .eq('paired_user_id', session.user.id)
          .maybeSingle();

        if (patientRow) {
          setInitialPatientId(patientRow.id);
          route = 'PatientHome';
        } else {
          route = 'Landing';
        }
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile?.role === 'patient') {
          const { data: patientRow } = await supabase
            .from('patients')
            .select('id')
            .eq('paired_user_id', session.user.id)
            .maybeSingle();
          setInitialPatientId(patientRow?.id || null);
          route = 'PatientHome';
        } else {
          route = 'CaregiverHome';
        }
      }

      initialRouteRef.current = route;
      setInitialRoute(route);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveRoute(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (initialRouteRef.current === null) return;
      resolveRoute(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (initialRoute === null || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#0F2C6B" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
        <NavigationContainer linking={linking}>
          <Stack.Navigator key={initialRoute} initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="CaregiverLogin" component={CaregiverLoginScreen} />
            <Stack.Screen name="CaregiverRegister" component={CaregiverRegisterScreen} />
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

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
