import { createClient, type Session } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isCloudReady = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = isCloudReady
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function employeeEmail(employeeNumber: string) {
  const normalized = employeeNumber.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return `${normalized}@usuarios.xoxo-ferreton.local`;
}

export async function signIn(employeeNumber: string, password: string) {
  if (!supabase) throw new Error("La conexion segura no esta configurada.");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: employeeEmail(employeeNumber),
    password,
  });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function sessionEmployeeNumber(session: Session | null) {
  return String(session?.user.user_metadata?.employee_number ?? "");
}

export async function cloudLoad<T>(key: string, fallback: T): Promise<T> {
  if (!supabase) return fallback;
  const { data, error } = await supabase.from("app_state").select("value").eq("key", key).maybeSingle();
  if (error || !data) return fallback;
  return data.value as T;
}

export async function cloudSave(key: string, value: unknown) {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("La sesion expiro. Vuelve a iniciar sesion.");
  const { error } = await supabase.from("app_state").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: data.user.id,
  });
  if (error) throw error;
}
