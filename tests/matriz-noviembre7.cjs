const fs=require('fs'),assert=require('assert/strict'),ts=require('typescript'),vm=require('vm');const rows=JSON.parse(fs.readFileSync('tareas-matriz-2026-11-07.json','utf8'));
assert.equal(rows.length,27);assert.deepEqual([...new Set(rows.map(r=>r.employeeId))].sort(),['006','007','009','010','014','015']);assert.ok(rows.every(r=>r.date==='2026-11-07'&&r.branch==='Matriz'&&r.priority==='Alta'&&r.start<r.end));
for(const r of rows){assert.ok(!rows.some(x=>x.id!==r.id&&x.employeeId===r.employeeId&&r.start<x.end&&r.end>x.start),'Assigned tasks must not overlap');if(r.title==='Comida')assert.equal(r.affectsEvaluation,false);}
let ex={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/PriorityTasksCard.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:ex,require:()=>({})});
assert.equal(ex.priorityTasksFor({id:'015'},'Matriz','2026-11-07',rows).length,6);assert.equal(ex.priorityTasksFor({id:'015'},'Matriz','2026-11-08',rows).length,0);assert.equal(ex.priorityTasksFor({id:'011'},'Sucursal Centro','2026-11-07',rows).length,0);assert.equal(ex.priorityTasksFor({id:'006'},'Sucursal Centro','2026-11-07',rows).length,0);
console.log('PASS: 27 tasks, six Matriz collaborators, exact date, no assigned overlaps, meals excluded from evaluation, own/date/store priority visibility');

let centroExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/centroOperation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:centroExports});
for(const role of ['JEFE_AREA','AUXILIAR','CAJERO','GERENTE_TIENDA','GERENTE_GENERAL']){const u={id:'003',role,branch:'Matriz'};assert.equal(centroExports.canShowCentroOperation(u,'Matriz'),role==='GERENTE_GENERAL');assert.equal(centroExports.canShowCentroOperation(u,'Sucursal Centro'),true);}
assert.equal(centroExports.canShowCentroOperation({id:'002',role:'DIRECTOR',branch:'Corporativo'},'Corporativo'),true);
console.log('PASS: Centro retains corporate supervision from Matriz and daily transfer access');
