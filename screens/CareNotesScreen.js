import { useFocusEffect } from '@react-navigation/native';
import { appAlert as Alert } from '../components/AppDialog';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  useWindowDimensions,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import useCustomFonts from '../lib/useCustomFonts';
import Button from '../components/Button';
import { NAVY, WHITE, PLACEHOLDER } from '../theme/colors';

export default function CareNotesScreen({ route, navigation }) {
  const { patientId, patientName, isPatient } = route.params;
  const { width } = useWindowDimensions();
  const { fontsLoaded, FontProvider } = useCustomFonts();
  const [notes, setNotes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [addVisible, setAddVisible] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [loading, setLoading] = useState(false);

  const scale = Math.min(1.08, Math.max(0.95, width / 375));
  const s = (size) => Math.round(size * scale);

  const fetchNotes = async () => {
    try {
    const { data, error } = await supabase
      .from('care_notes')
      .select('*')
      .eq('patient_id', patientId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    setNotes(data || []);
    setLoadError('');
    } catch (error) { setLoadError(error.message || 'Could not load care notes. Please refresh to try again.'); }
  };

  useFocusEffect(useCallback(() => { fetchNotes(); }, [patientId]));

  const onRefresh = async () => {
    setRefreshing(true);
    try { await fetchNotes();
    } catch (error) { Alert.alert('Could not refresh', error.message || 'Please try again.'); }
    finally { setRefreshing(false); }
  };

  if (!fontsLoaded) return <FontProvider />;

  const handleAddNote = async () => {
    if (!noteTitle.trim() || !noteBody.trim()) return;
    setLoading(true);
    try {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      Alert.alert('Session expired', 'Please sign in again before adding a note.');
      return;
    }
    const { error } = await supabase
      .from('care_notes')
      .insert({
        patient_id: patientId,
        created_by: user.id,
        title: noteTitle.trim(),
        body: noteBody.trim(),
      });

    setLoading(false);
    if (error) {
      Alert.alert('Error', 'Failed to add note.');
      return;
    }

    setAddVisible(false);
    setNoteTitle('');
    setNoteBody('');
    fetchNotes();
    } catch (error) {
      Alert.alert('Could not save', error.message || 'Please try again.');
    } finally { setLoading(false); }
  };

  const handleTogglePin = async (note) => {
    try {
    const { error } = await supabase
      .from('care_notes')
      .update({ pinned: !note.pinned })
      .eq('id', note.id);
    if (error) { Alert.alert('Could not pin note', error.message || 'Please try again.'); return; }
    await fetchNotes();
    } catch (error) { Alert.alert('Could not update', error.message || 'Please try again.'); }
  };

  const handleDelete = async (noteId) => {
    Alert.alert('Delete Note', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('care_notes').delete().eq('id', noteId);
          if (error) { Alert.alert('Could not delete note', error.message || 'Please try again.'); return; }
          await fetchNotes();
        },
      },
    ]);
  };

  return (
    <FlatList
      data={[]}
      renderItem={null}
      ListHeaderComponent={
        <View style={{ padding: s(20) }}>
          {!!loadError && <Text accessibilityRole="alert" style={{ color: '#C0392B', marginBottom: s(12) }}>{loadError}</Text>}
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" style={{ marginBottom: s(16) }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY }}>← Back</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s(16) }}>
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(22), color: NAVY }}>Care Notes</Text>
            {!isPatient && (
              <TouchableOpacity onPress={() => setAddVisible(true)}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(14), color: NAVY }}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>

          {notes.length === 0 ? (
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(14), color: '#666' }}>
              No notes yet
            </Text>
          ) : (
            notes.map((note) => (
              <TouchableOpacity
                key={note.id}
                onLongPress={() => !isPatient && handleDelete(note.id)}
                style={{
                  backgroundColor: note.pinned ? '#FFF8E1' : '#F5F5F5',
                  padding: s(14),
                  borderRadius: 8,
                  marginBottom: s(8),
                  borderLeftWidth: note.pinned ? 3 : 0,
                  borderLeftColor: NAVY,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(15), color: NAVY, flex: 1 }}>
                    {note.pinned ? '📌 ' : ''}{note.title}
                  </Text>
                  {!isPatient && (
                    <TouchableOpacity onPress={() => handleTogglePin(note)} accessibilityRole="button" accessibilityLabel={`${note.pinned ? 'Unpin' : 'Pin'} ${note.title}`} style={{ minHeight: s(44), justifyContent: 'center', paddingHorizontal: s(6) }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: '#666' }}>
                        {note.pinned ? 'Unpin' : 'Pin'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: '#333', marginTop: s(4) }}>
                  {note.body}
                </Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s(13), color: '#666', marginTop: s(6) }}>
                  {new Date(note.created_at).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListFooterComponent={
        <Modal onRequestClose={() => { if (loading) return; setAddVisible(false); }} visible={addVisible} animationType="slide" transparent>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: s(24) }} keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: WHITE, borderRadius: 12, padding: s(24), width: '85%', maxWidth: 440 }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: s(20), color: NAVY, marginBottom: s(16) }}>Add Note</Text>

              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Title</Text>
              <TextInput
                style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, marginBottom: s(12) }}
                placeholder="e.g. Medication reminder"
                placeholderTextColor={PLACEHOLDER}
                value={noteTitle}
                onChangeText={setNoteTitle}
              />

              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: s(14), color: NAVY, marginBottom: s(4) }}>Note</Text>
              <TextInput
                style={{ fontFamily: 'DMSans_400Regular', borderWidth: 1.5, borderColor: NAVY, borderRadius: 8, padding: s(12), fontSize: s(16), color: NAVY, height: s(100), textAlignVertical: 'top', marginBottom: s(16) }}
                placeholder="Write your note here"
                placeholderTextColor={PLACEHOLDER}
                value={noteBody}
                onChangeText={setNoteBody}
                multiline
              />

              <Button title={loading ? 'Adding' : 'Add Note'} onPress={handleAddNote} disabled={!noteTitle.trim() || !noteBody.trim() || loading} loading={loading} style={{ marginBottom: s(8) }} />
              <Button title="Cancel" onPress={() => { setAddVisible(false); setNoteTitle(''); setNoteBody(''); }} style={{ backgroundColor: '#999' }} />
            </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      }
    />
  );
}
