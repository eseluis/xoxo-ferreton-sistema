// Puntos del marcador de aseo. Se mantiene como modulo puro (sin React ni Supabase)
// para poder probarlo igual que taskSchedule.ts, con datos de entrada minimos.

export type AseoRunLike = {
  employeeId: string;
  date: string;
  itemType: string;
  startedAt?: string;
  completedAt?: string;
  slaMinutes: number;
};

export type CleaningEvaluationLike = {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  qualityScore: number;
};

// Puntos automaticos de un bloque de aseo ya evidenciado (foto antes/despues obligatoria
// para poder marcarlo completado, ver completeActivityRun en App.tsx):
// a tiempo = 2, completado con retraso = 1, sin completar = 0.
export function aseoAutoPoints(run: AseoRunLike): number {
  if (run.itemType !== "Aseo" || !run.completedAt) return 0;
  const startedAt = run.startedAt ? new Date(run.startedAt).getTime() : new Date(run.completedAt).getTime();
  const elapsedMinutes = (new Date(run.completedAt).getTime() - startedAt) / 60000;
  return elapsedMinutes > run.slaMinutes ? 1 : 2;
}

function inRange(dateKey: string, from: string, to: string) {
  return dateKey >= from && dateKey <= to;
}

export function autoPointsInRange(runs: AseoRunLike[], employeeId: string, from: string, to: string): number {
  return runs
    .filter((run) => run.employeeId === employeeId && run.itemType === "Aseo" && inRange(run.date, from, to))
    .reduce((sum, run) => sum + aseoAutoPoints(run), 0);
}

export function aseoRunCountsInRange(runs: AseoRunLike[], employeeId: string, from: string, to: string) {
  const scoped = runs.filter((run) => run.employeeId === employeeId && run.itemType === "Aseo" && inRange(run.date, from, to));
  const onTime = scoped.filter((run) => aseoAutoPoints(run) === 2).length;
  const late = scoped.filter((run) => aseoAutoPoints(run) === 1).length;
  const incomplete = scoped.filter((run) => !run.completedAt).length;
  return { onTime, late, incomplete, total: scoped.length };
}

export function qualityPointsInRange(evaluations: CleaningEvaluationLike[], employeeId: string, from: string, to: string): number {
  return evaluations
    .filter((entry) => entry.employeeId === employeeId && inRange(entry.periodStart, from, to))
    .reduce((sum, entry) => sum + entry.qualityScore, 0);
}

// Suma dias (positivos o negativos) a una llave YYYY-MM-DD sin depender de la zona horaria
// del navegador que ejecuta el codigo.
export function shiftDateKey(dateKey: string, days: number): string {
  const base = new Date(`${dateKey}T12:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}
