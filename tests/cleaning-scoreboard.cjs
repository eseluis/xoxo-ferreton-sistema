const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/cleaningScoreboard.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:api});
const { aseoAutoPoints, autoPointsInRange, aseoRunCountsInRange, qualityPointsInRange, shiftDateKey } = api;

const base = { employeeId: '009', date: '2026-09-10', itemType: 'Aseo', slaMinutes: 30 };
const onTime = { ...base, startedAt: '2026-09-10T09:00:00.000Z', completedAt: '2026-09-10T09:20:00.000Z' };
const late = { ...base, date: '2026-09-11', startedAt: '2026-09-11T09:00:00.000Z', completedAt: '2026-09-11T09:45:00.000Z' };
const incomplete = { ...base, date: '2026-09-12', startedAt: '2026-09-12T09:00:00.000Z' };
const otherEmployee = { ...onTime, employeeId: '010', date: '2026-09-10' };
const notAseo = { ...onTime, itemType: 'Actividad', date: '2026-09-10' };

assert.equal(aseoAutoPoints(onTime), 2, 'a tiempo suma 2');
assert.equal(aseoAutoPoints(late), 1, 'con retraso suma 1');
assert.equal(aseoAutoPoints(incomplete), 0, 'sin completar suma 0');
assert.equal(aseoAutoPoints(notAseo), 0, 'solo cuenta bloques de aseo');

const runs = [onTime, late, incomplete, otherEmployee, notAseo];
assert.equal(autoPointsInRange(runs, '009', '2026-09-10', '2026-09-12'), 3, 'suma puntos automaticos del periodo (2+1+0)');
assert.equal(autoPointsInRange(runs, '009', '2026-09-10', '2026-09-10'), 2, 'respeta el rango de fechas');
assert.equal(autoPointsInRange(runs, '010', '2026-09-10', '2026-09-12'), 2, 'separa por colaborador');

const counts = aseoRunCountsInRange(runs, '009', '2026-09-10', '2026-09-12');
assert.equal(counts.onTime, 1, 'desglosa a tiempo');
assert.equal(counts.late, 1, 'desglosa con retraso');
assert.equal(counts.incomplete, 1, 'desglosa pendientes');
assert.equal(counts.total, 3, 'desglosa total del periodo');

const evaluations = [
  { employeeId: '009', periodStart: '2026-09-10', periodEnd: '2026-09-12', qualityScore: 8 },
  { employeeId: '009', periodStart: '2026-09-13', periodEnd: '2026-09-15', qualityScore: 10 },
  { employeeId: '010', periodStart: '2026-09-10', periodEnd: '2026-09-12', qualityScore: 4 },
];
assert.equal(qualityPointsInRange(evaluations, '009', '2026-09-10', '2026-09-12'), 8, 'suma calidad del periodo evaluado');
assert.equal(qualityPointsInRange(evaluations, '009', '2026-09-01', '2026-09-30'), 18, 'acumula varios periodos del mes');

assert.equal(shiftDateKey('2026-09-10', -2), '2026-09-08', 'resta dias dentro del mismo mes');
assert.equal(shiftDateKey('2026-09-01', -1), '2026-08-31', 'cruza el limite de mes hacia atras');
assert.equal(shiftDateKey('2026-02-28', 1), '2026-03-01', 'cruza el limite de mes hacia adelante');

console.log('PASS: puntos automaticos de aseo, rango por periodo, calidad acumulada y aritmetica de fechas');
