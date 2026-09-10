export type WorkItem = {
  id: string;
  kind: "Tarea" | "Actividad" | "Aseo";
  title: string;
  start: string;
  end: string;
  instructions?: string;
  startedAt?: string;
  completedAt?: string;
  status: string;
  blocked?: boolean;
};

export function workTimeAt(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

export function selectWorkFocus(items: WorkItem[], time: string, shift?: { start: string; end: string }) {
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const now = minutes(time);
  const pending = items.filter(item => !item.completedAt && !item.status.startsWith("Completada"));
  const available = pending.filter(item => !item.blocked && !["Pausada", "Incidencia"].includes(item.status));
  const ordered = [...available].sort((a, b) => minutes(a.start) - minutes(b.start) || a.id.localeCompare(b.id));
  const running = ordered.find(item => item.startedAt || ["En proceso", "En curso"].includes(item.status));
  const scheduled = ordered.find(item => minutes(item.start) <= now && minutes(item.end) > now);
  const overdue = ordered.filter(item => minutes(item.end) <= now);
  const inShift = shift ? (minutes(shift.end) > minutes(shift.start)
    ? now >= minutes(shift.start) && now < minutes(shift.end)
    : now >= minutes(shift.start) || now < minutes(shift.end)) : true;
  const current = running ?? (inShift ? scheduled ?? overdue[0] : undefined);
  const next = ordered.find(item => item.id !== current?.id && minutes(item.start) > now);
  return { current, next, overdue, pending, inShift,
    label: running ? "En curso" : !inShift ? "Fuera de turno" : scheduled ? "Corresponde ahora" : current ? "Pendiente de terminar" : "Sin actividad en este horario" };
}
