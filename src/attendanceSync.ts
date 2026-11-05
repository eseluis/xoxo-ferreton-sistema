import { supabase } from "./cloudStore";
export type AttendanceRow = {employeeId:string;date:string;in?:string;out?:string;branch?:string};

// This read deliberately bypasses the local/offline queue: only the server can
// confirm a punch. Read today's small payloads independently of photo modules.
export async function readAttendanceDay<T extends AttendanceRow>(day:string):Promise<T[]> {
 if(!supabase)throw new Error("No hay conexión con el servidor de asistencia.");
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const {data,error}=await supabase.from("attendance_records").select("payload,branch").eq("record_date",day).abortSignal(controller.signal);
  if(error)throw new Error(error.message);
  return (data??[]).map(r=>({...r.payload,branch:r.branch})).filter(r=>r.date===day&&r.employeeId) as T[];
 }finally{clearTimeout(timer);}
}

// Ignore a read that started before a punch, and queue one fresh read if needed.
export function attendanceReader<T>(read:()=>Promise<T>,apply:(rows:T)=>void,onError:(error:unknown)=>void) {
 let generation=0,reading=false,queued=false,stopped=false;
 const refresh=async()=>{
  if(stopped)return;if(reading){queued=true;return;}reading=true;const version=generation;
  try{const rows=await read();if(!stopped&&version===generation)apply(rows);}
  catch(error){if(!stopped&&version===generation)onError(error);}
  finally{reading=false;if(queued&&!stopped){queued=false;void refresh();}}
 };
 return {refresh,invalidate:()=>{generation++;},stop:()=>{stopped=true;generation++;}};
}

export function isConfirmedPunch<T extends AttendanceRow>(row:T|undefined,person:string,day:string,phase:"in"|"out"):row is T {
 return !!row&&row.employeeId===person&&row.date===day&&typeof row[phase]==="string"&&!!row[phase]?.trim();
}
export async function confirmAttendancePunch<T extends AttendanceRow>(person:string,day:string,phase:"in"|"out",arrival:unknown):Promise<T> {
 if(!supabase)throw new Error("No hay conexión para registrar la checada.");
 let originalError:unknown;
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
 try {
  const {data,error}=await supabase.rpc("register_prepared_attendance",{phase,arrival}).abortSignal(controller.signal);
  if(error)throw new Error(error.message);
  if(!isConfirmedPunch(data,person,day,phase))throw new Error("El servidor no devolvió una checada confirmada.");
  return data as T;
 }catch(error){originalError=error;}finally{clearTimeout(timer);}
 // The response can be lost on mobile after the server commits. Verify before
 // reporting uncertainty; retrying on a PC must never create another timestamp.
 try{const rows=await readAttendanceDay<T>(day);const found=rows.find(r=>r.employeeId===person);if(isConfirmedPunch(found,person,day,phase))return found;}catch{/* Preserve the original failure, never invent local confirmation. */}
 throw new Error(originalError instanceof Error?originalError.message:"No se pudo confirmar la checada en el servidor.");
}
