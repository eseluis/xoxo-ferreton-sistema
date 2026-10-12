import { useState } from "react";
import type { ActivitySchedule, Employee } from "./data";
import { routineFor } from "./operationalAgenda";
import { shiftDateKey } from "./cleaningScoreboard";

export function WeeklyManagementAgenda({ user, schedules, today, onNavigate }: { user: Employee; schedules: ActivitySchedule[]; today: string; onNavigate: (view: string) => void }) {
  const [day, setDay] = useState(today);
  const items = routineFor(user, schedules, user.branch, day).filter(item => item.sharedRoutine);
  const week = Array.from({ length: 7 }, (_, offset) => shiftDateKey(today, offset));
  if (!week.some(date => routineFor(user, schedules, user.branch, date).some(item => item.sharedRoutine))) return null;
  return <article className="wide panelCard">
    <div className="sectionHead"><div><h2>Mi agenda semanal · {user.name} ({user.id})</h2><span>Actividades recurrentes con objetivo y entregable</span></div><button className="ghost compact" onClick={() => onNavigate("asistencia")}>Registrar avance y evidencia</button></div>
    <label>Día de la agenda<input type="date" value={day} onChange={event => { if (event.target.value) setDay(event.target.value); }} /></label>
    <div className="taskList">{items.map(item => <div key={item.id}>
      <h3>{item.start}–{item.end} · {item.name}</h3>
      <p><strong>Objetivo:</strong> {item.objective}</p><p>{item.instructions}</p>
    </div>)}</div>
    {!items.length && <p>No hay actividades recurrentes para este día.</p>}
  </article>;
}
