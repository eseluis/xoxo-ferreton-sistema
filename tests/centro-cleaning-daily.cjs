const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const React=require('react');
let seeds=[],stateIndex=0;
const react={...React,useEffect:()=>{},useRef:v=>({current:v}),useState:initial=>{const index=stateIndex++;let value=index<seeds.length?seeds[index]:typeof initial==='function'?initial():initial;return [value,next=>{value=typeof next==='function'?next(value):next;}];}};
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,Intl,require:n=>{
 if(n==='react')return react;if(n==='react/jsx-runtime')return require(n);
 if(n==='./calendarStore')return {saveDayPlan:()=>Promise.resolve()};
 if(n==='./centroStore')return {};
 if(n==='./CleaningPhotoInput')return {CleaningPhotoInput:()=>null};
 return load(path.resolve(path.dirname(file),n+'.ts'));
}});return exports;}
const {CentroOperationView}=load('src/CentroOperationView.tsx');
const day='2026-11-05';
const ruben={id:'011',name:'Ruben',role:'JEFE_AREA',roleLabel:'Jefe de área',branch:'Sucursal Centro',area:'Herramientas',shift:'B'};
const daniel={...ruben,id:'005',name:'Daniel',role:'GERENTE_TIENDA'};
const roster=[ruben,daniel].map(p=>({...p,start:'00:00',end:'23:59',present:true,arrived:true}));
const calls=[];
const api={fetchCentroContext:async()=>{},assignCentroDay:async()=>{},saveCentroRecord:async(d,id,version,action,data)=>{calls.push({d,id,version,action,data});return {day:d,task_id:id,version:version+1,owner_id:'011',status:action==='submit'?'Por validar':'En curso',data,history:[]};}};
function nodes(root){if(!root||typeof root!=='object')return [];return [root,...React.Children.toArray(root.props?.children).flatMap(nodes)];}
function render(user,records=[],present=true){stateIndex=0;seeds=[day,{roster:roster.map(p=>({...p,present:p.id===user.id?present:p.present})),records,previous:[],assignments:[{taskId:'aseo-1',ownerId:'011'},{taskId:'aseo-2',ownerId:'005'},{taskId:'inventario-1',ownerId:'005'}]},'','',true,false,'all','09:10',0,''];
 return CentroOperationView({user,collaborators:[ruben,daniel],today:day,openingChecks:[],onNavigate:()=>{},onAssignmentsChanged:()=>{},onPriorityPause:()=>{},api,cleaningOnly:true});
}
function taskTree(card){stateIndex=0;seeds=[];return card.type(card.props);}
(async()=>{
 let screen=render(ruben);let cards=nodes(screen).filter(n=>n.type?.name==='TaskCard');
 assert.equal(cards.length,1);assert.equal(cards[0].props.item.id,'aseo-1');assert.equal(cards[0].props.supervisor,false);
 let task=taskTree(cards[0]);let start=nodes(task).find(n=>n.type==='button'&&n.props.children==='Iniciar');assert.ok(start,'Registro diario debe permitir iniciar el aseo canónico de Centro');
 start.props.onClick();await new Promise(setImmediate);assert.equal(calls[0].id,'aseo-1');assert.equal(calls[0].action,'start');assert.equal(calls[0].version,0);
 const data={fotoAntes:'data:image/jpeg;base64,antes',fotoDespues:'data:image/jpeg;base64,despues',realizado:true};
 screen=render(ruben,[{day,task_id:'aseo-1',owner_id:'011',status:'En curso',version:1,data,history:[]}]);cards=nodes(screen).filter(n=>n.type?.name==='TaskCard');task=taskTree(cards[0]);
 const finish=nodes(task).find(n=>n.type==='button'&&n.props.children==='Terminar y enviar a validación');finish.props.onClick();await new Promise(setImmediate);
 assert.equal(calls[1].action,'submit');assert.equal(calls[1].version,1);assert.equal(calls[1].data.fotoAntes,data.fotoAntes);assert.equal(calls[1].data.fotoDespues,data.fotoDespues);
 screen=render(daniel);cards=nodes(screen).filter(n=>n.type?.name==='TaskCard');assert.equal(cards.length,1);assert.equal(cards[0].props.item.id,'aseo-2','El gerente también ve sólo su propio aseo en el registro diario');
 screen=render(ruben,[],false);cards=nodes(screen).filter(n=>n.type?.name==='TaskCard');assert.equal(cards[0].props.editable,false);assert.ok(!nodes(taskTree(cards[0])).some(n=>n.type==='button'&&n.props.children==='Iniciar'));
 const app=fs.readFileSync('src/App.tsx','utf8');assert.ok(app.includes('centroCleaningBoard={currentWorkLocation === "Sucursal Centro"'));
 console.log('Registro diario Centro: aseo propio, inicio y entrega con fotos usan el registro canónico, sin otra actividad ni permisos de validación.');
})().catch(e=>{console.error(e);process.exitCode=1;});
