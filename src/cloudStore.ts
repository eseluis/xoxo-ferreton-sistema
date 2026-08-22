import { createClient, type Session } from "@supabase/supabase-js";

// Estos valores son identificadores publicos del cliente web. La seguridad no
// depende de ocultarlos, sino de Auth y de las politicas RLS de Supabase.
const publicSupabaseUrl = "https://cuqgddgmpraichiqmjqh.supabase.co";
const publicSupabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cWdkZGdtcHJhaWNoaXFtanFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODQ0MDgsImV4cCI6MjA5NjI2MDQwOH0.Llqg-rk0ozalJSoJ3xeqPv2ipqRr8677mo_lIvqN4-I";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || publicSupabaseUrl;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || publicSupabaseAnonKey;

export const isCloudReady = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = isCloudReady
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
        storageKey: "xoxo-session",
      },
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

const moduleTables: Record<string, string> = {
  "xoxo.attendance": "attendance_records",
  "xoxo.evaluations": "evaluation_records",
  "xoxo.cash": "cash_incident_records",
  "xoxo.cashSessions": "cash_session_records",
  "xoxo.cashCuts": "cash_cut_records",
  "xoxo.suppliers": "supplier_records",
  "xoxo.payables": "payable_records",
  "xoxo.bankAccounts": "bank_account_records",
  "xoxo.bankTransactions": "bank_transaction_records",
  "xoxo.monthlyBudgets": "monthly_budget_records",
  "xoxo.kpiRecords": "kpi_records",
  "xoxo.processAudits": "process_audit_records",
  "xoxo.branchOpenings": "branch_opening_records",
  "xoxo.warranties": "warranty_records",
  "xoxo.dailyTasks": "daily_task_records",
  "xoxo.processInstances": "process_instance_records",
  "xoxo.internalRequests": "internal_request_records",
  "xoxo.activityRuns": "activity_run_records",
};

export async function cloudLoad<T>(key: string, fallback: T): Promise<T> {
  if (!supabase) return fallback;
  const moduleTable = moduleTables[key];
  if (moduleTable) {
    const { data, error } = await supabase.from(moduleTable).select("payload").order("record_date", { ascending: true });
    if (error) return fallback;
    return data.map((row) => row.payload) as T;
  }
  const { data, error } = await supabase.from("app_state").select("value").eq("key", key).maybeSingle();
  if (error || !data) return fallback;
  return data.value as T;
}

export async function cloudSave(key: string, value: unknown) {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("La sesion expiro. Vuelve a iniciar sesion.");
  const moduleTable = moduleTables[key];
  if (moduleTable) {
    const { error } = await supabase.rpc("replace_module_records", {
      module_name: key.replace("xoxo.", ""),
      records: value,
    });
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("app_state").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: data.user.id,
  });
  if (error) throw error;
}
