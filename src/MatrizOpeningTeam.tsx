import {useEffect,useRef,useState} from "react";
import {supabase} from "./cloudStore";
import {retryTransaction} from "./transactionRetry";
import {canGovern,type Employee} from "./data";
export type OpeningStep={id:string;step:string;title:string;description:string;start:string;end:string;employeeId:string;ownerName:string;status:string;version:number;preview?:boolean;ownerAvailable?:boolean;completedAt?:string;completedByName?:string;onTime?:boolean};
export type OpeningTeamContext={applicable:boolean;required:boolean;legacyOpened:boolean;steps:OpeningStep[];owners:Record<string,string>;configVersion:number;canConfigure:boolean;canCover?:boolean;candidates:{id:string;name:string}[];clock:string;opening?:Record<string,unknown>};
export function useMatrizOpening(day:string) {
 const [context,setContext]=useState<OpeningTeamContext>();const [error,setError]=useState("");const [busy,setBusy]=useState(false);const [revision,setRevision]=useState(0);const mutation=useRef(0);const applying=useRef(false);
 useEffect(()=>{let alive=true,reading=false;const read=async()=>{if(reading||!supabase||document.visibilityState==="hidden")return;reading=true;const version=mutation.current;
  try{const r=await retryTransaction(()=>supabase!.rpc("matriz_opening_context",{day}));if(r.error)throw r.error;if(alive&&version===mutation.current){setContext(r.data);setError("");}}
  catch(e){if(alive&&version===mutation.current)setError((e as Error).message);}finally{reading=false;}};
  void read();const timer=setInterval(()=>void read(),15000);const focus=()=>void read();window.addEventListener("focus",focus);window.addEventListener("matriz-opening-refresh",focus);document.addEventListener("visibilitychange",focus);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener("focus",focus);window.removeEventListener("matriz-opening-refresh",focus);document.removeEventListener("visibilitychange",focus);};},[day,revision]);
 const apply=async(rpc:string,args:Record<string,unknown>)=>{if(!supabase)throw Error("Sin conexión para confirmar el paso");if(applying.current)return false;applying.current=true;mutation.current++;setBusy(true);setError("");try{const r=await retryTransaction(()=>supabase!.rpc(rpc,args));if(r.error)throw r.error;setContext(r.data);window.dispatchEvent(new Event("matriz-opening-refresh"));window.dispatchEvent(new CustomEvent("xoxo-sync",{detail:{key:"xoxo.storeOpeningChecks",error:""}}));return true;}catch(e){setError((e as Error).message);return false;}finally{applying.current=false;setBusy(false);}};
 return {context,error,busy,refresh:()=>setRevision(n=>n+1),mark:(step:OpeningStep)=>apply("mark_matriz_opening_step",{step_id:step.step,expected_version:step.version}),save:(owners:Record<string,string>,version:number)=>apply("save_matriz_opening_owners",{owners,expected_version:version})};
}
export function canCoverOpening(user:Employee){return ["001","002","003","009"].includes(user.id)||["ADMIN_GENERAL","ADMIN_TIENDA"].includes(user.role);}
export function openingTeamReady(context?:OpeningTeamContext) {return !!context&&(!context.required||context.steps.length===4&&context.steps.every(s=>s.status==="Completada"));}
export function stepBlockReason(step:OpeningStep,context:OpeningTeamContext,user:Employee) {
 if(step.status==="Completada")return "";
 if(step.preview||!context.required)return "El nuevo rol se aplicará en la próxima apertura.";
 if(step.employeeId!==user.id&&!context.canCover)return "Debe marcarlo la persona encargada.";
 if(step.ownerAvailable===false&&!context.canCover)return "El encargado no está asignado a Matriz hoy. Gerencia debe revisar la asignación.";
 if(context.clock<step.start)return `Se habilita a las ${step.start}.`;
 if(step.step==="shutters"&&!context.steps.some(s=>s.step==="authorization"&&s.status==="Completada"))return "Pendiente de autorización para abrir cortinas y portón.";
 return "";
}
export function MatrizOpeningTeam({user,control}:{user:Employee;control:ReturnType<typeof useMatrizOpening>}) {
 const {context,error,busy}=control;
 if(context&&!context.applicable)return null;
 return <section className="matrizOpeningTeam" aria-label="Apertura en equipo de Matriz"><div className="sectionHead"><div><h3>Apertura en equipo · Matriz</h3><p>Cada encargado marca su parte. Cortinas y portón permanecen pendientes hasta la autorización expresa.</p></div><button className="ghost compact" type="button" onClick={control.refresh}>Actualizar progreso</button></div>
  {error&&<p className="loginError" role="alert">No se pudo confirmar el proceso: {error}</p>}
  {!context&&!error&&<p>Cargando encargados y autorizaciones…</p>}
  {context?.legacyOpened&&<p className="calendarWarning">La apertura de hoy ya estaba registrada. Se conserva su historial; el nuevo rol se aplicará en la próxima apertura.</p>}
  <div className="matrizOpeningSteps">{context?.steps.map(step=>{const reason=stepBlockReason(step,context,user);const done=step.status==="Completada";return <article className="matrizOpeningStep" key={step.id}><div className="sectionHead"><strong>{step.title}</strong><span className={`statusPill ${done?"ok":"warn"}`}>{done?"Realizado":step.step==="shutters"?(context.steps.some(s=>s.step==="authorization"&&s.status==="Completada")?"Autorizado · pendiente de apertura":"Pendiente de autorización"):"Pendiente"}</span></div><p><strong>{step.ownerName||step.employeeId}</strong> · {step.start}–{step.end}</p><p>{step.description}</p>
   {done?<p className={step.onTime?"ok":"warn"}>{step.completedByName||step.ownerName} · {new Date(step.completedAt!).toLocaleString("es-MX",{timeZone:"America/Mexico_City"})} · {step.onTime?"En tiempo":"Fuera de horario"}</p>:<><p className="muted">{reason||"Confirma sólo cuando hayas realizado tu parte."}</p>{(step.employeeId===user.id||context.canCover)&&<button type="button" className="primary" disabled={busy||!!reason} onClick={()=>void control.mark(step)}>{busy?"Confirmando…":step.step==="authorization"?"Autorizar cortinas y portón":step.employeeId===user.id?"Marcar mi parte realizada":"Realizar paso por suplencia"}</button>}</>}
  </article>;})}</div>
  {context?.canCover&&<details><summary>Cambio de último momento: reasignar encargados</summary><OpeningSettingsForm/></details>}
  {context?.canConfigure&&<p className="muted">Los encargados se cambian en Configuración → Responsables de apertura de Matriz.</p>}
 </section>;
}
export function MatrizOpeningSettings({user}:{user:Employee}) {
 if(!canCoverOpening(user)&&!canGovern(user)&&!(user.branch==="Matriz"&&["GERENTE_TIENDA","ADMIN_TIENDA"].includes(user.role)))return null;
 return <OpeningSettingsForm/>;
}
function OpeningSettingsForm() {
 const day=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const control=useMatrizOpening(day);const {context,busy,error}=control;const [draft,setDraft]=useState<Record<string,string>>({});const [version,setVersion]=useState(0);const [dirty,setDirty]=useState(false);const [notice,setNotice]=useState("");
 useEffect(()=>{if(context&&!dirty){setDraft(context.owners);setVersion(context.configVersion);}},[context?.configVersion,dirty]);
 return <article className="wide panelCard matrizOpeningSettings"><div className="sectionHead"><div><h2>Responsables de apertura de Matriz</h2><p>La asignación se aplica a los pasos pendientes. Lo ya realizado conserva la persona que lo marcó.</p></div><button type="button" className="ghost" onClick={control.refresh}>Actualizar</button></div>
  {error&&<p className="loginError" role="alert">{error}</p>}
  {context?.canConfigure&&<form onSubmit={async e=>{e.preventDefault();setNotice("");if(await control.save(draft,version)){setDirty(false);setNotice("Encargados de apertura guardados.");}}}>
   <div className="matrizOpeningSteps">{context.steps.map(step=><label className="matrizOpeningStep" key={step.step}><strong>{step.title}</strong><span>{step.start}–{step.end} · Sólo Matriz</span><select aria-label={`Encargado de ${step.title}`} value={draft[step.step]??""} disabled={busy} required onChange={e=>{setDirty(true);setDraft(old=>({...old,[step.step]:e.target.value}));}}><option value="" disabled>Seleccionar encargado</option>{!context.candidates.some(c=>c.id===draft[step.step])&&draft[step.step]&&<option value={draft[step.step]}>{step.ownerName||draft[step.step]} · revisar asignación</option>}{context.candidates.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>)}</div>
   {dirty&&version!==context.configVersion&&<p className="loginError">Otra sesión cambió los encargados. Tu borrador se conserva; actualiza antes de guardar.</p>}
   <button type="submit" className="primary" disabled={busy||!dirty||version!==context.configVersion}>{busy?"Guardando…":"Guardar encargados de Matriz"}</button>{dirty&&<button type="button" className="ghost" onClick={()=>{setDirty(false);setDraft(context.owners);setVersion(context.configVersion);}}>Cargar asignación vigente</button>}
  </form>}{notice&&<p role="status">{notice}</p>}
 </article>;
}
