import React from 'react';
import { Keyboard, Platform, Text, TouchableOpacity, View } from 'react-native';

export default function KeyboardDoneBar() {
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (!keyboardHeight) return null;

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: keyboardHeight, padding: 8, alignItems: 'flex-end', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EEEEEE', zIndex: 10, elevation: 10 }}>
      <TouchableOpacity onPress={() => Keyboard.dismiss()} style={{ backgroundColor: '#0F2C6B', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}