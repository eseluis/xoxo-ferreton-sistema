const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const source = fs.readFileSync('src/cloudStore.ts', 'utf8').replaceAll('import.meta.env', '({})');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const storage = new Map();
let rows = [], calls = [], failure = null;
const client = {
  auth: { getUser: async () => ({ data: { user: { id: 'tester' } } }) },
  from: () => ({ select: () => ({ order: async () => ({ data: rows.map(payload => ({ payload })), error: null }) }) }),
  rpc: async (name, args) => {
    calls.push({ name, records: args.records });
    if (failure) return { error: failure };
    for (const row of args.records) rows = [...rows.filter(x => x.id !== row.id), row];
    return { error: null };
  },
};
function boot() {
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: () => ({ createClient: () => client }), crypto: { randomUUID }, console,
    window: { sessionStorage: {}, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) } },
  });
  return exports;
}
(async () => {
  let api = boot();
  const key = 'xoxo.activityRuns';
  rows = [{ id: 'a', status: 'En curso' }, { id: 'b', status: 'En curso' }];
  const snapshot = await api.cloudLoad(key, []);
  rows[1] = { id: 'b', status: 'Completada', completedAt: '2026-09-10' };
  const next = snapshot.map(x => x.id === 'a' ? { ...x, status: 'Completada' } : x);
  const rev = api.markCloudPending(key, next);
  await api.cloudSave(key, next);
  api.clearCloudPending(key, rev);
  assert.equal(calls.at(-1).records.length, 1);
  assert.equal(rows.find(x => x.id === 'b').status, 'Completada');
  console.log('PASS: guardar una actividad no reinicia otra completada en una segunda sesión');

  const current = await api.cloudRefresh(key);
  const offline = current.map(x => x.id === 'a' ? { ...x, evidenceCapture: 'foto' } : x);
  api.markCloudPending(key, offline);
  failure = { code: 'NETWORK' };
  await assert.rejects(api.cloudSave(key, offline));
  api = boot(); // Browser reload loses all in-memory baselines.
  rows.push({ id: 'new', status: 'Pendiente' });
  failure = null;
  const restored = await api.cloudLoad(key, []);
  assert.equal(calls.at(-1).records.length, 1);
  assert.ok(restored.some(x => x.id === 'new'));
  assert.equal(rows.find(x => x.id === 'b').status, 'Completada');
  console.log('PASS: reintento tras recarga envía solo cambios y recibe asignaciones nuevas');

  const missing = restored.map(x => x.id === 'a' ? { ...x, escalated: true } : x);
  failure = { code: 'PGRST202' };
  const before = calls.length;
  await assert.rejects(api.cloudSave(key, missing), /supabase-fix-shared-sync/);
  assert.equal(calls.length, before + 1);
  assert.equal(calls.at(-1).name, 'sync_module_records');
  console.log('PASS: una migración faltante nunca activa el reemplazo destructivo');
})().catch(error => { console.error(error); process.exitCode = 1; });
