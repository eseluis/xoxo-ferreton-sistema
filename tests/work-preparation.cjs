const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,Intl,require:n=>n==='./cloudStore'||n.startsWith('react')?{}:load(path.resolve(path.dirname(file),n+'.ts'))});return exports;}
const {uniformWeek,ORDER_WEEK}=load('src/WorkPreparation.tsx');
assert.deepEqual(Array.from(ORDER_WEEK,r=>r[2]),['Celina','Sabina','Citlali','Anubis','Julio','Responsables de cada área']);
assert.ok(!uniformWeek('Mujeres').includes('Verde'));assert.ok(!uniformWeek('Comun').includes('Verde'));assert.equal(uniformWeek('Hombres')[3],'Verde');assert.equal(uniformWeek('Mujeres').length,7);
const {systemMetrics}=load('src/systemKpis.ts');
const sources={matriz_order_records:{available:true,rows:[{id:'a',date:'2026-11-04',start:'10:00',end:'11:00',status:'Completada',completedAt:'2026-11-04T16:45:00Z',evidenceComplete:true},{id:'b',date:'2026-11-04',start:'10:00',end:'11:00',status:'Pendiente'}]},work_readiness_records:{available:true,rows:[{id:'in',uniformOk:true,toolsRequired:true,toolsOk:true,hasPhoto:true},{id:'out',uniformOk:false,toolsRequired:true,toolsOk:false,hasPhoto:true}]}};
const metrics=systemMetrics(sources,new Date('2026-11-04T18:00:00Z'));const find=id=>metrics.find(m=>m.id===id);
assert.equal(find('matriz_order_records-complete').value,50);assert.equal(find('orders-overdue').value,1);assert.equal(find('uniform-compliance').value,50);assert.equal(find('tools-compliance').value,50);assert.equal(find('weekly-photos').value,2);
assert.equal(systemMetrics({work_readiness_records:{available:true,rows:[]}}).find(m=>m.id==='tools-compliance').value,null);
console.log('Rol semanal, colores permitidos, pasos no iniciados e indicadores de herramientas/uniforme verificados.');
