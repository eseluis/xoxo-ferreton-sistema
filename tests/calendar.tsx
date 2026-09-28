// Local fixture: only memory, no production reads or writes.
import React from "react";
import { createRoot } from "react-dom/client";
import { OperationCalendarView } from "../src/OperationCalendarView";
import { defaultEmployees } from "../src/data";
import type { CalendarRun, DayPlan } from "../src/dayCalendar";
import "../src/styles.css";
const user = defaultEmployees.find(e => e.id === "003")!;
const slots: DayPlan["slots"] = [{key:"Aseo-frente",kind:"Aseo",itemId:"frente",title:"Aseo de la entrada",start:"09:00",end:"09:30",instructions:"Limpiar entrada y mostrador. Registrar fotos antes y después; atender clientes y retomar.",evidence:"photo",slaMinutes:30}];
const plans: DayPlan[] = ["2026-10-01","2026-10-02","2026-10-03","2026-10-04"].map(day => ({employee_number:user.id,day,branch:"Matriz",slots}));
const runs: CalendarRun[] = plans.slice(0,2).map((p,i)=>({id:p.day,employeeId:user.id,date:p.day,itemType:"Aseo",itemId:"frente",title:slots[0].title,scheduledStart:"09:00",scheduledEnd:"09:30",slaMinutes:30,status:"Completada",evidence:"photo",beforeEvidenceCapture:{},afterEvidenceCapture:{},startedAt:`${p.day}T15:00:00Z`,completedAt:`${p.day}T15:${i ? '45' : '20'}:00Z`}));
let start="2026-10-01";
const api={readCalendar:async()=>({plans,centro:[],start}),saveProjectStart:async(value:string)=>{start=value;}};
createRoot(document.getElementById("root")!).render(<main style={{padding:"24px",maxWidth:"1250px",margin:"auto"}}><p>PRUEBA LOCAL · datos ficticios</p><OperationCalendarView user={user} collaborators={[user]} today="2026-10-04" runs={runs} tasks={[]} api={api} onNavigate={view=>window.alert(`Abrir: ${view}`)}/></main>);
