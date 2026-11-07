import type {DailyTask,Employee} from "./data";
export function priorityTasksFor(user:Pick<Employee,'id'>,location:string,day:string,tasks:DailyTask[]){
 return location==='Matriz'?tasks.filter(t=>t.employeeId===user.id&&t.date===day&&t.priority==='Alta'&&(!('branch' in t)||t.branch==='Matriz')).sort((a,b)=>a.start.localeCompare(b.start)):[];
}
export function PriorityTasksCard({user,location,day,tasks,onNavigate}:{user:Employee;location:string;day:string;tasks:DailyTask[];onNavigate:(view:string)=>void}){
 const rows=priorityTasksFor(user,location,day,tasks);if(!rows.length)return null;
 return <article className="wide panelCard" aria-label="Mis tareas prioritarias de hoy"><div className="sectionHead"><div><h2>Mis tareas prioritarias de hoy · Matriz</h2><p>{day} · {user.name} · Sólo corresponden a esta fecha.</p></div><button className="primary" onClick={()=>onNavigate('asistencia')}>Iniciar y registrar mis actividades</button></div><p><strong>Primero recibe y atiende o canaliza al cliente; después retoma tu tarea.</strong> Estas instrucciones tienen prioridad para hoy. Conserva los horarios de aseo y coordina con tu superior los cruces con actividades habituales.</p>{rows.map(t=><details key={t.id}><summary>{t.start}–{t.end} · {t.title} · {t.status}</summary><p>{t.notes}</p><p>Registra el resultado en la actividad asignada; el superior valida la entrega.</p></details>)}</article>;
}
