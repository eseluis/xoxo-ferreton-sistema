import { supabase } from "./cloudStore";
import type { CentroPerson, CentroRecord } from "./centroOperation";

export type CentroContext = { roster: CentroPerson[]; records: CentroRecord[]; previous: CentroRecord[] };
function message(error: { message: string; code?: string }) {
  if (error.code === "PGRST202" || error.message.includes("centro_context")) return "Falta activar la base de datos de Operación Centro: aplicar supabase-centro-operation.sql. No se ha confirmado ningún guardado.";
  return error.message;
}
export async function fetchCentroContext(day: string): Promise<CentroContext> {
  if (!supabase) throw new Error("Sin conexión con el servidor.");
  const { data, error } = await supabase.rpc("centro_context", { target_day: day });
  if (error) throw new Error(message(error));
  return data as CentroContext;
}
export type CentroAction = "start" | "save" | "pause" | "resume" | "submit" | "approve" | "reject";
export async function saveCentroRecord(day: string, taskId: string, version: number, action: CentroAction, values: CentroRecord["data"], note = ""): Promise<CentroRecord> {
  if (!supabase) throw new Error("Sin conexión con el servidor.");
  const { data, error } = await supabase.rpc("centro_update_task", { target_day: day, target_task: taskId, expected_version: version, task_action: action, task_data: values, action_note: note });
  if (error) throw new Error(message(error));
  return data as CentroRecord;
}
export async function assignCentroDay(employeeId: string, day: string, location: string, start: string, end: string) {
  if (!supabase) throw new Error("Sin conexión con el servidor.");
  const { error } = await supabase.rpc("centro_assign_day", { employee_id: employeeId, target_day: day, target_location: location, shift_start: start, shift_end: end });
  if (error) throw new Error(message(error));
}
