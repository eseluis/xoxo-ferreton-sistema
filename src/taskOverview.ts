import type { DailyTask } from "./data";
import { activeMinutes } from "./priorityPause";
import { workTimeAt } from "./workFocus";

export const taskDayAt = (now: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
export const taskComplete = (task: DailyTask) => Boolean(task.completedAt || task.status === "Completada");
export function taskOverdueReason(task: DailyTask, now = new Date()) {
  if (taskComplete(task) || (task as DailyTask & { removedAt?: string }).removedAt) return "";
  const day = taskDayAt(now);
  if (task.date < day || task.date === day && task.end <= workTimeAt(now)) return "Horario de entrega vencido";
  if (task.startedAt && !task.pausedAt && !task.paused && !["Pausada", "Incidencia"].includes(task.status) && task.slaMinutes && activeMinutes(task, now.getTime()) > task.slaMinutes) return "Tiempo SLA excedido";
  return "";
}
export function taskMatchesFilter(task: DailyTask, filter: string, now = new Date()) {
  if (filter === "Todas") return true;
  if (filter === "Vencidas") return Boolean(taskOverdueReason(task, now));
  if (filter === "Sin terminar") return !taskComplete(task);
  if (filter === "Completada") return taskComplete(task);
  return !taskComplete(task) && task.status === filter;
}
export function taskCounts(tasks: DailyTask[], now = new Date()) {
  return { total: tasks.length, incomplete: tasks.filter(task => !taskComplete(task)).length,
    overdue: tasks.filter(task => taskOverdueReason(task, now)).length,
    pending: tasks.filter(task => taskMatchesFilter(task,"Pendiente",now)).length,
    running: tasks.filter(task => taskMatchesFilter(task,"En proceso",now)).length,
    complete: tasks.filter(taskComplete).length,
    paused: tasks.filter(task => taskMatchesFilter(task,"Pausada",now)).length,
    incidents: tasks.filter(task => taskMatchesFilter(task,"Incidencia",now)).length,
    missingEvidence: tasks.filter(task => task.requiresPhoto && (!task.beforeEvidenceCapture?.dataUrl || !task.afterEvidenceCapture?.dataUrl)).length };
}
