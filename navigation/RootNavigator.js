import * as React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LandingScreen from '../screens/LandingScreen';
import CaregiverLoginScreen from '../screens/CaregiverLoginScreen';
import CaregiverRegisterScreen from '../screens/CaregiverRegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import PatientHomeScreen from '../screens/PatientHomeScreen';
import CaregiverHomeScreen from '../screens/CaregiverHomeScreen';
import PatientDetailScreen from '../screens/PatientDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { supabase } from '../lib/supabase';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const [initialRoute, setInitialRoute] = React.useState(null);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setInitialRoute(session ? 'CaregiverHome' : 'Landing');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (initialRoute === null) return;
      setInitialRoute(session ? 'CaregiverHome' : 'Landing');
    });

    return () => subscription.unsubscribe();
  }, []);

  if (initialRoute === null) {
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
            <Stack.Screen name="PatientHome" component={PatientHomeScreen} />
            <Stack.Screen name="CaregiverHome" component={CaregiverHomeScreen} />
            <Stack.Screen name="PatientDetail" component={PatientDetailScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
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
