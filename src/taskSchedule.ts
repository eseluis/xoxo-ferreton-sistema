type ScheduledTask = { systemKind?: string; id?: string; employeeId: string; date: string; start: string; end: string; status?: string; completedAt?: string; removedAt?: string; title?: string };

export function taskScheduleError(candidate: ScheduledTask, tasks: ScheduledTask[]): string {
  if (candidate.status === "Completada" || candidate.completedAt || candidate.removedAt) return "";
  const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!candidate.date || !validTime.test(candidate.start) || !validTime.test(candidate.end) || candidate.end <= candidate.start) {
    return "Indica un horario válido: la hora final debe ser posterior a la inicial.";
  }
  return "";
}
