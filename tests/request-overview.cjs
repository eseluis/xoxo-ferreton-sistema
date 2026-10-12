const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>load(path.resolve(path.dirname(file),name+'.ts'))});
  return exports;
}
const {requestVisible, requestPending, requestsInSection} = load('src/requestOverview.ts');
const luis = {id:'003',role:'GERENTE_GENERAL'};
const jan = {id:'006',role:'JEFE_AREA'};
const petition = {id:'jan-papeleria',type:'Peticion',title:'MATERIAL DE PAPELERIA',requestedById:'006',recipientId:'003',date:'2026-10-01',status:'Abierta',confidentiality:'Normal'};
const automatic = {...petition,id:'auto',requestedById:'sistema',type:'Reporte'};
const confidential = {...petition,id:'private',recipientId:'005',confidentiality:'Confidencial'};
assert.equal(requestVisible(petition,luis),true);
assert.equal(requestVisible(petition,jan),true);
assert.equal(requestVisible(petition,{id:'008',role:'JEFE_AREA'}),false);
assert.equal(requestVisible(confidential,luis),false);
assert.equal(requestVisible(confidential,jan),true);
assert.deepEqual(Array.from(requestsInSection([automatic,petition,confidential],luis,false), r=>r.id), ['jan-papeleria']);
assert.deepEqual(Array.from(requestsInSection([automatic,petition],luis,true), r=>r.id), ['auto']);
assert.equal(requestPending(petition),true,'older open requests remain pending');
assert.equal(requestPending({...petition,status:'En revision'}),true);
assert.equal(requestPending({...petition,status:'Atendida'}),false);
assert.equal(requestPending({...petition,status:'Cerrada'}),false);
console.log('PASS: Jan to Luis, separate reports and petitions, old pending requests and confidentiality');
