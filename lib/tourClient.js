function createTourClient(saved, onWrite = () => {}) {
  const owner = 'tour-caregiver';
  let serial = 0;
  const now = new Date().toISOString();
  const clone = value => JSON.parse(JSON.stringify(value));
  const tables = saved ? clone(saved) : { profiles: [{ id: owner, role: 'caregiver', full_name: 'Sample caregiver' }] };
  const channel = { on() { return this; }, subscribe() { return this; } };
  const client = {
    snapshot: () => clone(tables),
    auth: { getUser: async () => ({ data: { user: { id: owner, email: 'practice@example.test' } }, error: null }) },
    channel: () => channel, removeChannel() {},
    async rpc(name) {
      if (name === 'reset_patient_pairing') return { data: { code: '12345678', expires_at: new Date(Date.now() + 86400000).toISOString() }, error: null };
      return { data: null, error: { message: 'This action is not needed in the practice workspace.' } };
    },
    from(table) {
      tables[table] ||= [];
      let mode = 'select', payload, one = false, limit, result;
      const filters = [], sorts = [];
      const q = {
        select() { return this; }, eq(key, value) { filters.push(row => row[key] === value); return this; },
        in(key, values) { filters.push(row => values.includes(row[key])); return this; },
        gte(key, value) { filters.push(row => row[key] >= value); return this; }, lt(key, value) { filters.push(row => row[key] < value); return this; },
        order(key, options = {}) { sorts.push([key, options.ascending !== false]); return this; },
        limit(count) { limit = count; return this; }, single() { one = true; return this; }, maybeSingle() { one = true; return this; },
        insert(value) { mode = 'insert'; payload = value; return this; }, update(value) { mode = 'update'; payload = value; return this; },
        upsert(value) { mode = 'upsert'; payload = value; return this; }, delete() { mode = 'delete'; return this; },
        then(resolve, reject) {
          if (!result) result = Promise.resolve().then(() => {
            let rows = tables[table].filter(row => filters.every(match => match(row)));
            if (mode === 'insert' || mode === 'upsert') {
              rows = (Array.isArray(payload) ? payload : [payload]).map(value => {
                const existing = mode === 'upsert' && tables[table].find(row => value.id ? row.id === value.id : value.user_id && row.user_id === value.user_id);
                if (existing) { Object.assign(existing, clone(value)); return existing; }
                const row = { id: `tour-${table}-${Date.now()}-${++serial}`, created_at: now, active: true, pinned: false, completed: false, ...clone(value) };
                if (table === 'pairing_codes') Object.assign(row, { expires_at: new Date(Date.now() + 86400000).toISOString(), used: false });
                tables[table].push(row);
                if (table === 'patients') {
                  tables.vital_signs = [{ id: 'sample-vital', patient_id: row.id, type: 'oxygen', value: '98', unit: '%', logged_at: now }];
                  tables.mood_logs = [{ id: 'sample-mood', patient_id: row.id, mood: 4, note: 'Sample check-in: enjoyed a walk', logged_at: now }];
                  tables.safety_checkins = [{ id: 'sample-help', patient_id: row.id, status: 'needs_help', created_at: now, logged_at: now }];
                }
                return row;
              });
            } else if (mode === 'update') rows.forEach(row => Object.assign(row, clone(payload)));
            else if (mode === 'delete') tables[table] = tables[table].filter(row => !rows.includes(row));
            for (const [key, ascending] of sorts.reverse()) rows.sort((a, b) => (a[key] === b[key] ? 0 : a[key] > b[key] ? 1 : -1) * (ascending ? 1 : -1));
            if (limit !== undefined) rows = rows.slice(0, limit);
            if (mode !== 'select') onWrite({ table, mode, rows: clone(rows) });
            return { data: clone(one ? rows[0] || null : rows), error: null };
          });
          return result.then(resolve, reject);
        },
      };
      return q;
    },
  };
  return client;
}
module.exports = { createTourClient };
