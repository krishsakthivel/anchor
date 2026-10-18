import React, { useCallback, useState } from 'react';
import { ScrollView, RefreshControl, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import { NAVY, WHITE, MUTED, SURFACE, DANGER } from '../theme/colors';

export default function FamilyScreen({ navigation }) {
  const [code, setCode] = useState('');
  const [families, setFamilies] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error: requestError } = await supabase.rpc('family_status');
      if (requestError) throw requestError;
      setFamilies(data || []);
      setError('');
    } catch (err) { setError(err.message || 'Could not load family updates. Please try again.'); }
    finally { setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const join = async () => {
    if (saving || !/^\d{8}$/.test(code)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { data, error: claimError } = await supabase.rpc('claim_family_code', { p_code: code });
      if (claimError) throw claimError;
      if (!data) throw new Error('That code is invalid, expired, used, or too many attempts were made. Ask the caregiver for a new code or try later.');
      setCode('');
      setMessage('Family connected. You can now view their updates here.');
      await load();
    } catch (err) { setError(err.message || 'Could not join. Ask the caregiver for a new code.'); }
    finally { setSaving(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: WHITE }}
      contentContainerStyle={{ padding: 24, width: '100%', maxWidth: 600, alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
      <Button title="← Back" onPress={() => navigation.goBack()} style={{ alignSelf: 'flex-start', paddingHorizontal: 16, marginBottom: 20 }} />
      <Text style={{ color: NAVY, fontFamily: 'DMSans_700Bold', fontSize: 26, marginBottom: 12 }}>Family updates</Text>
      <Text style={{ color: MUTED, marginBottom: 16 }}>Enter the eight-digit family code from the caregiver. Family access shows medication status and care updates only.</Text>
      <TextInput accessibilityLabel="Family code" placeholder="8 digit family code" value={code} inputMode="numeric" keyboardType="number-pad"
        maxLength={8} onChangeText={value => setCode(value.replace(/\D/g, ''))} editable={!saving}
        style={{ borderWidth: 1.5, borderColor: NAVY, padding: 14, borderRadius: 8, fontSize: 18, marginBottom: 12 }} />
      <Button title="Join family" onPress={join} disabled={code.length !== 8 || saving} loading={saving} />
      {!!error && <Text accessibilityRole="alert" style={{ color: DANGER, marginTop: 12 }}>{error}</Text>}
      {!!message && <Text style={{ color: NAVY, marginTop: 12 }}>{message}</Text>}
      <Button title="Refresh family updates" onPress={load} disabled={refreshing} style={{ marginVertical: 20 }} />
      {!refreshing && !error && families.length === 0 && <Text style={{ color: MUTED }}>No family connected yet.</Text>}
      {families.map(family => <View key={family.patient_id} style={{ backgroundColor: SURFACE, padding: 18, borderRadius: 8, marginBottom: 12 }}>
        <Text style={{ color: NAVY, fontFamily: 'DMSans_700Bold', fontSize: 20 }}>{family.patient_name}</Text>
        <Text style={{ color: NAVY, marginTop: 8 }}>{family.medication_status}</Text>
        <Text style={{ color: NAVY, marginTop: 8 }}>{family.care_status}</Text>
      </View>)}
    </ScrollView>
  );
}
