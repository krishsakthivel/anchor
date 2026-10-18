import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePreventRemove } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { signOutWithCleanup } from '../lib/session';
import { CaregiverTourContext } from '../components/CaregiverTour';
import { CareAction, CareError } from '../components/CarePlanUI';
import Button from '../components/Button';
import CaregiverHomeScreen from './CaregiverHomeScreen';
import ProfileScreen from './ProfileScreen';
import PatientDetailScreen from './PatientDetailScreen';
import AppointmentsScreen from './AppointmentsScreen';
import { NAVY, WHITE, SURFACE, BORDER, MUTED } from '../theme/colors';
const { STEPS, TUTORIAL_VERSION, needsCaregiverTutorial } = require('../lib/caregiverTutorial');
const { createTourClient } = require('../lib/tourClient');
const { withTimeout } = require('../lib/startup');
const SCREENS = { CaregiverHome: CaregiverHomeScreen, Profile: ProfileScreen, PatientDetail: PatientDetailScreen, Appointments: AppointmentsScreen };

export default function CaregiverTutorialScreen({ navigation }) {
  const [index, setIndex] = useState(0);
  const [view, setView] = useState('CaregiverHome');
  const [client, setClient] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const userId = useRef(null), current = useRef(0), finished = useRef(false), alive = useRef(true), queue = useRef(Promise.resolve());
  const step = STEPS[index];
  const canContinue = !!step.next && (!step.write || completed.includes(step.id));
  const storageKey = id => `anchor.caregiver-walkthrough.${TUTORIAL_VERSION}.${id}`;
  const persist = (position, dataClient, done) => {
    if (!userId.current) return;
    const value = JSON.stringify({ index: position, stepId: STEPS[position].id, tables: dataClient.snapshot(), completed: done });
    queue.current = queue.current.catch(() => {}).then(() => AsyncStorage.setItem(storageKey(userId.current), value));
    queue.current.catch(() => { if (alive.current) setError('Could not save your place. Keep this walkthrough open, or try again before leaving.'); });
  };
  const load = async () => {
    setError('');
    try {
      const { data: { user }, error: authError } = await withTimeout(() => supabase.auth.getUser());
      if (authError || !user || user.is_anonymous) throw new Error('Please sign in with your caregiver account.');
      if (!needsCaregiverTutorial(user)) {
        finished.current = true;
        navigation.reset({ index: 0, routes: [{ name: 'CaregiverHome' }] });
        return;
      }
      let saved = null;
      const raw = await AsyncStorage.getItem(storageKey(user.id));
      try { saved = raw ? JSON.parse(raw) : null; } catch {}
      if (!saved?.tables || typeof saved.tables !== 'object' || Array.isArray(saved.tables) || !Object.values(saved.tables).every(Array.isArray)) saved = null;
      const namedPosition = STEPS.findIndex(item => item.id === saved?.stepId);
      const position = namedPosition >= 0 ? namedPosition : Number.isInteger(saved?.index) && saved.index >= 0 ? Math.min(saved.index, STEPS.length - 1) : 0;
      const done = Array.isArray(saved?.completed) ? saved.completed.filter(id => STEPS.some(item => item.id === id)) : [];
      if (!alive.current) return;
      userId.current = user.id; current.current = position;
      setIndex(position); setView(STEPS[position].screen); setCompleted(done);
      const practice = createTourClient(saved?.tables, change => {
        const activeStep = STEPS[current.current];
        setCompleted(previous => {
          const next = activeStep.write === change.table && (!activeStep.mode || activeStep.mode === change.mode) && !previous.includes(activeStep.id) ? [...previous, activeStep.id] : previous;
          persist(current.current, practice, next);
          return next;
        });
      });
      setClient(practice);
    } catch (err) { if (alive.current) setError(err.message || 'Could not open the walkthrough.'); }
  };
  useEffect(() => { alive.current = true; load(); return () => { alive.current = false; }; }, []);
  usePreventRemove(true, ({ data }) => {
    if (finished.current) navigation.dispatch(data.action);
    else setError('Finish the walkthrough to get started, or use Sign out to pause. Your practice progress is saved.');
  });
  const move = next => {
    current.current = next; setIndex(next); setView(STEPS[next].screen); setError('');
    persist(next, client, completed);
  };
  const finish = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
        const { data: { user }, error: userError } = await withTimeout(() => supabase.auth.getUser());
      if (userError || user?.id !== userId.current) throw new Error('Your session changed. Sign in again to finish.');
      const { error: saveError } = await withTimeout(() => supabase.auth.updateUser({ data: { caregiver_tutorial_completed: true } }));
      if (saveError) throw saveError;
      await queue.current.catch(() => {});
      await AsyncStorage.removeItem(storageKey(userId.current)).catch(() => {});
      finished.current = true;
      navigation.reset({ index: 0, routes: [{ name: 'CaregiverHome' }] });
    } catch (err) { setError(err.message || 'Could not save completion. Please try again.'); }
    finally { setBusy(false); }
  };
  const leave = async () => {
    if (busy) return;
    setBusy(true);
    try { await queue.current.catch(() => {}); await signOutWithCleanup(); finished.current = true; navigation.reset({ index: 0, routes: [{ name: 'Landing' }] }); }
    catch (err) { setError(err.message || 'Could not sign out.'); }
    finally { setBusy(false); }
  };
  const next = () => { if (!canContinue || busy) return; if (index === STEPS.length - 1) finish(); else move(index + 1); };
  const localNavigation = {
    navigate(name) {
      if (step.navigate === name) move(index + 1);
      else if (SCREENS[name]) setView(name);
    },
    goBack() { setView(view === 'Profile' || view === 'PatientDetail' ? 'CaregiverHome' : 'PatientDetail'); },
    canGoBack: () => view !== 'CaregiverHome',
    setParams() {}, reset() {},
  };
  const patient = client?.snapshot().patients?.[0];
  const Screen = SCREENS[view];
  const params = { patientId: patient?.id, patientName: patient?.name || 'Sample person', canEdit: true, isPatient: false, initialTab: step.tab || 'Medications' };
  const context = { active: true, client, step, canContinue, next, highlight: id => step.target === id ? { borderWidth: 2, borderColor: NAVY, borderStyle: 'dashed' } : undefined };
  return <View style={{ flex: 1, backgroundColor: WHITE }}>
    <View style={{ paddingHorizontal: 18, paddingVertical: 8, borderBottomWidth: 1, borderColor: BORDER, backgroundColor: SURFACE }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: NAVY, fontFamily: 'DMSans_700Bold', fontSize: 18 }}>Caregiver walkthrough</Text><CareAction label="Sign out" onPress={leave} disabled={busy} /></View>
      <CareError message={error} />
      {!client ? error ? <Button title="Retry walkthrough" onPress={load} /> : <ActivityIndicator color={NAVY} /> : <>
        <Text style={{ color: MUTED, fontFamily: 'DMSans_500Medium', fontSize: 12, marginBottom: 4 }}>Practice workspace · {index + 1} of {STEPS.length}</Text>
        <ScrollView style={{ maxHeight: 130 }}><Text accessibilityRole="header" style={{ color: NAVY, fontFamily: 'DMSans_700Bold', fontSize: 17, marginBottom: 4 }}>{step.title}</Text><Text accessibilityLiveRegion="polite" style={{ color: NAVY, fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 21 }}>{step.text}</Text></ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          {index > 0 && <CareAction label="Back" disabled={busy} onPress={() => move(index - 1)} />}
          {!!step.next && (canContinue ? <Button title={step.next} onPress={next} disabled={busy} loading={busy} style={{ flex: 1, paddingVertical: 10 }} /> : <Text style={{ flex: 1, color: MUTED, fontFamily: 'DMSans_500Medium', fontSize: 13, lineHeight: 19 }}>Use the highlighted controls below to continue.</Text>)}
          {view !== step.screen && !canContinue && <CareAction label="Return to step" onPress={() => setView(step.screen)} />}
        </View>
      </>}
    </View>
    {!!client && <CaregiverTourContext.Provider value={context}><View style={{ flex: 1 }}>
      {(view === 'PatientDetail' || view === 'Appointments') && !patient ? <View style={{ padding: 20 }}><Text style={{ color: NAVY }}>Add your sample person first.</Text><Button title="Add sample person" onPress={() => move(3)} /></View> : <Screen key={`${index}-${view}`} navigation={localNavigation} route={{ params }} />}
    </View></CaregiverTourContext.Provider>}
  </View>;
}
