import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LandingScreen from '../screens/LandingScreen';
import CaregiverLoginScreen from '../screens/CaregiverLoginScreen';
import CaregiverRegisterScreen from '../screens/CaregiverRegisterScreen';
import PatientHomeScreen from '../screens/PatientHomeScreen';
import CaregiverHomeScreen from '../screens/CaregiverHomeScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Landing" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="CaregiverLogin" component={CaregiverLoginScreen} />
        <Stack.Screen name="CaregiverRegister" component={CaregiverRegisterScreen} />
        <Stack.Screen name="PatientHome" component={PatientHomeScreen} />
        <Stack.Screen name="CaregiverHome" component={CaregiverHomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}