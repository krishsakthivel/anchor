import React, { useEffect, useState } from 'react';
import { Alert as NativeAlert, Modal, Platform, ScrollView, Text, View, StyleSheet } from 'react-native';
import Button from './Button';
import { NAVY, WHITE, MUTED, DANGER } from '../theme/colors';

const queue = [];
const listeners = new Set();
const notify = () => listeners.forEach(listener => listener(queue[0] || null));

export const appAlert = {
  alert(title, message = '', buttons = [{ text: 'OK' }]) {
    if (Platform.OS !== 'web' && buttons.length <= 3) {
      NativeAlert.alert(title, message, buttons.map(button => ({ ...button,
        onPress: button.onPress ? async () => {
          try { await button.onPress(); }
          catch { appAlert.alert('Could not complete action', 'Please try again.'); }
        } : undefined,
      })));
      return;
    }
    queue.push({ title, message, buttons });
    notify();
  },
};

export function AppDialogHost() {
  const [dialog, setDialog] = useState(queue[0] || null);
  useEffect(() => {
    listeners.add(setDialog);
    setDialog(queue[0] || null);
    return () => listeners.delete(setDialog);
  }, []);

  const choose = async (button) => {
    if (!dialog || queue[0] !== dialog) return;
    queue.shift();
    notify();
    try { await button.onPress?.(); }
    catch { appAlert.alert('Could not complete action', 'Please try again.'); }
  };
  const dismiss = () => {
    const cancel = dialog?.buttons.find(button => button.style === 'cancel');
    if (cancel) choose(cancel);
  };

  return (
    <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal role="dialog" aria-label={dialog?.title}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{dialog?.title}</Text>
            {!!dialog?.message && <Text style={styles.message}>{dialog.message}</Text>}
            {dialog?.buttons.map((button, index) => (
              <Button key={index} title={button.text || 'OK'} onPress={() => choose(button)}
                style={{ marginTop: 10, backgroundColor: button.style === 'destructive' ? DANGER : button.style === 'cancel' ? MUTED : NAVY }} />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,44,107,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, maxHeight: '90%', backgroundColor: WHITE, borderRadius: 12 },
  content: { padding: 24 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 22, color: NAVY, marginBottom: 12 },
  message: { fontFamily: 'DMSans_400Regular', fontSize: 16, color: NAVY },
});
