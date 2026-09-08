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
import PatientHomeScreen from '../screens/PatientHomeScreen';
import CaregiverHomeScreen from '../screens/CaregiverHomeScreen';
import PatientDetailScreen from '../screens/PatientDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PatientProfileScreen from '../screens/PatientProfileScreen';
import { supabase } from '../lib/supabase';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const [initialRoute, setInitialRoute] = React.useState(null);
  const [initialPatientId, setInitialPatientId] = React.useState(null);
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  React.useEffect(() => {
    const resolveRoute = async (session) => {
      if (!session) {
        setInitialRoute('Landing');
        return;
      }

      // Patients authenticate anonymously (no email/password), so an
      // anonymous session means this is a patient, not a caregiver.
      if (session.user?.is_anonymous) {
        const { data: patientRow } = await supabase
          .from('patients')
          .select('id')
          .eq('paired_user_id', session.user.id)
          .single();

        if (patientRow) {
          setInitialPatientId(patientRow.id);
          setInitialRoute('PatientHome');
          return;
        }
      }

      setInitialRoute('CaregiverHome');
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveRoute(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (initialRoute === null) return;
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
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="CaregiverLogin" component={CaregiverLoginScreen} />
            <Stack.Screen name="CaregiverRegister" component={CaregiverRegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen
              name="PatientHome"
              component={PatientHomeScreen}
              initialParams={initialRoute === 'PatientHome' ? { patientId: initialPatientId } : undefined}
            />
            <Stack.Screen name="CaregiverHome" component={CaregiverHomeScreen} />
            <Stack.Screen name="PatientDetail" component={PatientDetailScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="PatientProfile" component={PatientProfileScreen} />
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