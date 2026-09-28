import type { ActivitySchedule, CleaningRole, Employee } from "./data";

export type AgendaSlot = {
  key: string; title: string; start: string; end: string; instructions: string;
  kind: "Actividad" | "Aseo" | "Centro"; itemId: string; evidence: string; slaMinutes: number;
  aliases?: string[];
};
const weekdays = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
export const isCleaningSchedule = (item: Pick<ActivitySchedule, "area">) => item.area.toLowerCase().includes("aseo");
export function cleaningRowsFor(employee: Employee, rows: CleaningRole[], branch: string, day: string) {
  const weekday = weekdays[new Date(`${day}T12:00:00Z`).getUTCDay()];
  return rows.filter(row => row.branch === branch && (row.assignments[weekday] ?? "").split("/").some(name => name.trim().toLowerCase() === employee.name.toLowerCase()));
}
export function routineFor(employee: Employee, schedules: ActivitySchedule[], branch: string) {
  if (branch === "Sucursal Centro") return [];
  const targeted = schedules.filter(item => item.employeeIds?.includes(employee.id) && (!item.branch || item.branch === branch));
  return targeted.length ? targeted : schedules.filter(item => !item.employeeIds?.length && item.ownerRoles.includes(employee.role) && (!item.branch || item.branch === branch));
}
// Only explicit references to the daily cleaning role, or matching generic blocks,
// are aliases. Mixed display/merchandising activities remain separate obligations.
export function cleaningAliases(row: CleaningRole, routine: ActivitySchedule[], employeeId?: string) {
  return routine.filter(item => (item.id === "matriz-turno1-bloque2" && employeeId === "010") || item.area.toLowerCase() === "aseo" && (
    /aseo asignado|aseo de turno|rol de aseo/i.test(`${item.name} ${item.instructions ?? ""}`) ||
    (item.id.startsWith("aseo-bloque-") && item.start < row.end && item.end > row.start)
  ));
}
export function buildRoutine(employee: Employee, schedules: ActivitySchedule[], rows: CleaningRole[], branch: string, day: string): AgendaSlot[] {
  if (branch === "Sucursal Centro") return [];
  const routine = routineFor(employee, schedules, branch);
  const cleaning = cleaningRowsFor(employee, rows, branch, day);
  const consumed = new Set<string>();
  const slots: AgendaSlot[] = cleaning.map(row => {
    const aliases = cleaningAliases(row, routine, employee.id).filter(item => !consumed.has(item.id));
    aliases.forEach(item => consumed.add(item.id));
    const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    return { key: `Aseo-${row.activity}`, kind: "Aseo", itemId: row.activity, title: row.activity,
      start: row.start, end: row.end, instructions: row.details, evidence: "photo",
      slaMinutes: Math.max(5, minutes(row.end) - minutes(row.start)), aliases: aliases.map(item => `Actividad-${item.id}`) };
  });
  return [...slots, ...routine.filter(item => !consumed.has(item.id)).map(item => ({
    key: `Actividad-${item.id}`, kind: "Actividad" as const, itemId: item.id, title: item.name,
    start: item.start, end: item.end, instructions: item.instructions ?? "", evidence: isCleaningSchedule(item) ? "photo" : item.evidence,
    slaMinutes: item.durationMinutes,
  }))].sort((a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key));
}
export function findSlotRun<T extends { itemType: string; itemId: string; completedAt?: string; startedAt?: string }>(slot: AgendaSlot, runs: T[]): T | undefined {
  const keys = [slot.key, ...(slot.aliases ?? [])];
  return runs.filter(run => keys.includes(`${run.itemType}-${run.itemId}`))
    .sort((a, b) => Number(Boolean(b.completedAt)) - Number(Boolean(a.completedAt)) || Number(Boolean(b.startedAt)) - Number(Boolean(a.startedAt)) || keys.indexOf(`${a.itemType}-${a.itemId}`) - keys.indexOf(`${b.itemType}-${b.itemId}`))[0];
}
