import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import styles from './PlaceholderHome.styles';

export default function PatientHomeScreen({ route }) {
  const { width } = useWindowDimensions();
  const scale = width / 375;
  const s = (size) => Math.round(size * scale);

  const code = route?.params?.code;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { fontSize: s(24), marginBottom: s(8) }]}>Patient Home</Text>
      <Text style={[styles.subtitle, { fontSize: s(15) }]}>
        {code ? `Anchored with code ${code}` : 'Placeholder screen'}
      </Text>
    </View>
  );
}