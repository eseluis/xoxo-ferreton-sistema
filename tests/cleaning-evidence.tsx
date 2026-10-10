// Prueba visual local: sin autenticación ni escrituras de producción.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AttendanceView } from "../src/App";
import { defaultEmployees, type CleaningRole } from "../src/data";
import "../src/styles.css";

const employee = { ...defaultEmployees.find(person => person.id === "015")!, name: "Citlali", branch: "Matriz" };
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
const cleaning: CleaningRole = { branch:"Matriz", activity:"Trapear atrás", start:"09:30", end:"10:00", details:"Trapear atrás y dejar el paso libre. Atender primero al cliente.", assignments:Object.fromEntries(["Domingo","Lunes","Martes","Miercoles","Jueves","Viernes","Sabado"].map(day=>[day,"Citlali"])) };
function Fixture() {
  const [runs,setRuns] = useState<any[]>([]);
  return <main style={{padding:20}}><h1>Prueba local de aseo · Citlali</h1><AttendanceView
    user={employee} attendance={[]} dailyClosures={[]} collaborators={[employee]} updateAttendance={()=>{}} registerAttendanceFor={()=>{}}
    activitySchedules={[]} cleaningAssignment="Trapear atrás" cleaningRows={[cleaning]} dailyTasks={[]} allDailyTasks={[]} setDailyTasks={()=>{}} startDailyTask={()=>{}}
    activityRuns={runs} workLocation="Matriz" startActivityRun={item=>setRuns(current=>current.length ? current : [{...item,id:'local-aseo',employeeId:'015',date:today,startedAt:new Date().toISOString(),status:'En curso'}])}
    completeActivityRun={id=>setRuns(current=>current.map(run=>run.id===id ? {...run,completedAt:new Date().toISOString(),status:'Completada'}:run))}
    setActivityEvidence={()=>{}} setActivityPhoto={(id,phase,value)=>setRuns(current=>current.map(run=>run.id===id ? {...run,[phase==='before'?'beforeEvidenceCapture':'afterEvidenceCapture']:value}:run))}
  /></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
