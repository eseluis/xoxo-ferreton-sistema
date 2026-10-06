import { useEffect, useState } from "react";
import { canViewAll, type Employee, type DailyTask } from "./data";
import { TaskSummary } from "./TaskSummary";
import { taskComplete, taskDayAt, taskMatchesFilter, taskOverdueReason } from "./taskOverview";

export function TodayAssignedActivities({ user, collaborators, tasks, onNavigate }: { user: Employee; collaborators: Employee[]; tasks: DailyTask[]; onNavigate: (view: string) => void }) {
  const [scope, setScope] = useState("resumen");
  const [progress, setProgress] = useState("Todas");
  const [employeeId, setEmployeeId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 15000); return () => window.clearInterval(timer); }, []);
  const today = taskDayAt(now);
  const visible = tasks.filter(task => canViewAll(user) || task.employeeId === user.id || task.assignedById === user.id);
  const dayTasks = visible.filter(task => scope === "programadas" ? task.date === today : scope === "asignadas" ? Boolean(task.assignedAt && Number.isFinite(Date.parse(task.assignedAt)) && taskDayAt(new Date(task.assignedAt)) === today) : true)
    .filter(task => (!employeeId || task.employeeId === employeeId) && (!dateFrom || task.date >= dateFrom) && (!dateTo || task.date <= dateTo) && `${task.title} ${task.notes}`.toLocaleLowerCase("es-MX").includes(search.trim().toLocaleLowerCase("es-MX")));
  const rows = dayTasks.filter(task => taskMatchesFilter(task, progress, now))
    .sort((a, b) => Number(Boolean(taskOverdueReason(b, now))) - Number(Boolean(taskOverdueReason(a, now))) || a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  const person = (id: string) => collaborators.find(employee => employee.id === id)?.name ?? id;
  const time = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Sin registro";
  return <article className="wide panelCard">
    <div className="sectionHead"><div><h2>Resumen de tareas</h2><span>{today} · vencidas primero · incluye días anteriores</span></div><div className="inlineTimes"><button className="ghost compact" onClick={() => onNavigate("tareas")}>Seguimiento completo</button><button className="ghost compact" onClick={() => onNavigate("asistencia")}>Actividades sin culminar</button><button className="ghost compact" onClick={() => onNavigate("evidencias")}>Evidencias de días anteriores</button></div></div>
    <div className="todayActivitiesFilters">
      <label>Mostrar<select value={scope} onChange={event => setScope(event.target.value)}><option value="resumen">Todo el historial</option><option value="programadas">Programadas para hoy</option><option value="asignadas">Asignadas hoy</option></select></label>
      <label>Colaborador<select value={employeeId} onChange={event => setEmployeeId(event.target.value)}><option value="">Todos</option>{collaborators.filter(employee => visible.some(task => task.employeeId === employee.id)).map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
      <label>Estado<select value={progress} onChange={event => setProgress(event.target.value)}>{["Todas", "Vencidas", "Sin terminar", "Pendiente", "En proceso", "Completada", "Pausada", "Incidencia"].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Desde<input type="date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} /></label><label>Hasta<input type="date" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} /></label>
      <label>Buscar tarea<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Título o instrucciones" /></label>
      <button className="ghost compact" onClick={() => { setScope("resumen"); setProgress("Todas"); setEmployeeId(""); setDateFrom(""); setDateTo(""); setSearch(""); }}>Limpiar filtros</button>
    </div>
    <TaskSummary tasks={dayTasks} now={now} onFilter={setProgress} />
    <p className="muted">Mostrando {rows.length} de {dayTasks.length} tareas del periodo y colaboradores seleccionados.</p>
    {scope === "asignadas" && <p className="muted">Incluye tareas para otras fechas. Las tareas sin fecha de asignación registrada no aparecen en este filtro.</p>}
    <div className="todayActivitiesTable"><table><thead><tr><th>Actividad / horario</th><th>Responsable</th><th>Estado</th><th>Evidencia</th><th>Inicio</th><th>Finalización</th><th>Asignó</th></tr></thead><tbody>{rows.map(task => <tr key={task.id}>
      <td><strong>{task.title}</strong><small>{task.date} · {task.start}–{task.end}</small></td><td>{person(task.employeeId)}</td>
      <td><span className={`statusPill ${taskComplete(task) ? "ok" : taskOverdueReason(task, now) ? "danger" : "warn"}`}>{taskComplete(task) ? "Completada" : task.status}</span>{taskOverdueReason(task, now) && <small className="danger">Vencida · {taskOverdueReason(task, now)}</small>}</td>
      <td>{task.requiresPhoto ? task.beforeEvidenceCapture?.dataUrl && task.afterEvidenceCapture?.dataUrl ? "Completa" : "Falta evidencia" : "No requerida"}</td>
      <td>{time(task.startedAt)}</td><td>{time(task.completedAt)}</td><td>{person(task.assignedById)}</td>
    </tr>)}</tbody></table></div>
    {rows.length === 0 && <p className="muted">No hay actividades asignadas con estos filtros.</p>}
  </article>;
}
