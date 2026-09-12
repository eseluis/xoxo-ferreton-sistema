import { createClient, type Session } from "@supabase/supabase-js";

// Estos valores son identificadores publicos del cliente web. La seguridad no
// depende de ocultarlos, sino de Auth y de las politicas RLS de Supabase.
const publicSupabaseUrl = "https://cuqgddgmpraichiqmjqh.supabase.co";
const publicSupabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cWdkZGdtcHJhaWNoaXFtanFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODQ0MDgsImV4cCI6MjA5NjI2MDQwOH0.Llqg-rk0ozalJSoJ3xeqPv2ipqRr8677mo_lIvqN4-I";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || publicSupabaseUrl;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || publicSupabaseAnonKey;

export const isCloudReady = Boolean(supabaseUrl && supabaseAnonKey);
const pendingStorageKey = (key: string) => `xoxo.pending.${key}`;
const pendingPrefix = "xoxo.pending.";

type PendingRecord<T> = {
  revision: string;
  value: T;
  changes?: unknown[];
};

const mutationQueues = new Map<string, Promise<void>>();
// Keep the last observed rows so editing one item never re-sends unrelated,
// potentially stale assignments from another collaborator's session.
const observedRows = new Map<string, Map<string, string>>();
const assignmentModule = (key: string) => key === "xoxo.dailyTasks" || key === "xoxo.internalRequests";
const incrementalModule = (key: string) => assignmentModule(key) || key === "xoxo.activityRuns" || key === "xoxo.processInstances";
const localVersions = new Map<string, number>();
function changedRows(key: string, value: unknown): unknown[] | undefined {
  if (!incrementalModule(key) || !Array.isArray(value)) return undefined;
  return value.filter((row) => observedRows.get(key)?.get(String(row.id)) !== JSON.stringify(row));
}
function rememberRows(key: string, rows: unknown[]) {
  if (!incrementalModule(key)) return;
  observedRows.set(key, new Map(rows.map((row) => [String((row as { id: string }).id), JSON.stringify(row)])));
}
function visiblePayloads(key: string, data: { payload: any }[]) {
  return data.map(row => row.payload).filter(row => key !== "xoxo.dailyTasks" || !row.removedAt);
}

export async function archiveCloudTask(id: string, note: string) {
  if (!supabase) throw new Error("No hay conexión con Supabase.");
  const key = "xoxo.dailyTasks";
  const pending = pendingRecord(key);
  if (pending) {
    await cloudSave(key, pending.value, pending.changes);
    clearCloudPending(key, pending.revision);
  }
  await mutationQueues.get(key);
  localVersions.set(key, (localVersions.get(key) ?? 0) + 1);
  const { error } = await supabase.rpc("archive_daily_task", { task_id: id, removal_note: note });
  if (error) throw new Error(error.message);
  observedRows.get(key)?.delete(id);
  changeTokens.clear();
}

function isPendingRecord<T>(value: unknown): value is PendingRecord<T> {
  return Boolean(value && typeof value === "object" && "revision" in value && "value" in value);
}

function pendingRecord<T>(key: string): PendingRecord<T> | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem(pendingStorageKey(key));
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isPendingRecord<T>(parsed)) return parsed;
    // Compatibilidad con pendientes guardados por versiones anteriores.
    return { revision: "legacy", value: parsed as T };
  } catch {
    window.localStorage.removeItem(pendingStorageKey(key));
    return undefined;
  }
}

export function markCloudPending(key: string, value: unknown): string {
  const revision = crypto.randomUUID();
  const delta = changedRows(key, value);
  const previous = pendingRecord(key);
  const changes = delta === undefined ? undefined : Array.from(new Map(
    [...(previous?.changes ?? []), ...delta].map((row) => [String((row as { id: string }).id), row]),
  ).values());
  if (typeof window !== "undefined") {
    window.localStorage.setItem(pendingStorageKey(key), JSON.stringify({ revision, value, changes }));
  }
  return revision;
}

