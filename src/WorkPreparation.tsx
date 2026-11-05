import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "./cloudStore";
import { canManageStore, type Employee } from "./data";

type Capture = {dataUrl:string;capturedAt:string};
type OrderStep = {id:string;employeeId:string;area:string;title:string;step:number;status:string;date:string;available:boolean;ownerAvailable:boolean;note?:string;reference?:string;startedAt?:string;completedAt?:string;followup:boolean};
type OrderContext = {rows:OrderStep[];week:{date:string;area:string;title:string;status:string;note?:string;reference?:string}[];clock:string;today:string};
type ReadinessRecord = {id:string;phase:string;checks:Record<string,boolean>;note:string;photo:string;status:string;completedAt:string;photoSubmittedAt?:string;color:string;tomorrowColor:string};
type ReadyContext = {today:string;variant:string;color:string;tomorrowColor:string;toolsRequired:boolean;applicable:boolean;entryPhotoRequired:boolean;exitPhotoRequired:boolean;rows:ReadinessRecord[];team:{employeeId:string;name:string;variant:string;branch:string}[]};
const DAYS=["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
export const ORDER_WEEK=[['Lunes','Electrodomésticos','Celina'],['Martes','Electricidad','Sabina'],['Miércoles','Plomería','Citlali'],['Jueves','Herramientas','Anubis'],['Viernes','Tornillería','Julio'],['Sábado','Seguimiento de todos los pedidos','Responsables de cada área']];
export function uniformWeek(variant:string) { return variant==='Hombres'?['Negro','Azul','Rojo','Verde','Negro','Azul','Rojo']:['Negro','Azul','Rojo','Negro','Azul','Rojo','Negro']; }
function dayKey(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function useWorkContext<T>(rpc:string,args:Record<string,unknown>={}) {
 const [data,setData]=useState<T>();const [error,setError]=useState('');const [revision,setRevision]=useState(0);const signature=JSON.stringify(args);
 useEffect(()=>{let alive=true,reading=false;const read=async()=>{
  if(reading||!supabase||document.visibilityState==='hidden')return;reading=true;
  try{const result=await supabase.rpc(rpc,JSON.parse(signature));if(result.error)throw result.error;if(alive){setData(result.data);setError('');}}
  catch(e){if(alive)setError(e instanceof Error?e.message:String((e as {message?:string})?.message??'No se pudo consultar la jornada'));}
  finally{reading=false;}
 };void read();const timer=setInterval(()=>void read(),30000);window.addEventListener('xoxo-work-preparation',read);window.addEventListener('focus',read);
 return()=>{alive=false;clearInterval(timer);window.removeEventListener('xoxo-work-preparation',read);window.removeEventListener('focus',read);};},[rpc,signature,revision]);
 return {data,error,refresh:()=>setRevision(n=>n+1)};
}
function sync(){window.dispatchEvent(new Event('xoxo-work-preparation'));window.dispatchEvent(new Event('xoxo-sync'));}

export function MatrizOrders({user,location,collaborators}:{user:Employee;location:string;collaborators:Employee[]}) {
 if(location!=='Matriz'&&!['APODERADA_LEGAL','DIRECTOR','GERENTE_GENERAL','ADMIN_GENERAL'].includes(user.role))return null;
 return <MatrizOrderContent user={user} collaborators={collaborators}/>;
}
function MatrizOrderContent({user,collaborators}:{user:Employee;collaborators:Employee[]}) {
 const today=dayKey();const {data,error,refresh}=useWorkContext<OrderContext>('matriz_orders_context',{day:today});
 const supervisor=canManageStore(user);const [showWeek,setShowWeek]=useState(false);
 return <article className="wide panelCard preparationCard" aria-label="Pedidos programados de Matriz">
  <div className="sectionHead"><div><h2>Pedidos de Matriz · 10:00–11:00</h2><span>Proceso obligatorio por área · {today} · hora de Ciudad de México</span></div><button type="button" onClick={refresh}>Actualizar</button></div>
  {error&&<p className="loginError" role="alert">No se pudo cargar el rol: {error}</p>}
  {!data&&!error&&<p>Cargando tus pasos…</p>}
  {supervisor&&<><button type="button" onClick={()=>setShowWeek(!showWeek)} aria-expanded={showWeek}>Ver rol semanal</button>{showWeek&&<div className="tableWrap"><table><thead><tr><th>Día</th><th>Área</th><th>Responsable</th></tr></thead><tbody>{ORDER_WEEK.map(r=><tr key={r[0]}>{r.map(c=><td key={c}>{c}</td>)}</tr>)}</tbody></table></div>}</>}
  <p className="muted">El auxiliar presente del área detecta faltantes; si no hay auxiliar disponible, lo hace el responsable del pedido. El jefe revisa y prepara el pedido. Gerencia valida y autoriza antes del envío.</p>
  {data?.rows.length===0&&<p>Hoy no tienes pasos de pedidos asignados. El sábado se revisan los pedidos de toda la semana.</p>}
  {data&&data.rows.length>0&&<p className={`statusPill ${data.clock>'11:00'?'warn':'ok'}`}>{data.clock<'10:00'?'Programado: el botón para empezar se habilita a las 10:00.':data.clock>'11:00'?'La ventana terminó. Los pasos pendientes siguen obligatorios y se registran con retraso.':'Es hora de realizar el pedido de tu área.'}</p>}
  <div className="orderSteps">{data?.rows.map(step=><OrderStepCard key={step.id} step={step} own={step.employeeId===user.id} clock={data.clock} owner={collaborators.find(p=>p.id===step.employeeId)?.name??step.employeeId} onSaved={()=>{sync();refresh();}}/>)}</div>
  {data?.week.length!==0&&data?.week&&<details><summary>Pedidos y avances de esta semana a los que tienes acceso</summary><div className="taskList">{data.week.map((r,i)=><div key={i}><strong>{r.area} · {r.date} · {r.status}</strong><p>{r.title}: {r.note||'Sin resultado registrado'} {r.reference}</p></div>)}</div></details>}
 </article>;
}
function OrderStepCard({step,own,clock,owner,onSaved}:{step:OrderStep;own:boolean;clock:string;owner:string;onSaved:()=>void}) {
 const [note,setNote]=useState(step.note??'');const [reference,setReference]=useState(step.reference??'');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const done=step.status==='Completada';
 const act=async(action:string)=>{if(!supabase)return;setBusy(true);setError('');try{const r=await supabase.rpc('matriz_order_action',{id:step.id,action,note,reference});if(r.error)throw r.error;onSaved();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <section className="preparationStep"><div className="sectionHead"><strong>{step.area} · Paso {step.step}: {step.title}</strong><span className={`statusPill ${done?'ok':clock>'11:00'?'danger':'warn'}`}>{step.status}</span></div>
  <p>Responsable: {owner} · Matriz · 10:00–11:00</p>
  {!step.ownerAvailable&&!done&&<p className="loginError">El responsable no está asignado a Matriz hoy o su acceso está inactivo. Gerencia debe revisar la cobertura.</p>}
  {!step.available&&!done&&<p className="muted">En espera de que termine el paso anterior. Sólo ves los pasos que te corresponden.</p>}
  {done?<><p>{step.note}</p>{step.reference&&<p>Folio / enlace: {step.reference}</p>}<small>Entrega: {new Date(step.completedAt!).toLocaleString('es-MX',{timeZone:'America/Mexico_City'})}</small></>:own&&step.available&&step.ownerAvailable&&<>
   {!step.startedAt?<button type="button" className="primary" disabled={busy||clock<'10:00'} onClick={()=>void act('start')}>Empezar {step.step===1?'pedido':'paso'}</button>:<>
    <label>Resultado del paso<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Productos, cantidades, revisión o resultado. Si no hay faltantes, indícalo." maxLength={4000}/></label>
    <label>Folio o enlace de Alegra POS / pedido{!step.followup&&step.step===3?' (obligatorio; Sin pedido si no hay faltantes)':' (opcional)'}<input value={reference} onChange={e=>setReference(e.target.value)} maxLength={2000}/></label>
    <button type="button" className="primary" disabled={busy||note.trim().length<10||!step.followup&&step.step===3&&reference.trim().length<3} onClick={()=>void act('complete')}>{busy?'Guardando…':'Entregar paso y continuar'}</button>
   </>}
  </>}
  {error&&<p className="loginError" role="alert">{error}</p>}
 </section>;
}

export function UniformRole({user}:{user:Employee}) {
 const {data,error,refresh}=useWorkContext<ReadyContext>('work_readiness_context');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 const setVariant=async(person:string,variant:string)=>{if(!supabase)return;setBusy(true);setMessage('');try{const r=await supabase.rpc('set_work_uniform',{person,variant});if(r.error)throw r.error;sync();refresh();setMessage('Rol de uniforme guardado.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}};
 if(data&&!data.applicable&&!canManageStore(user))return null;
 return <article className="wide panelCard preparationCard"><div className="sectionHead"><div><h2>Rol de uniforme y herramientas</h2><span>{data?`Hoy: ${data.color} · Mañana: ${data.tomorrowColor}`:'Cargando rol…'}</span></div></div>
  {error&&<p className="loginError">{error}</p>}
  {data&&<><p>{data.variant==='Comun'?'Rol común provisional (sin verde). Gerencia puede asignar el rol correspondiente.':`Tu rol: ${data.variant}.`}{data.toolsRequired?' Trae cutter, flexómetro y guantes en entrada y salida.':''}</p>
   <div className="uniformWeek">{uniformWeek(data.variant).map((color,i)=><div key={i}><small>{DAYS[i]}</small><strong><i className={`shirtColor shirt${color}`}/>{color}</strong></div>)}</div>
   <p>Completa el checklist al registrar entrada y salida. Un día aleatorio de cada semana se solicita una foto en cada checada, mostrando uniforme{data.toolsRequired?' y herramientas':''}. Si no te presentas el día elegido, se pide en tu siguiente jornada de esa semana.</p>
   {(data.entryPhotoRequired||data.exitPhotoRequired)&&<p className="statusPill warn">Hoy corresponde evidencia semanal: {data.entryPhotoRequired?'entrada ':''}{data.exitPhotoRequired?'salida':''}.</p>}
   {canManageStore(user)&&<details><summary>Asignar rol de uniforme por colaborador</summary><div className="preparationTeam">{data.team.map(p=><label key={p.employeeId}>{p.name} · {p.branch}<select aria-label={`Rol de uniforme de ${p.name}`} disabled={busy} value={p.variant} onChange={e=>void setVariant(p.employeeId,e.target.value)}><option value="Comun">Común · pendiente de asignar</option><option value="Mujeres">Mujeres · negro, azul y rojo</option><option value="Hombres">Hombres · negro, azul, rojo y verde</option></select></label>)}</div></details>}
  </>}{message&&<p role="status">{message}</p>}
 </article>;
}

export function AttendanceReadiness({user,renderPhoto}:{user:Employee;renderPhoto:(value:Capture|undefined,onCapture:(photo:Capture)=>void,onClear:()=>void)=>ReactNode}) {
 const {data,error,refresh}=useWorkContext<ReadyContext>('work_readiness_context');const [phase,setPhase]=useState('in');const [checks,setChecks]=useState<Record<string,boolean>>({});const [note,setNote]=useState('');const [photo,setPhoto]=useState<Capture>();const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const record=data?.rows.find(r=>r.phase===phase);
 useEffect(()=>{setChecks(record?.checks??{});setNote(record?.note??'');setPhoto(record?.photo?{dataUrl:record.photo,capturedAt:record.photoSubmittedAt??record.completedAt}:undefined);setMessage('');},[user.id,data?.today,phase,record?.completedAt]);
 if(data&&!data.applicable)return null;
 const keys=data?.toolsRequired?['cutter','flexometro','guantes','uniform']:['uniform'];const names:Record<string,string>={cutter:'Cutter',flexometro:'Flexómetro',guantes:'Guantes',uniform:`Playera ${data?.color??''}`};
 const required=phase==='in'?data?.entryPhotoRequired:data?.exitPhotoRequired;
 const answered=keys.every(k=>typeof checks[k]==='boolean');const incident=keys.some(k=>checks[k]===false);
 const save=async()=>{if(!supabase)return;setBusy(true);setMessage('');try{const result=await supabase.rpc('save_work_readiness',{phase,checks,note,photo:photo?.dataUrl??''});if(result.error)throw result.error;setMessage('Checklist guardado. Ya puedes registrar la checada correspondiente.');sync();refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}};
 return <section className="readinessChecklist" aria-label="Checklist de entrada y salida"><h3>Herramientas y uniforme · {phase==='in'?'entrada':'salida'}</h3>
  <div className="readinessTabs"><button type="button" aria-pressed={phase==='in'} onClick={()=>setPhase('in')}>Checklist de entrada</button><button type="button" aria-pressed={phase==='out'} onClick={()=>setPhase('out')}>Checklist de salida</button></div>
  {error&&<p className="loginError">{error}</p>}
  {data&&<><p>Hoy: <strong>{data.color}</strong>{phase==='out'&&<> · Para mañana: <strong>{data.tomorrowColor}</strong></>}</p>
   {keys.map(k=><label className="readinessItem" key={k}>{names[k]}<select aria-label={`${names[k]} en ${phase==='in'?'entrada':'salida'}`} value={typeof checks[k]==='boolean'?String(checks[k]):''} onChange={e=>setChecks(v=>({...v,[k]:e.target.value==='true'}))}><option value="" disabled>Selecciona</option><option value="true">Sí, lo porto</option><option value="false">No, reportar incidencia</option></select></label>)}
   <label>{incident?'Describe lo que falta (obligatorio)':'Observaciones (opcional)'}<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={2000}/></label>
   {(required||photo)&&<div><p><strong>Foto semanal de {phase==='in'?'entrada':'salida'}:</strong> muestra tu playera{data.toolsRequired?', cutter, flexómetro y guantes':''} en la misma foto.</p>{renderPhoto(photo,setPhoto,()=>setPhoto(undefined))}</div>}
   <button type="button" className="primary" disabled={busy||!answered||incident&&note.trim().length<10||required&&!photo} onClick={()=>void save()}>{busy?'Guardando…':`Guardar checklist de ${phase==='in'?'entrada':'salida'}`}</button>
   {record&&<p className={`statusPill ${record.status==='Conforme'?'ok':'warn'}`}>Guardado: {record.status} · {new Date(record.completedAt).toLocaleTimeString('es-MX',{timeZone:'America/Mexico_City'})}</p>}
  </>}{message&&<p role="status">{message}</p>}
 </section>;
}
