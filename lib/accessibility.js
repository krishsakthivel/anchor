import AsyncStorage from '@react-native-async-storage/async-storage';

const ELDER_MODE_KEY = 'anchor.elder-mode';

export async function getElderMode() {
  return (await AsyncStorage.getItem(ELDER_MODE_KEY)) === 'true';
}

export async function setElderMode(enabled) {
  await AsyncStorage.setItem(ELDER_MODE_KEY, String(enabled));
}