export async function exportPatientPdf(html, patientName, isActive = () => true) {
  if (!isActive()) return;
  const Print = require('expo-print');
  const Sharing = require('expo-sharing');
  const { File, Paths } = require('expo-file-system');
  const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });
  const name = String(patientName || 'Patient').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim().slice(0, 60) || 'Patient';
  const output = new File(Paths.cache, `Anchor-${name}-${Date.now()}.pdf`);
  new File(uri).move(output);
  if (!isActive()) { output.delete(); return; }
  if (await Sharing.isAvailableAsync()) {
    if (isActive()) await Sharing.shareAsync(output.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save or share patient PDF' });
  } else if (isActive()) await Print.printAsync({ uri: output.uri });
}
