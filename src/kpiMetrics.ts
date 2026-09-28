export function kpiCompliance(item: { target: number; actual: number; direction: string }) {
  if (!Number.isFinite(item.target) || !Number.isFinite(item.actual)) return null;
  if (item.target === 0) return (item.direction === "Menor es mejor" ? item.actual <= 0 : item.actual >= 0) ? 100 : 0;
  // A signed financial result cannot be interpreted as a ratio against a negative target.
  if (item.target < 0 || item.actual < 0) return (item.direction === "Menor es mejor" ? item.actual <= item.target : item.actual >= item.target) ? 100 : 0;
  return Math.max(0, Math.min(200, item.direction === "Mayor es mejor" ? item.actual / item.target * 100 : item.actual === 0 ? 100 : item.target / item.actual * 100));
}
export function kpiPeriod(start: string, frequency: string) {
  const date = new Date(`${start}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== start) throw new Error("Fecha de medición no válida.");
  if (frequency === "Mensual") {
    const first = start.slice(0, 7) + "-01";
    return { start: first, end: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10) };
  }
  if (frequency === "Semanal") date.setUTCDate(date.getUTCDate() + 6);
  return { start, end: date.toISOString().slice(0, 10) };
}
