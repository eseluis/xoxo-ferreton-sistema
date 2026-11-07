import type { ActivitySchedule, CleaningRole, Employee } from "./data";

export type AgendaSlot = {
  key: string; title: string; start: string; end: string; instructions: string;
  kind: "Actividad" | "Aseo" | "Centro"; itemId: string; evidence: string; slaMinutes: number;
  aliases?: string[];
};
const weekdays = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
export const isCleaningSchedule = (item: Pick<ActivitySchedule, "area">) => item.area.toLowerCase().includes("aseo");
export function cleaningRowsFor(employee: Employee, rows: CleaningRole[], branch: string, day: string) {
  const dayIndex=new Date(`${day}T12:00:00Z`).getUTCDay();
  if(employee.workdays&&!employee.workdays.includes(dayIndex))return [];
  const weekday = weekdays[dayIndex];
  return rows.filter(row => row.branch === branch && (row.assignments[weekday] ?? "").split("/").some(name => name.trim().toLowerCase() === employee.name.toLowerCase()));
}
export function routineFor(employee: Employee, schedules: ActivitySchedule[], branch: string, day?: string) {
  const weekday = day ? new Date(`${day}T12:00:00Z`).getUTCDay() : undefined;
  if(weekday!==undefined&&employee.workdays&&!employee.workdays.includes(weekday))return [];
  const eligible = schedules.filter(item => !item.excludeEmployeeIds?.includes(employee.id) && (!item.branch || item.branch === branch) &&
    (!item.weekdays || (weekday !== undefined && item.weekdays.includes(weekday))) && (!item.activeFrom||!!day&&day>=item.activeFrom) && (!item.activeUntil||!!day&&day<=item.activeUntil));
  const shared = eligible.filter(item => item.sharedRoutine && (item.employeeIds?.length ? item.employeeIds.includes(employee.id) : item.ownerRoles.includes(employee.role)));
  if (branch === "Sucursal Centro") return resolveRoutine(shared);
  const base = eligible.filter(item => !item.sharedRoutine);
  const targeted = base.filter(item => item.employeeIds?.includes(employee.id));
  const result=[...(targeted.length ? targeted : base.filter(item => !item.employeeIds?.length && item.ownerRoles.includes(employee.role))), ...shared];
  const project=shared.find(item=>item.id==="matriz-invewin-configuracion");
  return resolveRoutine(project?result.map(item=>item.id==="matriz-operacion-programada"?{...item,start:project.end,durationMinutes:(Number(item.end.slice(0,2))*60+Number(item.end.slice(3)))-(Number(project.end.slice(0,2))*60+Number(project.end.slice(3)))}:item):result);
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
  const routine = routineFor(employee, schedules, branch, day);
  const cleaning = branch === "Sucursal Centro" ? [] : cleaningRowsFor(employee, rows, branch, day);
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
    start: item.start, end: item.end, instructions: [item.objective ? `Objetivo: ${item.objective}` : "", item.instructions ?? ""].filter(Boolean).join("\n\n"), evidence: isCleaningSchedule(item) ? "photo" : item.evidence,
    slaMinutes: item.durationMinutes,
  }))].sort((a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key));
}
export function findSlotRun<T extends { itemType: string; itemId: string; completedAt?: string; startedAt?: string }>(slot: AgendaSlot, runs: T[]): T | undefined {
  const keys = [slot.key, ...(slot.aliases ?? [])];
  return runs.filter(run => keys.includes(`${run.itemType}-${run.itemId}`))
    .sort((a, b) => Number(Boolean(b.completedAt)) - Number(Boolean(a.completedAt)) || Number(Boolean(b.startedAt)) - Number(Boolean(a.startedAt)) || keys.indexOf(`${a.itemType}-${a.itemId}`) - keys.indexOf(`${b.itemType}-${b.itemId}`))[0];
}

export function resolveRoutine(rows:ActivitySchedule[]):ActivitySchedule[]{
 const minutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3));const time=(m:number)=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
 const rank=(r:ActivitySchedule)=>r.agendaPriority??(r.id==='matriz-invewin-configuracion'?90:r.sharedRoutine?30:0);
 return rows.flatMap(row=>{if(isCleaningSchedule(row))return [row];let parts=[[minutes(row.start),minutes(row.end)]];
 for(const block of rows.filter(b=>b.id!==row.id&&!isCleaningSchedule(b)&&rank(b)>rank(row))){const a=minutes(block.start),z=minutes(block.end);parts=parts.flatMap(([s,e])=>z<=s||a>=e?[[s,e]]:[[s,Math.min(e,a)],[Math.max(s,z),e]].filter(([x,y])=>y>x));}
 return parts.map(([s,e])=>({...row,id:s===minutes(row.start)&&e===minutes(row.end)?row.id:`${row.id}~${time(s).replace(':','')}-${time(e).replace(':','')}`,start:time(s),end:time(e),durationMinutes:e-s}));
 }).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
}
