import { useEffect, useMemo, useState } from "react";
import { supabase } from "./cloudStore";
import { systemMetrics, sourceInfo, type MetricSources, type MetricRow } from "./systemKpis";
import { canGovern, type Employee } from "./data";
export function SystemKpis({user,collaborators,month,branch,role,onNavigate}:{user:Employee;collaborators:Employee[];month:string;branch:string;role:string;onNavigate:(view:string)=>void}) {
 const [sources,setSources]=useState<MetricSources>({});const [error,setError]=useState("");const [updated,setUpdated]=useState("");const [busy,setBusy]=useState(false);const [revision,setRevision]=useState(0);
 const [now,setNow]=useState(()=>new Date());
 const validMonth=/^\d{4}-(0[1-9]|1[0-2])$/.test(month);
 const selectedMonth=validMonth?month:new Date().toISOString().slice(0,7);
 const from=selectedMonth+"-01",to=new Date(Date.UTC(Number(selectedMonth.slice(0,4)),Number(selectedMonth.slice(5,7)),0,12)).toISOString().slice(0,10);
 useEffect(()=>{
  let alive=true,reading=false;setSources({});setUpdated("");
  const read=async()=>{
   if(reading||document.visibilityState==="hidden"||!supabase)return;reading=true;if(alive)setBusy(true);
   const client=supabase;
   const results=await Promise.allSettled([
    client.rpc("system_kpi_snapshot",{from_day:from,to_day:to}),
    client.rpc("centro_kpi_snapshot",{from_day:from,to_day:to}),
    client.rpc("store_opening_checks"),
    client.from("operation_day_plans").select("employee_number,day,branch,slots").gte("day",from).lte("day",to),
    client.rpc("work_preparation_metrics",{from_day:from,to_day:to}),
    client.rpc("staff_permission_metrics",{from_day:from,to_day:to}),
    client.rpc("invewin_metrics",{from_day:from,to_day:to}),
    client.rpc("weekly_report_metrics",{from_day:from,to_day:to}),
   ]);
   if(!alive)return;
   const next:MetricSources={};const errors:string[]=[];
   results.forEach((result,index)=>{
    const key=["system","centro_records","opening_records","planned_activity_records","preparation","permissions","invewin","weekly_reports"][index];
    if(result.status!=="fulfilled"||result.value.error){errors.push(["Registros operativos","Operación Centro","Apertura","Agenda guardada","Pedidos y uniforme","Permisos y ciclos de descanso","Proyecto Invewin","Reportes semanales"][index]);if(index===7){next.staff_weekly_reports={available:false,rows:[]};}else if(index===6){next.invewin_daily_records={available:false,rows:[]};}else if(index===5){next.staff_permission_records={available:false,rows:[]};next.staff_cycle_records={available:false,rows:[]};}else if(index===4){next.matriz_order_records={available:false,rows:[]};next.work_readiness_records={available:false,rows:[]};}else if(index>0)next[key]={available:false,rows:[]};return;}
    const data=result.value.data;
    if(index===0)Object.assign(next,data?.sources??{});
    else if(index===1)next[key]={available:true,rows:(data??[]).map((r:MetricRow)=>({...r,validationRequired:true}))};
    else if(index===4||index===5||index===6||index===7)Object.assign(next,data??{});
    else if(index===2)next[key]={available:true,rows:(data??[]).filter((r:MetricRow)=>r.date>=from&&r.date<=to)};
    else {
     if(!next.activity_run_records?.available){next[key]={available:false,rows:[]};errors.push("Estado de actividades no disponible");return;}
     const runs=next.activity_run_records.rows;const consumed=new Set<string>();
     const rows=(data??[]).flatMap((plan:any)=>(plan.slots??[]).filter((slot:any)=>slot.kind!=="Centro").map((slot:any)=>{
      const keys=[slot.key,...(slot.aliases??[])];const run=runs.find(r=>r.employeeId===plan.employee_number&&r.date===plan.day&&keys.includes(`${r.itemType}-${r.itemId}`));
      if(run)consumed.add(run.id);
      return {...run,id:run?.id??`${plan.employee_number}-${plan.day}-${slot.key}`,employeeId:plan.employee_number,date:plan.day,branch:plan.branch,start:slot.start,end:slot.end,slaMinutes:slot.slaMinutes,evidence:slot.evidence,requiresEvidence:slot.evidence!=="none",status:run?.status??"Pendiente"};
     }));
     next[key]={available:true,rows:[...rows,...runs.filter(r=>!consumed.has(r.id))]};
    }
   });
   setSources(next);setError(errors.length?`Consulta parcial. No se pudo leer: ${errors.join(", ")}. Los indicadores de esas fuentes no se consideran completos.`:"");setUpdated(new Date().toISOString());setNow(new Date());setBusy(false);reading=false;
  };
  if(!validMonth){setBusy(false);return;}
  void read();const timer=window.setInterval(()=>void read(),60000);const onSync=()=>void read();window.addEventListener("xoxo-sync",onSync);window.addEventListener("focus",onSync);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener("xoxo-sync",onSync);window.removeEventListener("focus",onSync);};
 },[from,to,revision,user.id,validMonth]);
 const scoped=useMemo(()=>Object.fromEntries(Object.entries(sources).map(([key,entry])=>[key,{...entry,rows:entry.rows.filter(row=>(branch==="Todas"||row.branch===branch)&&(role==="TODOS"||collaborators.find(person=>person.id===row.employeeId)?.role===role))}])),[sources,branch,role,collaborators]);
 const metrics=useMemo(()=>systemMetrics(scoped,now),[scoped,now]);const warnings=metrics.filter(m=>m.problem);
 const connected=Object.values(sources).filter(entry=>entry.available).length;
 const management=canGovern(user)||["GERENTE_TIENDA","ADMIN_TIENDA"].includes(user.role);
 if(!validMonth)return <article className="wide panelCard"><p>Selecciona un mes válido para consultar indicadores.</p></article>;
 return <article className="wide panelCard systemKpis"><div className="sectionHead"><div><h2>KPIs automáticos del sistema</h2><p>Estado actual de los registros de {from} a {to}. Cada indicador muestra su fuente y su cálculo. Las metas manuales se conservan abajo.</p><small>{updated?`Última consulta: ${new Date(updated).toLocaleString("es-MX",{timeZone:"America/Mexico_City"})}`:"Consultando fuentes…"} · Actualización cada minuto y después de guardar. {Object.keys(sources).length>0&&` · ${connected} fuentes disponibles · ${Object.keys(sources).length-connected} no disponibles`}</small></div><button className="ghost" disabled={busy} onClick={()=>setRevision(r=>r+1)}>{busy?"Actualizando…":"Actualizar indicadores"}</button></div>
 {error&&<p role="alert" className="calendarWarning">{error}</p>}
 {warnings.length>0&&<div className="systemKpiAlerts"><h3>Requiere atención</h3>{warnings.map(metric=><button className="ghost" key={metric.id} onClick={()=>onNavigate(metric.destination)}>{metric.name}: {metric.value?.toLocaleString("es-MX",{maximumFractionDigits:1})} {metric.unit} · Revisar fuente</button>)}</div>}
 <div className="systemKpiGrid">{metrics.map(metric=><article className={`systemKpiTile ${metric.problem?"systemKpiProblem":""}`} key={metric.id}><small>{sourceInfo[metric.source]?.name??metric.source}</small><h3>{metric.name}</h3><strong>{metric.value===null?"Sin datos evaluables":`${metric.unit==="$"?"$":""}${metric.value.toLocaleString("es-MX",{maximumFractionDigits:1})}${metric.unit==="%"?"%":metric.unit==="$"?"":` ${metric.unit}`}`}</strong><p>{metric.detail}</p><button className="ghost compact" onClick={()=>onNavigate(metric.destination)}>Ver registros de origen</button></article>)}</div>
 {!metrics.length&&!busy&&<p>No hay datos evaluables en las fuentes disponibles para estos filtros.</p>}
 <details className="systemKpiCoverage"><summary>Cobertura de módulos y calidad de datos ({Object.keys(sources).length} fuentes revisadas)</summary><p>Los módulos nuevos que guardan registros compatibles aparecen automáticamente aquí. Se muestra su volumen y estado; un cálculo especial requiere una regla explícita. No se mezclan porcentajes de áreas distintas en una calificación global ni se interpreta ausencia de datos como éxito.</p><div className="operationTable">{Object.entries(scoped).map(([key,entry])=><div className="operationRow" key={key}><strong>{sourceInfo[key]?.name??key.replace(/_records$/," ").replace(/_/g," ")}</strong><span>{entry.available?`${entry.rows.length} registros visibles`:"No disponible o sin permiso"}</span><small>{!entry.available?"Fuente definida, pendiente de acceso o activación":sourceInfo[key]?"Fuente integrada":"Módulo nuevo detectado: falta definir regla específica de cumplimiento"}{entry.available&&entry.rows.some(row=>row.status)&&` · ${Object.entries(entry.rows.reduce<Record<string,number>>((counts,row)=>{if(row.status)counts[row.status]=(counts[row.status]??0)+1;return counts;},{})).map(([status,count])=>`${status}: ${count}`).join(" · ")}`}</small></div>)}</div><p>{management?"La consulta respeta tu sucursal y permisos de gerencia.":"La consulta respeta el acceso a tus propios registros."} Las funciones que aún no guardan datos medibles no se califican automáticamente. Los registros sin sucursal guardada sólo aparecen al seleccionar Todas; no se les inventa una sucursal histórica.</p></details>
 </article>;
}
