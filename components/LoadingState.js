import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

export default function LoadingState({ error, onRetry }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    {error ? <>
      <Text accessibilityRole="header" style={{ color: '#0F2C6B', fontSize: 22, marginBottom: 12 }}>Could not load Anchor</Text>
      <Text accessibilityRole="alert" style={{ textAlign: 'center', marginBottom: 20 }}>{error.message || 'Please check your connection and try again.'}</Text>
      <TouchableOpacity onPress={onRetry} accessibilityRole="button" accessibilityLabel="Try again" style={{ backgroundColor: '#0F2C6B', padding: 16, borderRadius: 8 }}>
        <Text style={{ color: 'white', fontSize: 18 }}>Try again</Text>
      </TouchableOpacity>
    </> : <ActivityIndicator size="large" color="#0F2C6B" />}
  </View>;
}
