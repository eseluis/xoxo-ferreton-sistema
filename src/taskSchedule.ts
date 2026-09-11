type ScheduledTask = { id?: string; employeeId: string; date: string; start: string; end: string; status?: string; completedAt?: string; removedAt?: string; title?: string };

export function taskScheduleError(candidate: ScheduledTask, tasks: ScheduledTask[]): string {
  if (candidate.status === "Completada" || candidate.completedAt || candidate.removedAt) return "";
  const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!candidate.date || !validTime.test(candidate.start) || !validTime.test(candidate.end) || candidate.end <= candidate.start) {
    return "Indica un horario válido: la hora final debe ser posterior a la inicial.";
  }
  // Default routines are deliberately excluded: only assigned tasks reserve this slot.
  const conflict = tasks.find(task => (!candidate.id || task.id !== candidate.id)
    && task.employeeId === candidate.employeeId && task.date === candidate.date
    && task.status !== "Completada" && !task.completedAt && !task.removedAt
    && candidate.start < task.end && candidate.end > task.start);
  return conflict ? `Ya tiene una tarea asignada: ${conflict.title || "Tarea"} (${conflict.start}–${conflict.end}). Solo se permite una tarea adicional en el mismo horario.` : "";
}
