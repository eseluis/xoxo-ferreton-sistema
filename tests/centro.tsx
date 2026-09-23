import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CentroOperationView } from "../src/CentroOperationView";
import { todayKey, type Employee } from "../src/data";
import type { CentroContext } from "../src/centroStore";
import type { CentroRecord } from "../src/centroOperation";
import "../src/styles.css";
const day = todayKey();
const employees: Employee[] = [
  {id:'101',name:'Colaborador de prueba',role:'AUXILIAR',roleLabel:'Auxiliar',branch:'Sucursal Centro',area:'Atención',shift:'Completo',commissionBase:''},
  {id:'102',name:'Responsable de prueba',role:'GERENTE_TIENDA',roleLabel:'Gerente de tienda',branch:'Sucursal Centro',area:'Operación',shift:'Completo',commissionBase:''},
  {id:'003',name:'Supervisor de prueba',role:'GERENTE_GENERAL',roleLabel:'Gerente general',branch:'Matriz',area:'Dirección',shift:'Directivo',commissionBase:''},
];
let context: CentroContext = {roster:employees.slice(0,2).map(p=>({...p,start:'00:00',end:'23:59',present:true,arrived:true})),records:[],previous:[]};
let actor='101';
const api={
  fetchCentroContext: async()=>structuredClone(context),
  saveCentroRecord: async(targetDay:string,taskId:string,version:number,action:string,data:CentroRecord['data'],note='')=>{
    const old=context.records.find(r=>r.task_id===taskId);
    if ((old?.version??0)!==version) throw new Error('Conflicto de versión de prueba');
    const status = ({start:'En curso',resume:'En curso',pause:'Pausada',submit:'Por validar',approve:'Validada',reject:'Corrección'} as const)[action as 'start']??old?.status??'Pendiente';
    const record:CentroRecord={day:targetDay,task_id:taskId,owner_id:old?.owner_id??actor,status,version:version+1,data:structuredClone(data),history:[...(old?.history??[]),{at:new Date().toISOString(),actor,action,note}],updated_at:new Date().toISOString()};
    context.records=[...context.records.filter(r=>r.task_id!==taskId),record];return structuredClone(record);
  },
  assignCentroDay:async()=>{},
};
function Fixture(){const [user,setUser]=useState(employees[0]);const [key,setKey]=useState(0);return <main style={{margin:0,padding:24,maxWidth:1400}}><p><strong>Prueba local con datos ficticios · No guarda en producción</strong></p><div className="centroActions"><button onClick={()=>{actor='101';setUser(employees[0]);setKey(k=>k+1);}}>Ver como auxiliar</button><button onClick={()=>{actor='003';setUser(employees[2]);setKey(k=>k+1);}}>Ver como 003</button><button onClick={()=>{context.roster[1].present=!context.roster[1].present;setKey(k=>k+1);}}>Cambiar disponibilidad del segundo colaborador</button></div><CentroOperationView key={key} user={user} collaborators={employees} today={day} openingChecks={[]} onNavigate={()=>{}} onAssignmentsChanged={()=>{}} onPriorityPause={()=>{}} api={api}/></main>}
createRoot(document.getElementById('root')!).render(<Fixture/>);
