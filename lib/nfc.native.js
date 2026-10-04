import { Platform } from 'react-native';
const { locationTagText, tokenFromLocationTag } = require('./checkinTag');


async function prepare() {
  try {
    const { default: NfcManager, Ndef, NfcTech } = require('react-native-nfc-manager');
    if (!(await NfcManager.isSupported())) throw new Error('This phone does not support NFC.');
    await NfcManager.start();
    if (!(await NfcManager.isEnabled())) throw new Error('Turn on NFC in your phone settings and try again.');
    return { NfcManager, Ndef, NfcTech };
  } catch (error) {
    if (error.message?.includes('does not support') || error.message?.includes('Turn on NFC')) throw error;
    throw new Error('NFC needs an installed Anchor app build. It is not available in Expo Go.');
  }
}

export async function writeLocationTag(token) {
  const { NfcManager, Ndef, NfcTech } = await prepare();
  try {
    const technology = await NfcManager.requestTechnology(Platform.OS === 'android' ? [NfcTech.Ndef, NfcTech.NdefFormatable] : NfcTech.Ndef);
    const message = Ndef.encodeMessage([Ndef.textRecord(locationTagText(token))]);
    if (!message) throw new Error('Could not prepare this sticker.');
    if (technology === NfcTech.NdefFormatable) await NfcManager.ndefFormatableHandlerAndroid.formatNdef(message);
    else await NfcManager.ndefHandler.writeNdefMessage(message);
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export async function readLocationTag() {
  const { NfcManager, Ndef, NfcTech } = await prepare();
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    const record = tag?.ndefMessage?.find((item) => Ndef.isType(item, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT));
    const text = record ? Ndef.text.decodePayload(record.payload) : '';
    return tokenFromLocationTag(text);
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}
