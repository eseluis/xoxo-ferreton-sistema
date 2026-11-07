import {useEffect,useRef,useState} from "react";
import {supabase} from "./cloudStore";
import type {DailyTask,Employee} from "./data";
export function AreaHandoverReminder({user,onTasks,onNavigate}:{user:Employee;onTasks:(tasks:DailyTask[])=>void;onNavigate:(view:string)=>void}){
 const callback=useRef(onTasks);callback.current=onTasks;
 const [context,setContext]=useState<{day:string;clock:string;tasks:DailyTask[]}>();const [error,setError]=useState('');
 useEffect(()=>{let alive=true;let signature='';const refresh=async()=>{if(!supabase||document.visibilityState==='hidden')return;const {data,error}=await supabase.rpc('area_handover_context');if(!alive)return;if(error){setError(error.message);return;}setContext(data);setError('');const next=JSON.stringify(data.tasks.map((t:DailyTask)=>[t.id,t.start,t.end]));if(next!==signature){signature=next;callback.current(data.tasks);}};void refresh();const timer=window.setInterval(()=>void refresh(),30000);window.addEventListener('focus',refresh);return()=>{alive=false;window.clearInterval(timer);window.removeEventListener('focus',refresh);};},[user.id]);
 const own=context?.tasks.find(t=>t.employeeId===user.id);const due=own&&context&&context.clock>=own.start&&!own.completedAt;
 if(user.role!=='JEFE_AREA')return null;
 return <aside className="panelCard" role={due?'alert':'note'} aria-label="Entrega diaria de mostradores y zonas libres"><strong>{due?'ES HORA DE ENTREGAR TU ÁREA':'Entrega diaria con evidencia obligatoria'}</strong>{own?<p>{own.start}–{own.end} · {own.title}. Mostradores limpios, mercancía acomodada y zonas de trabajo y pasillos libres. Fotos del antes y del resultado final obligatorias. {own.completedAt?'Entrega registrada; consulta su validación.':'Comienza cinco minutos antes de tu salida configurada.'}</p>:<p>{error?`No se pudo confirmar la tarea: ${error}`:'La tarea se asigna en tus días de trabajo según la hora de salida configurada.'}</p>}<p>Primero recibe y atiende o canaliza al cliente; después retoma tu actividad.</p>{own&&<button className="primary" onClick={()=>onNavigate('asistencia')}>Ver mi tarea y registrar evidencia</button>}</aside>;
}
