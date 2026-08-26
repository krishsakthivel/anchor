import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import RootNavigator from './navigation/RootNavigator';
import ErrorBoundary from './components/ErrorBoundary';
import KeyboardDoneBar from './components/KeyboardDoneBar';

export default function App() {
  const [bigText, setBigText] = React.useState(false);
  const textScale = bigText ? 1.12 : 1;
  const textButton = bigText ? 'Smaller Text' : 'Bigger Text';

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, transform: [{ scale: textScale }], transformOrigin: 'center top' }}>
          <RootNavigator />
        </View>
        <KeyboardDoneBar />
        <TouchableOpacity
          onPress={() => setBigText(!bigText)}
          style={{ position: 'absolute', top: 55, right: 16, backgroundColor: bigText ? '#B7D4EA' : '#DEEEFA', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, zIndex: 10, elevation: 10 }}
        >
          <Text style={{ color: '#0F2C6B', fontSize: 16, fontWeight: '700' }}>{textButton}</Text>
        </TouchableOpacity>
      </View>
    </ErrorBoundary>
  );
}
