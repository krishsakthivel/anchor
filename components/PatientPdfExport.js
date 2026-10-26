import React, { useEffect, useRef, useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appAlert } from './AppDialog';
import { exportPatientPdf } from '../lib/patientPdf';
import { NAVY, BORDER } from '../theme/colors';
const { loadPatientExport, buildPatientExportHtml } = require('../lib/patientExport');

export default function PatientPdfExport({ client, patientId }) {
  const [busy, setBusy] = useState(false);
  const exporting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const exportPdf = async () => {
    if (exporting.current) return;
    exporting.current = true; setBusy(true);
    try {
      const data = await loadPatientExport(client, patientId, () => mounted.current);
      if (mounted.current) await exportPatientPdf(buildPatientExportHtml(data), data.patient.name, () => mounted.current);
    } catch (error) {
      if (mounted.current) appAlert.alert('Could not export PDF', /native module|cannot find module/i.test(error.message || '') ? 'Update or rebuild the installed app to enable PDF export, then try again.' : error.message || 'Please check your connection and try again.');
    } finally { exporting.current = false; if (mounted.current) setBusy(false); }
  };
  return <TouchableOpacity onPress={exportPdf} disabled={busy} accessibilityRole="button" accessibilityLabel="Export patient data as PDF" accessibilityState={{ disabled: busy, busy }} style={{ minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: busy ? 0.6 : 1 }}>
    {busy ? <ActivityIndicator size="small" color={NAVY} /> : <Ionicons name="download-outline" size={17} color={NAVY} />}
    <Text style={{ color: NAVY, fontFamily: 'DMSans_500Medium', fontSize: 14 }}>{busy ? 'Preparing PDF…' : 'Export PDF'}</Text>
  </TouchableOpacity>;
}