export function clearCloudPending(key: string, revision?: string) {
  if (typeof window === "undefined") return;
  if (revision === undefined) return;
  const pending = pendingRecord(key);
  if (!pending || pending.revision === revision) {
    window.localStorage.removeItem(pendingStorageKey(key));
  }
}
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
  const normalized = employeeNumber.trim().replace(/[^0-9]/g, "");
  return `${normalized}@usuarios.xoxo-ferreton.local`;
}

export async function signIn(employeeNumber: string, password: string) {
  if (!supabase) throw new Error("La conexion segura no esta configurada.");
  const normalized = employeeNumber.trim().replace(/[^0-9]/g, "");
  if (!normalized) throw new Error("Número de colaborador inválido.");
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const loginRequest = supabase.auth.signInWithPassword({ email: employeeEmail(normalized), password });
      const timeout = new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error("Servidor de acceso temporalmente no disponible.")), 15000),
      );
      const { data, error } = await Promise.race([loginRequest, timeout]);
      if (error) {
        const retryable = error.status === 500 || error.status === 502 || error.status === 503 || error.message.toLowerCase().includes("fetch");
        if (!retryable) throw error;
        lastError = error;
      } else {
        return data.session;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("fetch") && !message.includes("servidor") && !message.includes("network")) throw error;
      lastError = error;
    }
    if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 1000 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error("Servidor de acceso temporalmente no disponible.");
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  observedRows.clear();
  changeTokens.clear();
}

export async function manageEmployeeAccess(employee: { id: string; name: string; role: string; branch: string }, password: string) {
  if (!supabase) throw new Error("La conexión segura no está configurada.");
  const { data, error } = await supabase.functions.invoke("manage-employee-access", { body: { employeeNumber: employee.id, name: employee.name, role: employee.role, branch: employee.branch, password } });
  if (error) throw new Error(data?.error || error.message);
  if (data?.error) throw new Error(data.error);
  return data as { success: boolean; created: boolean };
}

export async function changeOwnPassword(password: string) {
  if (!supabase) throw new Error("La conexión segura no está configurada.");
  const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
  if (error) throw error;
}

export function sessionEmployeeNumber(session: Session | null) {
  const metadataNumber = String(session?.user.user_metadata?.employee_number ?? "").replace(/[^0-9]/g, "");
  if (metadataNumber) return metadataNumber;
  const email = session?.user.email ?? "";
  const legacyMatch = email.match(/^(\d+)@usuarios\.xoxo-ferreton\.local$/i);
  return legacyMatch?.[1] ?? "";
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
  "xoxo.cleaningEvaluations": "cleaning_evaluation_records",
};

export async function cloudLoad<T>(key: string, fallback: T): Promise<T> {
  if (!supabase) return fallback;
  const pending = pendingRecord<T>(key);
  if (pending) {
    try { await cloudSave(key, pending.value, pending.changes); clearCloudPending(key, pending.revision); } catch { return pending.value; }
    if (pendingRecord(key)) return pendingRecord<T>(key)!.value;
  }
  const moduleTable = moduleTables[key];
  if (moduleTable) {
    const version = localVersions.get(key);
    const { data, error } = await supabase.from(moduleTable).select("payload").order("record_date", { ascending: true });
    if (error) return fallback;
    if (version !== localVersions.get(key)) return pendingRecord<T>(key)?.value ?? fallback;
    const rows = visiblePayloads(key, data);
    rememberRows(key, rows);
    return rows as T;
  }
  const { data, error } = await supabase.from("app_state").select("value").eq("key", key).maybeSingle();
  if (error || !data) return fallback;
  return data.value as T;
}

