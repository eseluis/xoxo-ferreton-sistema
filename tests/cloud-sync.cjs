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
    calls.push({ name, records: args.records, args });
    if (failure) return { error: failure };
    if (name === 'centro_assign_day') {
      const row = { id: `${args.target_day}-${args.employee_id}`, employeeId: args.employee_id, date: args.target_day,
        location: args.target_location, start: args.shift_start, end: args.shift_end };
      rows = [...rows.filter(x => x.id !== row.id), row];
      return { error: null };
    }
    if (name === 'archive_daily_task') {
      rows = rows.map(row => row.id === args.task_id ? {...row, removedAt:'2026-09-10'} : row);
      return {error:null};
    }
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
  failure = null;
  rows = [{id:'withdraw',status:'Pendiente'}, {id:'keep',status:'Completada'}];
  await api.cloudLoad('xoxo.dailyTasks', []);
  await api.archiveCloudTask('withdraw', 'Prueba');
  assert.ok(rows.find(row => row.id === 'withdraw').removedAt);
  const visible = await api.cloudRefresh('xoxo.dailyTasks');
  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, 'keep');
  failure = {message:'Sin permiso'};
  await assert.rejects(api.archiveCloudTask('keep', 'Prueba'), /Sin permiso/);
  assert.equal(rows.find(row => row.id === 'keep').removedAt, undefined);
  console.log('PASS: retirar persiste, conserva otros registros y propaga errores de permisos');
  failure = null;
  const openingKey = 'xoxo.storeOpeningChecks';
  const opening = { id:'2026-10-09-Matriz', branch:'Matriz', date:'2026-10-09' };
  api.markCloudPending(openingKey, [opening], [{...opening, managerAuthorizedAt:'09:00'}]);
  api.markCloudPending(openingKey, [opening], [{...opening, erpReady:true, openedAt:null}]);
  api = boot();
  await api.cloudSave(openingKey, [opening]);
  assert.equal(calls.at(-1).name, 'patch_store_opening_checks');
  assert.equal(calls.at(-1).records.length, 1);
  assert.equal(calls.at(-1).records[0].managerAuthorizedAt, '09:00');
  assert.equal(calls.at(-1).records[0].erpReady, true);
  assert.equal(calls.at(-1).records[0].openedAt, null);
  failure = {code:'PGRST202'};
  const openingCalls = calls.length;
  await assert.rejects(api.cloudSave(openingKey, [opening]), /supabase-fix-opening-sync/);
  assert.equal(calls.length, openingCalls + 1);
  assert.ok(storage.has('xoxo.pending.' + openingKey));
  console.log('PASS: la apertura reintenta sólo campos modificados, conserva borrados y nunca reemplaza el historial');
  failure = null;
  const locations = 'xoxo.workLocations';
  const jan = {id:'2026-11-04-006',employeeId:'006',date:'2026-11-04',location:'Matriz',start:'08:00',end:'17:30'};
  const ruben = {...jan,id:'2026-11-04-011',employeeId:'011',location:'Sucursal Centro',start:'09:30',end:'19:00'};
  rows = [jan, ruben];
  const moved = {...jan, location:'Sucursal Centro'};
  const revision = api.markCloudPending(locations, [moved], [moved]);
  await api.cloudSave(locations, [moved]);
  api.clearCloudPending(locations, revision);
  assert.equal(calls.at(-1).name, 'centro_assign_day');
  assert.equal(rows.find(x => x.employeeId === '011').location, 'Sucursal Centro');
  assert.equal(rows.find(x => x.employeeId === '006').location, 'Sucursal Centro');
  assert.equal(calls.at(-1).args.shift_end, '17:30');
  console.log('PASS: trasladar a Jan conserva el traslado de Rubén y el horario individual');
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const normalization = app.match(/const normalizedCollaborators = ([^;]+);/)[1];
  const normalized = vm.runInNewContext(normalization, {cloudCollaborators:[{id:'006',branch:'Matriz',shift:'B'}, {id:'011',branch:'Sucursal Centro',shift:'A'}], organizationOverrides:{'006':{branch:'Sucursal Centro',shift:'A'},'011':{branch:'Matriz',shift:'B'}}});
  assert.equal(normalized[0].branch, 'Matriz');
  assert.equal(normalized[0].shift, 'B');
  assert.equal(normalized[1].branch, 'Sucursal Centro');
  assert.equal(normalized[1].shift, 'A');
  console.log('PASS: iniciar sesión respeta la sucursal y turno guardados');
})().catch(error => { console.error(error); process.exitCode = 1; });
