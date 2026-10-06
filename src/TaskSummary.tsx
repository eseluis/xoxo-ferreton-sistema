import type { DailyTask } from "./data";
import { taskCounts } from "./taskOverview";

export function TaskSummary({ tasks, now, onFilter }: { tasks: DailyTask[]; now: Date; onFilter: (filter: string) => void }) {
  const counts = taskCounts(tasks, now);
  const cards = [
    ["Todas", "Total", counts.total], ["Sin terminar", "Sin terminar", counts.incomplete], ["Vencidas", "Vencidas", counts.overdue],
    ["Pendiente", "Pendientes", counts.pending], ["En proceso", "En proceso", counts.running], ["Completada", "Completadas", counts.complete],
    ["Pausada", "Pausadas", counts.paused], ["Incidencia", "Con incidencia", counts.incidents],
  ] as const;
  return <><div className="taskSummaryCards">{cards.map(([filter, label, count]) => <button className={`ghost ${filter === "Vencidas" && count ? "danger" : ""}`} key={filter} onClick={() => onFilter(filter)}><strong>{count}</strong><span>{label}</span></button>)}</div>
    <p className="muted">{counts.missingEvidence} tareas con evidencia obligatoria incompleta. Vencida: sin terminar después de su horario de entrega o con tiempo SLA excedido. Las vencidas también se cuentan en su estado actual.</p></>;
}