// Recarga segura para pantallas que deben compartir cambios en vivo. A diferencia
// de cloudLoad, no sustituye el estado actual cuando hay una falla de red.
export async function cloudRefresh<T>(key: string): Promise<T | undefined> {
  if (!supabase) return undefined;
  const pending = pendingRecord<T>(key);
  if (pending) {
    try { await cloudSave(key, pending.value, pending.changes); clearCloudPending(key, pending.revision); } catch { return pending.value; }
    if (pendingRecord(key)) return pendingRecord<T>(key)!.value;
  }
  const moduleTable = moduleTables[key];
  if (moduleTable) {
    const version = localVersions.get(key);
    const { data, error } = await supabase.from(moduleTable).select("payload").order("record_date", { ascending: true });
    if (error) return undefined;
    if (version !== localVersions.get(key)) return undefined;
    const rows = visiblePayloads(key, data);
    rememberRows(key, rows);
    return rows as T;
  }
  const { data, error } = await supabase.from("app_state").select("value").eq("key", key).maybeSingle();
  if (error || !data) return undefined;
  return data.value as T;
}

const changeTokens = new Map<string, string>();
export function invalidateCloudRefreshTokens() { changeTokens.clear(); }
export async function cloudRefreshChanged<T>(key: string): Promise<T | undefined> {
  if (!supabase || !moduleTables[key]) return undefined;
  // Poll metadata, not the photographs embedded in every payload.
  const { data, error } = await supabase.from(moduleTables[key]).select("updated_at")
    .order("updated_at", { ascending: false }).limit(1);
  if (error) return undefined;
  const token = data[0]?.updated_at ?? "empty";
  if (changeTokens.get(key) === token && !pendingRecord(key)) return undefined;
  const latest = await cloudRefresh<T>(key);
  if (latest !== undefined && !pendingRecord(key)) changeTokens.set(key, token);
  return latest;
}

async function performCloudSave(key: string, value: unknown, changes?: unknown[]) {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("La sesion expiro. Vuelve a iniciar sesion.");
  const moduleTable = moduleTables[key];
  if (moduleTable) {
    const rows = changes ?? value;
    if (Array.isArray(rows) && rows.length === 0) return;
    const rpcName = assignmentModule(key) ? "sync_assignment_records" : "sync_module_records";
    let { error } = await supabase.rpc(rpcName, {
      module_name: key.replace("xoxo.", ""),
      records: rows,
    });
    // Compatibilidad durante la publicación de la migración de sincronización.
    if (error?.code === "PGRST202" || error?.message?.includes(rpcName)) {
      if (assignmentModule(key)) throw new Error("Falta aplicar supabase-fix-assignments.sql en Supabase. La asignación sigue pendiente de guardar.");
      if (incrementalModule(key)) throw new Error("Falta aplicar supabase-fix-shared-sync.sql en Supabase. Los cambios siguen pendientes de guardar.");
      ({ error } = await supabase.rpc("replace_module_records", {
        module_name: key.replace("xoxo.", ""), records: value,
      }));
    }
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

// Serializa los guardados de cada módulo. Así una respuesta lenta no puede
// confirmar una versión anterior después de una modificación más reciente.
export function cloudSave(key: string, value: unknown, pendingChanges?: unknown[]): Promise<void> {
  // Freeze the changed records before network waits or another refresh.
  const changes = pendingChanges ?? pendingRecord(key)?.changes ?? changedRows(key, value);
  localVersions.set(key, (localVersions.get(key) ?? 0) + 1);
  if (incrementalModule(key) && Array.isArray(value)) rememberRows(key, value);
  const previous = mutationQueues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(() => performCloudSave(key, value, changes));
  mutationQueues.set(key, current);
  void current.finally(() => {
    if (mutationQueues.get(key) === current) mutationQueues.delete(key);
  }).catch(() => undefined);
  return current;
}

export async function flushPendingCloudSaves(): Promise<void> {
  if (!supabase || typeof window === "undefined") return;
  const keys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
    .filter((key): key is string => Boolean(key?.startsWith(pendingPrefix)))
    .map((key) => key.slice(pendingPrefix.length));
  await Promise.all(keys.map(async (key) => {
    const pending = pendingRecord<unknown>(key);
    if (!pending) return;
    try {
      await cloudSave(key, pending.value, pending.changes);
      clearCloudPending(key, pending.revision);
    } catch {
      // Se conserva para el siguiente intento automático.
    }
  }));
}
