const { MOODS } = require('./careValues');
const { medicationDaysLabel } = require('./medicationSchedule');
const PAGE_SIZE = 500;
const EXPORT_TABLES = {
  medications: 'id,name,dosage,instructions,total_pills,pills_remaining,refill_alert_at,created_at',
  medication_schedule: 'id,medication_id,time,frequency,days,active,created_at',
  medication_log: 'id,medication_id,schedule_id,status,logged_at,log_day',
  tasks: 'id,title,description,time,frequency,days,active,created_at',
  task_completion: 'id,task_id,status,completed_at,completion_day',
  care_notes: 'id,title,body,pinned,created_at',
  vital_signs: 'id,type,value,unit,note,logged_at',
  appointments: 'id,title,doctor,location,appointment_time,notes,completed,created_at',
  mood_logs: 'id,mood,note,logged_at',
  daily_plans: 'id,plan_date,answers,blocks,created_at,updated_at',
  activity_checkins: 'id,plan_id,block_index,checked_at',
  safety_checkins: 'id,status,note,created_at',
  emergency_contacts: 'id,name,phone,priority',
  reminders: 'id,title,description,reminder_time,repeat_rule,created_at',
};

async function loadPatientExport(client, patientId, isActive = () => true) {
  if (!patientId) throw new Error('Open a patient care plan before exporting.');
  const checkActive = () => { if (!isActive()) throw new Error('Export cancelled.'); };
  checkActive();
  const { data: patient, error } = await client.from('patients').select('id,name,birth_date,created_at').eq('id', patientId).single();
  checkActive();
  if (error || !patient || patient.id !== patientId) throw new Error('Could not load this patient. Check your access and try again.');
  const entries = await Promise.all(Object.entries(EXPORT_TABLES).map(async ([table, columns]) => {
    const rows = [];
    for (let offset = 0; ;) {
      checkActive();
      const result = await client.from(table).select(columns, { count: 'exact' }).eq('patient_id', patientId).order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
      checkActive();
      if (result.error) throw new Error(`Could not export ${table.replace(/_/g, ' ')}. No PDF was created. Please try again.`);
      const page = result.data || [];
      rows.push(...page);
      offset += page.length;
      if (page.length === 0 || (Number.isInteger(result.count) && offset >= result.count)) break;
    }
    return [table, rows];
  }));
  checkActive();
  return { patient, generatedAt: new Date().toISOString(), ...Object.fromEntries(entries) };
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const show = value => value == null || value === '' ? 'Not recorded' : String(value);
const title = value => String(value || '').replace(/_/g, ' ').replace(/^./, text => text.toUpperCase());
function date(value, dateOnly = false) {
  if (!value) return 'Not recorded';
  const text = String(value);
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00` : text);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return dateOnly ? parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : parsed.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}
function time(value) {
  if (!value) return 'Any time';
  const match = String(value).match(/^(\d{2}):(\d{2})/);
  if (!match) return show(value);
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
}
function json(value, fallback) {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}
const newest = (rows, key) => [...rows].sort((a, b) => String(b[key] || '').localeCompare(String(a[key] || '')));
const cell = value => escapeHtml(show(value)).replace(/\r?\n/g, '<br>');
const table = (headers, rows) => rows.length ? `<table><thead><tr>${headers.map(header => `<th>${cell(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${cell(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p class="empty">No records saved.</p>';
const section = (heading, content) => `<section><h2>${escapeHtml(heading)}</h2>${content}</section>`;
const paragraph = value => `<p class="body">${cell(value)}</p>`;
const activityName = block => block?.title || ({ play: 'Activity time', quiet: 'Quiet time', rest: 'Rest time', sleep: 'Wind-down', care: 'Care time', medicine: 'Medication', activity: 'Activity' })[block?.type] || 'Activity';

function buildPatientExportHtml(data) {
  const rows = key => Array.isArray(data[key]) ? data[key] : [];
  const medications = new Map(rows('medications').map(row => [row.id, row]));
  const tasks = new Map(rows('tasks').map(row => [row.id, row]));
  const slots = new Map(rows('medication_schedule').map(row => [row.id, row]));
  const plans = new Map(rows('daily_plans').map(row => [row.id, row]));
  const patient = data.patient || {};
  const sections = [];
  sections.push(section('Patient details', table(['Name', 'Date of birth', 'Care plan created'], [[patient.name, date(patient.birth_date, true), date(patient.created_at, true)]])));
  sections.push(section('Emergency contacts', table(['Name', 'Phone', 'Priority'], [...rows('emergency_contacts')].sort((a, b) => (a.priority || 0) - (b.priority || 0)).map(row => [row.name, row.phone, row.priority]))));
  sections.push(section('Medications and dose times', table(['Medicine', 'Instructions', 'Dose schedule', 'Pill stock'], rows('medications').map(row => {
    const schedules = rows('medication_schedule').filter(slot => slot.medication_id === row.id).sort((a, b) => String(a.time).localeCompare(String(b.time)));
    return [[row.name, row.dosage].filter(Boolean).join('\n'), row.instructions, schedules.length ? schedules.map(slot => `${time(slot.time)} - ${slot.days == null ? 'Every day' : medicationDaysLabel(slot.days)}${slot.active === false ? ' (inactive)' : ''}`).join('\n') : 'Any time - Every day', `${row.pills_remaining ?? 'Not recorded'} remaining\nTotal: ${row.total_pills ?? 'Not recorded'}\nLow-stock threshold: ${row.refill_alert_at ?? 10}`];
  }))));
  sections.push(section('Recurring tasks', table(['Task', 'Details', 'Schedule'], rows('tasks').map(row => [row.title, row.description, `${time(row.time)} - ${row.days == null ? 'Every day' : medicationDaysLabel(row.days)}${row.active === false ? ' (inactive)' : ''}`]))));
  sections.push(section('Care notes', rows('care_notes').length ? [...rows('care_notes')].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || String(b.created_at).localeCompare(String(a.created_at))).map(row => `<article><h3>${cell(row.title)}${row.pinned ? ' <span class="tag">Pinned</span>' : ''}</h3><p class="meta">${cell(date(row.created_at))}</p>${paragraph(row.body)}</article>`).join('') : '<p class="empty">No records saved.</p>'));
  sections.push(section('Appointments', table(['When', 'Visit', 'Details', 'Status'], newest(rows('appointments'), 'appointment_time').map(row => [date(row.appointment_time), row.title, [row.doctor && `Doctor: ${row.doctor}`, row.location && `Location: ${row.location}`, row.notes].filter(Boolean).join('\n'), row.completed ? 'Completed' : 'Not marked completed']))));
  sections.push(section('Vital signs', table(['Recorded', 'Reading', 'Value', 'Note'], newest(rows('vital_signs'), 'logged_at').map(row => [date(row.logged_at), title(row.type), `${show(row.value)}${row.unit ? ` ${row.unit}` : ''}`, row.note]))));
  sections.push(section('Mood check-ins', table(['Recorded', 'Mood', 'Note'], newest(rows('mood_logs'), 'logged_at').map(row => [date(row.logged_at), MOODS.find(mood => mood.value === Number(row.mood))?.label || 'Not recorded', row.note]))));
  sections.push(section('Safety check-ins', table(['Recorded', 'Check-in', 'Note'], newest(rows('safety_checkins'), 'created_at').map(row => [date(row.created_at), ({ okay: 'I am okay', needs_help: 'I need help', urgent: 'Urgent help' })[row.status] || title(row.status), row.note]))));
  sections.push(section('Medication history', table(['Day / recorded', 'Medicine / dose', 'Outcome'], newest(rows('medication_log'), 'logged_at').map(row => [date(row.log_day, true) + '\n' + date(row.logged_at), `${medications.get(row.medication_id)?.name || 'Medication no longer available'}\n${row.schedule_id ? slots.has(row.schedule_id) ? time(slots.get(row.schedule_id).time) : 'Dose time no longer available' : 'Unscheduled dose'}`, title(row.status)]))));
  sections.push(section('Task history', table(['Day / recorded', 'Task', 'Outcome'], newest(rows('task_completion'), 'completed_at').map(row => [date(row.completion_day, true) + '\n' + date(row.completed_at), tasks.get(row.task_id)?.title || 'Task no longer available', title(row.status)]))));
  sections.push(section('Daily activity plans', rows('daily_plans').length ? newest(rows('daily_plans'), 'plan_date').map(row => {
    const blocks = json(row.blocks, []);
    const answers = json(row.answers, {});
    const answerLabels = { energy: 'Energy', sleep: 'Sleep', feeling: 'Feeling', play: 'Activity time requested', needsCare: 'Care requested' };
    const summary = answers && typeof answers === 'object' && !Array.isArray(answers) ? Object.entries(answers).map(([key, value]) => `${answerLabels[key] || title(key)}: ${show(value)}`).join(' | ') : '';
    return `<h3>${cell(date(row.plan_date, true))}</h3>${summary ? `<p class="body plan-summary">${cell(summary)}</p>` : ''}${table(['Start', 'Activity', 'Duration', 'Place / status'], (Array.isArray(blocks) ? blocks : []).filter(Boolean).map(block => [time(block.start), activityName(block), `${block.minutes ?? 0} minutes`, block.removed ? 'Removed from schedule' : block.location_name || 'No place assigned']))}`;
  }).join('') : '<p class="empty">No records saved.</p>'));
  sections.push(section('Activity location check-ins', table(['Recorded', 'Plan day', 'Activity', 'Place'], newest(rows('activity_checkins'), 'checked_at').map(row => {
    const plan = plans.get(row.plan_id); const blocks = json(plan?.blocks, []); const block = Array.isArray(blocks) ? blocks[row.block_index] : null;
    return [date(row.checked_at), date(plan?.plan_date, true), block ? activityName(block) : 'Activity no longer available', block?.location_name || 'Not recorded'];
  }))));
  sections.push(section('Other reminders', table(['When', 'Reminder', 'Details', 'Repeat'], newest(rows('reminders'), 'reminder_time').map(row => [date(row.reminder_time), row.title, row.description, row.repeat_rule || 'Does not repeat']))));
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(patient.name || 'Patient')} - Anchor care report</title><style>
    @page{size:Letter;margin:34pt}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172f63;font-size:10pt;line-height:1.45;margin:0}header{border-bottom:3pt solid #172f63;padding-bottom:15pt;margin-bottom:20pt}.brand{font-size:10pt;font-weight:bold;letter-spacing:1.5pt}h1{font-size:26pt;line-height:1.2;margin:10pt 0 4pt;overflow-wrap:anywhere}header p{margin:4pt 0;color:#5e697b}.summary{background:#f3f5f8;border-radius:5pt;padding:10pt;margin:12pt 0;color:#4c586e}section{margin-top:22pt}.plan-summary{break-after:avoid-page}h2{font-size:14pt;border-bottom:1pt solid #d8dfeb;padding-bottom:6pt;margin:0 0 10pt;break-after:avoid-page}h3{font-size:11pt;margin:12pt 0 3pt;break-after:avoid-page}table{border-collapse:collapse;width:100%;table-layout:fixed;margin:6pt 0 10pt}thead{display:table-header-group}th{text-align:left;background:#edf1f7;font-size:9pt}th,td{padding:8pt;border:0.6pt solid #d8dfeb;vertical-align:top;overflow-wrap:anywhere;word-break:break-word}tr{break-inside:avoid}p{orphans:3;widows:3}.body{white-space:normal;overflow-wrap:anywhere;color:#34445e}.meta,.empty{color:#687488;font-size:9pt}.tag{font-size:8pt;background:#edf1f7;padding:2pt 5pt;border-radius:3pt}.footer{border-top:1pt solid #d8dfeb;padding-top:10pt;margin-top:24pt;font-size:8pt;color:#687488}
    </style></head><body><header><div class="brand">ANCHOR</div><h1>${cell(patient.name || 'Patient')}</h1><p>Care plan and recorded history</p><p>Exported ${cell(date(data.generatedAt))}</p></header><div class="summary">Records available to your account at the time of export. All saved dates are included. Times use the exporting device's time zone. Pairing codes and internal access tokens are omitted.</div>${sections.join('')}<p class="footer">Private patient care information. Generated by Anchor.</p></body></html>`;
}
module.exports = { EXPORT_TABLES, loadPatientExport, buildPatientExportHtml, escapeHtml };
