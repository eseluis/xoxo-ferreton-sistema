import { supabase } from "./cloudStore";
import type { DayPlan } from "./dayCalendar";
import type { CentroRecord } from "./centroOperation";
const connection = () => { if (!supabase) throw new Error("No hay conexión con el servidor."); return supabase; };
function fail(error: { message: string; code?: string }) {
  throw new Error(["42P01", "PGRST205", "PGRST202"].includes(error.code ?? "") ? "Falta activar la actualización de calendario en la base de datos. No se ha confirmado el historial." : error.message);
}
export async function saveDayPlan(plan: DayPlan) {
  const { error } = await connection().from("operation_day_plans").upsert(plan, { onConflict: "employee_number,day", ignoreDuplicates: true });
  if (error) fail(error);
}
export async function readCalendar(from: string, to: string, employeeId: string) {
  const client = connection();
  const [plans, records, config] = await Promise.all([
    client.from("operation_day_plans").select("*").eq("employee_number", employeeId).gte("day", from).lte("day", to),
    client.rpc("operation_calendar_centro", { from_day: from, to_day: to, target_employee: employeeId }),
    client.from("operation_project_config").select("start_day").eq("id", "stabilization").single(),
  ]);
  if (plans.error) fail(plans.error); if (records.error) fail(records.error); if (config.error) fail(config.error);
  return { plans: plans.data as DayPlan[], centro: records.data as CentroRecord[], start: config.data!.start_day as string };
}
export async function saveProjectStart(start: string) {
  const { error } = await connection().from("operation_project_config").update({ start_day: start }).eq("id", "stabilization");
  if (error) fail(error);
}
