const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute);
  const exports = {};
  cache.set(absolute, exports);
  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(source, { exports, Date, Intl, require: name => load(path.resolve(path.dirname(absolute), name + '.ts')) });
  return exports;
}
const { taskOverdueReason, taskMatchesFilter, taskCounts, taskDayAt } = load('src/taskOverview.ts');
const now = new Date('2026-10-06T18:00:00Z'); // 12:00 in Mexico City.
const task = { id: '1', employeeId: '010', assignedById: '003', title: 'Inventario', date: '2026-10-06', start: '10:00', end: '12:00', status: 'Pendiente', priority: 'Media', notes: '' };
assert.match(taskOverdueReason(task,now), /Horario/);
assert.equal(taskOverdueReason({...task,end:'12:01'},now),'');
assert.match(taskOverdueReason({...task,date:'2026-10-05',end:'23:59'},now), /Horario/);
assert.equal(taskOverdueReason({...task,date:'2026-10-07'},now),'');
assert.equal(taskOverdueReason({...task,status:'Completada'},now),'');
assert.equal(taskOverdueReason({...task,completedAt:now.toISOString()},now),'');
assert.equal(taskOverdueReason({...task,removedAt:now.toISOString()},now),'');
assert.match(taskOverdueReason({...task,status:'Pausada'},now), /Horario/);
assert.match(taskOverdueReason({...task,status:'Incidencia'},now), /Horario/);
const sla = {...task,end:'14:00',status:'En proceso',startedAt:'2026-10-06T17:00:00Z',slaMinutes:30};
assert.match(taskOverdueReason(sla,now), /SLA/);
assert.equal(taskOverdueReason({...sla,pausedMinutes:45},now),'');
assert.equal(taskOverdueReason({...sla,status:'Pausada',pausedAt:'2026-10-06T17:20:00Z'},now),'');
assert.equal(taskOverdueReason({...sla,status:'Incidencia'},now),'');
assert.equal(taskDayAt(new Date('2026-10-07T02:00:00Z')),'2026-10-06');
assert.equal(taskMatchesFilter(task,'Vencidas',now),true);
assert.equal(taskMatchesFilter({...task,status:'Completada'},'Sin terminar',now),false);
const counts = taskCounts([task,sla,{...task,status:'Completada',requiresPhoto:true},{...task,status:'Pausada'},{...task,status:'Incidencia'}],now);
assert.equal(counts.total,5); assert.equal(counts.incomplete,4); assert.equal(counts.overdue,4);
assert.equal(counts.complete,1); assert.equal(counts.running,1); assert.equal(counts.missingEvidence,1);
console.log('PASS: scheduled and SLA overdue tasks, history, completion, pauses, incidents, Mexico timezone, filters and totals');
