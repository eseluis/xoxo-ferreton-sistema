const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const cache=new Map();
function load(file) {
 file=path.resolve(file); if(cache.has(file)) return cache.get(file);
 const exports={};cache.set(file,exports);
 const source=fs.readFileSync(file,'utf8').replaceAll('import.meta.env','({})');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
 exports,console,Date,Intl,setTimeout,clearTimeout,require:name=>{
  if(name==='./cloudStore') return {supabase:null,isCloudReady:false};
  if(!name.startsWith('.')) return require(name);
  const base=path.resolve(path.dirname(file),name);
  return load(fs.existsSync(base+'.tsx')?base+'.tsx':base+'.ts');
 }});
 return exports;
}
const {ProcessesView,StoreOpeningBoard}=load('src/App.tsx');
const {defaultEmployees}=load('src/data.ts');
const day='2026-11-04';
const manager=defaultEmployees.find(p=>p.id==='005');
const check={id:day+'-Sucursal Centro',date:day,branch:'Sucursal Centro',minimumStaff:true,systemsReady:true,processComplete:true,
 managerAuthorizedAt:day+'T14:45:00Z',cashierAuthorizedAt:day+'T14:50:00Z',cashOpenConfirmedAt:day+'T14:50:00Z',erpReady:true,doorsOpenedAt:day+'T14:55:00Z',openedAt:day+'T14:55:00Z'};
const board=checks=>React.createElement(StoreOpeningBoard,{user:manager,today:day,cashSessions:[],cashCuts:[],checks,attendance:[],collaborators:defaultEmployees,onUpdate:()=>{},onOpenCash:()=>{}});
const legacy={id:'legacy',processId:'apertura',title:'Apertura antigua',date:day,ownerId:manager.id,startedById:manager.id,status:'Activo',notes:'Historia conservada',stepStates:[{title:'Paso anterior',done:false,evidence:'none',owner:'Gerente',note:''}]};
const screen=checks=>renderToStaticMarkup(React.createElement(ProcessesView,{openingBoard:board(checks),user:manager,collaborators:defaultEmployees,processInstances:[legacy],setProcessInstances:()=>{throw Error('No debe guardar otro proceso de apertura');},onNavigate:()=>{},notify:()=>{}}));
const opened=screen([check]);
assert.ok(opened.includes(renderToStaticMarkup(board([check]))),'Procesos debe mostrar exactamente el mismo control del Panel');
assert.match(opened,/registro compartido con Panel/);
assert.match(opened,/ABIERTA/);
assert.match(opened,/Historia conservada/);
assert.match(opened,/sólo consulta/);
assert.ok(!opened.includes('Completar proceso'),'La apertura anterior no debe tener un segundo formulario editable');
assert.ok(!opened.includes('Abrir checklist del Panel'),'El catálogo no debe duplicar la apertura');
assert.ok(screen([]).includes('>Autorizar apertura</button>'));
assert.match(screen([]),/TIENDA CERRADA|SIN APERTURA|Pendiente|PENDIENTE|Cerrada/);
const cashier={...manager,id:'007',role:'CAJERO'};
const worker={...manager,id:'011',role:'JEFE_AREA'};
for(const person of [cashier,worker]) {
 const html=renderToStaticMarkup(React.createElement(StoreOpeningBoard,{user:person,today:day,cashSessions:[],cashCuts:[],checks:[],attendance:[],collaborators:defaultEmployees,onUpdate:()=>{},onOpenCash:()=>{}}));
 assert.ok(!html.includes('>Autorizar apertura</button>'),'Sólo gerencia puede autorizar la apertura');
}
console.log('PASS: Panel y Procesos comparten apertura, estado, permisos e historial sin otro formulario');
