import type { AgendaSlot } from "./operationalAgenda";
import { findSlotRun } from "./operationalAgenda";
import { activeMinutes } from "./priorityPause";
import type { CentroRecord } from "./centroOperation";
import { CENTRO_TASKS } from "./centroOperation";

export type DayPlan = { employee_number: string; day: string; branch: string; slots: AgendaSlot[]; created_at?: string };
export type CalendarRun = { id: string; employeeId: string; date: string; itemType: "Actividad" | "Aseo"; itemId: string; title: string; scheduledStart: string; scheduledEnd: string; slaMinutes: number; status: string; evidence?: string; beforeEvidenceCapture?: unknown; afterEvidenceCapture?: unknown; evidenceCapture?: unknown; startedAt?: string; completedAt?: string; pausedAt?: string; pausedMinutes?: number };
export type CalendarTask = { id: string; employeeId: string; date: string; title: string; start: string; end: string; notes: string; status: string; startedAt?: string; completedAt?: string; pausedAt?: string; pausedMinutes?: number; slaMinutes?: number; requiresPhoto?: boolean; beforeEvidenceCapture?: unknown; afterEvidenceCapture?: unknown; affectsEvaluation?: boolean };
export type DayItem = { key: string; title: string; start: string; end: string; instructions: string; state: "done" | "late" | "review" | "pending" | "issue"; reason: string; destination: string; optional?: boolean };
export type DayResult = { color: "green" | "yellow" | "red" | "gray"; label: string; explanation: string; done: number; total: number };
export function dayItems(day: string, employeeId: string, plan: DayPlan | undefined, runs: CalendarRun[], tasks: CalendarTask[], centro: CentroRecord[]): DayItem[] {
  const ownRuns = runs.filter(r => r.employeeId === employeeId && r.date === day);
  const records = centro.filter(r => r.day === day);
  const slots = [...(plan?.slots ?? [])];
  ownRuns.forEach(r => { if (!slots.some(s => [s.key, ...(s.aliases ?? [])].includes(`${r.itemType}-${r.itemId}`))) slots.push({ key: `${r.itemType}-${r.itemId}`, kind: r.itemType, itemId: r.itemId, title: r.title, start: r.scheduledStart, end: r.scheduledEnd, instructions: "Registro conservado de la actividad original.", evidence: r.evidence ?? "none", slaMinutes: r.slaMinutes }); });
  records.filter(r => r.owner_id === employeeId).forEach(r => {
    const t = CENTRO_TASKS.find(t => t.id === r.task_id);
    if (t && !slots.some(s => s.key === `Centro-${t.id}`)) slots.push({ key: `Centro-${t.id}`, kind: "Centro", itemId: t.id, title: t.title, start: t.start, end: t.end, instructions: t.instructions, evidence: t.evidence ? "link" : "none", slaMinutes: 0 });
  });
  const items: DayItem[] = slots.flatMap<DayItem>(slot => {
    if (slot.kind === "Centro") {
      const r = records.find(r => r.task_id === slot.itemId);
      if (r && r.owner_id !== employeeId) return []; // transferred obligation belongs to the current owner
      const state = r?.status === "Validada" ? "done" : r?.status === "Por validar" ? "review" : r?.status === "Corrección" ? "issue" : "pending";
      return [{ ...slot, state, reason: r?.status ?? "Sin iniciar", destination: "operacion-centro" }];
    }
    const r = findSlotRun(slot, ownRuns);
    const evidence = slot.evidence === "photo" ? Boolean(r?.beforeEvidenceCapture && r?.afterEvidenceCapture) : slot.evidence !== "none" ? Boolean(r?.evidenceCapture) : true;
    const late = r?.completedAt && activeMinutes(r) > slot.slaMinutes;
    const state = r?.completedAt ? (!evidence ? "issue" : late ? "late" : "done") : r?.status === "Incidencia" ? "issue" : "pending";
    return [{ ...slot, state, reason: r?.completedAt ? !evidence ? "Falta evidencia requerida" : late ? "Terminada fuera del tiempo activo previsto" : "Terminada con evidencia requerida" : r?.status ?? "Sin iniciar", destination: "asistencia" }];
  });
  tasks.filter(t => t.date === day && t.employeeId === employeeId).forEach(t => {
    const evidence = !t.requiresPhoto || Boolean(t.beforeEvidenceCapture && t.afterEvidenceCapture);
    const completed = t.status === "Completada" || Boolean(t.completedAt);
    const late = completed && Boolean(t.slaMinutes && t.startedAt && t.completedAt && activeMinutes(t) > t.slaMinutes);
    items.push({ key: `Tarea-${t.id}`, title: t.title, start: t.start, end: t.end, instructions: t.notes, state: completed ? !evidence ? "issue" : late ? "late" : "done" : t.status === "Incidencia" ? "issue" : "pending", reason: completed && !evidence ? "Faltan fotos antes/después" : late ? "Terminada fuera del tiempo activo previsto" : t.status, destination: "tareas", optional: t.affectsEvaluation === false });
  });
  return items.sort((a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key));
}
export function summarizeDay(day: string, today: string, now: string, items: DayItem[], hasPlan: boolean): DayResult {
  const required = items.filter(i => !i.optional);
  const done = required.filter(i => i.state === "done" || i.state === "late").length;
  const base = { done, total: required.length };
  if (day > today) return { ...base, color: "gray", label: "Programado", explanation: "El día todavía no ocurre." };
  if (!hasPlan || !required.length) return { ...base, color: "gray", label: items.length ? "Historial parcial" : "Sin datos", explanation: "No hay un plan diario guardado completo. No se asigna una calificación al día." };
  const overdue = required.filter(i => i.state === "pending" && (day < today || i.end < now));
  if (required.some(i => i.state === "issue") || overdue.length) return { ...base, color: "red", label: "Requiere atención", explanation: `${overdue.length} pendiente(s) fuera de horario; ${required.filter(i => i.state === "issue").length} incidencia(s) o evidencia(s) faltante(s).` };
  if (required.some(i => i.state !== "done")) return { ...base, color: "yellow", label: day === today ? "En seguimiento" : "Con observaciones", explanation: "Hay actividades aún en horario, terminadas con retraso o pendientes de validación." };
  return { ...base, color: "green", label: "Plan cumplido", explanation: "Todas las obligaciones registradas están terminadas y cumplen su evidencia o validación. Es cumplimiento operativo, no utilidad económica." };
}
export const FIRST_FIFTEEN = [
  "Confirmar fuentes: ERP, caja, bancos y responsables de captura.",
  "Definir ventas netas, costo, visitantes y criterios de cierre; revisar accesos.",
  "Registrar el cierre de cada sucursal y vincular el reporte del ERP.",
  "Revisar duplicados, evidencias y datos faltantes del cierre.",
  "Conciliar ventas, cobros y diferencias de caja.",
  "Revisar saldos bancarios y obligaciones con fecha de vencimiento.",
  "Validar la primera línea base y documentar qué datos aún faltan.",
  "Incorporar costo de ventas y revisar margen por sucursal.",
  "Registrar demanda no atendida y motivos de no compra.",
  "Elegir uno o dos problemas medibles y asignar una acción.",
  "Ejecutar la acción con responsable, presupuesto y evidencia.",
  "Medir avances y registrar obstáculos sin cambiar la línea base.",
  "Revisar resultados comparables y calidad de la información.",
  "Preparar el reporte: línea base, resultado, diferencia y costo.",
  "Decidir: continuar, ajustar o detener. Registrar resultado positivo, negativo, neutro o no evaluable.",
];
export const PROJECT_PHASES = ["Datos confiables y primeras decisiones", "Corregir causas de pérdidas y faltantes", "Repetir acciones que producen resultados", "Consolidar rutinas y proyecciones", "Comprobar estabilidad sostenida"];
export function projectDay(start: string, day: string) { return Math.floor((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000) + 1; }
