let previousFrame;
export async function exportPatientPdf(html, patientName, isActive = () => true) {
  if (!isActive()) return;
  previousFrame?.remove();
  const frame = document.createElement('iframe');
  previousFrame = frame;
  frame.title = `${patientName || 'Patient'} - Anchor care report`;
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: '816px', height: '1056px', border: '0' });
  await new Promise((resolve, reject) => {
    frame.onload = async () => {
      try {
        await frame.contentDocument?.fonts?.ready;
        if (!isActive()) { frame.remove(); resolve(); return; }
        if (!frame.contentWindow) throw new Error('Could not open the PDF print preview.');
        frame.contentWindow.onafterprint = () => { frame.remove(); if (previousFrame === frame) previousFrame = null; };
        frame.contentWindow.focus();
        frame.contentWindow.print();
        resolve();
      } catch (error) { frame.remove(); reject(error); }
    };
    frame.onerror = () => { frame.remove(); reject(new Error('Could not load the PDF print preview.')); };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}
