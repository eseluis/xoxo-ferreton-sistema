import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  Camera,
  CheckCircle2,
  Clock,
  ClipboardList,
  FileCheck2,
  FileText,
  LogOut,
  MapPin,
  MessageSquare,
  Network,
  PenTool,
  Printer,
  BookOpen,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  canAssign,
  canGovern,
  canViewAll,
  commissionRate,
  currentSupervisor,
  defaultActivitySchedules,
  defaultCleaningRole,
  defaultEmployees,
  defaultShiftConfigs,
  DailyTask,
  Employee,
  evaluationCriteria,
  internalRules,
  processes,
  roleProfiles,
  Role,
  todayKey,
  weekDays,
} from "./data";
import {
  cloudLoad,
  cloudRefresh,
  cloudSave,
  changeOwnPassword,
  getSession,
  isCloudReady,
  manageEmployeeAccess,
  markCloudPending,
  clearCloudPending,
  sessionEmployeeNumber,
  signIn,
  signOut,
  supabase,
} from "./cloudStore";

type Attendance = {
  employeeId: string;
  date: string;
  in?: string;
  lunchOut?: string;
  lunchIn?: string;
  out?: string;
};

type Evaluation = {
  employeeId: string;
  evaluatorId: string;
  date: string;
  scores: number[];
  note: string;
  personalSales: number;
  salesGoal: number;
};

type CashIncident = {
  id: string;
  branch: string;
  type: string;
  amount: number;
  recipient?: string;
  purpose?: string;
  paymentMethod?: string;
  note: string;
  ownerId: string;
  date: string;
  folio: string;
  status: "Pendiente" | "Aprobado" | "Rechazado";
  approvedById?: string;
  approvedAt?: string;
  createdAt: string;
  payableId?: string;
  bankAccountId?: string;
};

type Supplier = {
  id: string; name: string; taxId: string; contact: string; phone: string;
  paymentTermsDays: number; branch: string; status: "Activo" | "Inactivo";
  createdById: string; createdAt: string;
};

type Payable = {
  id: string; supplierId: string; invoice: string; concept: string; branch: string;
  issueDate: string; dueDate: string; amount: number; paidAmount: number;
  status: "Pendiente" | "Pago pendiente" | "Parcial" | "Pagada" | "Vencida";
  ownerId: string; notes: string; createdAt: string;
  hasInvoice: boolean; deductible: boolean; creditDays: number;
};

type BankAccount = {
  id: string; bank: string; accountName: string; lastFour: string; openingBalance: number;
  branch: string; status: "Activa" | "Inactiva"; createdById: string; createdAt: string;
};

type BankTransaction = {
  id: string; date: string; type: "Deposito" | "Pago a proveedor" | "Gasto operativo" | "Transferencia";
  bankAccountId: string; destinationBankAccountId?: string; amount: number; supplierId?: string;
  payableId?: string; invoice: string; concept: string; hasInvoice: boolean; deductible: boolean;
  counterparty: string; reference: string; branch: string; ownerId: string; createdAt: string;
  category: string; reconciled: boolean; reconciledAt?: string; reconciledById?: string;
};

type MonthlyBudget = {
  id: string; date: string; month: string; category: string; amount: number;
  branch: string; ownerId: string; createdAt: string;
};

type KpiRecord = {
  id: string; date: string; month: string; name: string; area: string; role: Role | "TODOS";
  employeeId?: string; branch: string; target: number; actual: number; unit: string;
  direction: "Mayor es mejor" | "Menor es mejor"; frequency: "Diario" | "Semanal" | "Mensual";
  ownerId: string; notes: string; createdAt: string;
};

type ProcessAudit = {
  id: string; date: string; processId: string; processName: string; branch: string;
  auditorId: string; responsibleId: string; status: "Abierta" | "En corrección" | "Cerrada";
  notes: string; createdAt: string;
  checks: { title: string; result: "Pendiente" | "Cumple" | "No cumple" | "No aplica"; finding: string; correctiveAction: string; dueDate: string; closed: boolean }[];
};

type BranchOpening = {
  id: string; date: string; name: string; city: string; address: string; targetDate: string;
  managerId: string; ownerId: string; status: "Planeación" | "En ejecución" | "Lista para abrir" | "Abierta" | "Pausada";
  investmentBudget: number; actualInvestment: number; breakEvenMonthly: number; notes: string; createdAt: string;
  steps: { stage: string; title: string; responsibleId: string; dueDate: string; budget: number; actual: number; done: boolean; evidence: string }[];
};

type CashSession = {
  id: string;
  branch: string;
  date: string;
  openedById: string;
  openingFund: number;
  openedAt: string;
  status: "Abierta" | "Cerrada" | "Aprobada";
  cutId?: string;
  closedAt?: string;
  approvedById?: string;
  approvedAt?: string;
  notes: string;
};

type CashCut = {
  id: string;
  branch: string;
  date: string;
  cashierId: string;
  erpSales: number;
  cardTotal: number;
  transferTotal: number;
  withdrawals: number;
  providerPayments: number;
  operationalExpenses: number;
  cashCounted: number;
  expectedCash: number;
  difference: number;
  matches: boolean;
  incident: string;
  notes: string;
  openingFund: number;
  status: "Pendiente" | "Aprobado" | "Rechazado";
  reviewedById?: string;
  reviewedAt?: string;
};

type Warranty = {
  id: string;
  provider: string;
  product: string;
  reason: string;
  status: "Recibida" | "En inspección" | "Esperando proveedor" | "Solución autorizada" | "Resuelta" | "Rechazada";
  ownerId: string;
  date: string;
  branch: string; customer: string; phone: string; ticket: string; purchaseDate: string;
  defectType: string; eligible: "Pendiente" | "Sí" | "No"; supplierFolio: string;
  solution: "Pendiente" | "Reposición" | "Nota de crédito" | "Reparación" | "Cambio equivalente" | "Devolución" | "Rechazo";
  resolutionReference: string; resolutionAmount: number; replacementProduct: string; resolvedAt?: string;
  timeline: { at: string; byId: string; action: string; note: string }[];
};

type EvidenceCapture = {
  dataUrl: string;
  capturedAt: string;
  lat?: number;
  lng?: number;
  accuracyM?: number;
};

// Redimensiona y comprime la imagen antes de guardarla (se guarda como
// dataURL dentro del mismo JSON que ya sincroniza toda la app; no hay
// bucket de Storage dedicado todavia, asi que conviene mantenerla ligera).
function compressImage(sourceDataUrl: string, maxDim = 640, quality = 0.55): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Sin contexto de canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("No se pudo procesar la imagen"));
    img.src = sourceDataUrl;
  });
}

// Estampa de ubicacion "mejor esfuerzo": si el colaborador niega el permiso
// o el dispositivo no tiene GPS, la evidencia se guarda igual, solo sin
// coordenadas.
function captureGeolocation(): Promise<{ lat?: number; lng?: number; accuracyM?: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({});
      return;
    }
    const timer = setTimeout(() => resolve({}), 4000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy });
      },
      () => {
        clearTimeout(timer);
        resolve({});
      },
      { enableHighAccuracy: false, timeout: 3500, maximumAge: 60000 },
    );
  });
}

type ProcessInstance = {
  id: string;
  processId: string;
  title: string;
  startedById: string;
  ownerId: string;
  date: string;
  status: "Activo" | "Completado" | "Incidencia";
  notes: string;
  startedAt?: string;
  slaMinutes?: number;
  stepStates: {
    title: string;
    owner: string;
    evidence: string;
    done: boolean;
    note: string;
    completedAt?: string;
    evidenceCapture?: EvidenceCapture;
    beforeEvidenceCapture?: EvidenceCapture;
    afterEvidenceCapture?: EvidenceCapture;
  }[];
  fleteType?: "Fletera externa" | "Flete propio del proveedor";
  merchandisingTipo?: "Normal" | "Oferta" | "Producto ancla" | "Novedad";
  stockingAssigneeId?: string;
};

type InternalRequest = {
  id: string;
  type: "Solicitud" | "Queja" | "Peticion" | "Reporte";
  title: string;
  message: string;
  requestedById: string;
  recipientId: string;
  date: string;
  priority: "Baja" | "Media" | "Alta" | "Critica";
  status: "Abierta" | "En revision" | "Atendida" | "Cerrada";
  confidentiality: "Normal" | "Confidencial";
  response: string;
  respondedAt?: string;
  respondedById?: string;
};

type SlaState = "Pendiente" | "En curso" | "Por vencer" | "Vencida" | "Completada" | "Completada con retraso";

type ActivityRun = {
  id: string;
  employeeId: string;
  date: string;
  itemType: "Actividad" | "Aseo";
  itemId: string;
  title: string;
  scheduledStart: string;
  scheduledEnd: string;
  slaMinutes: number;
  evidence?: string;
  evidenceCapture?: EvidenceCapture;
  beforeEvidenceCapture?: EvidenceCapture;
  afterEvidenceCapture?: EvidenceCapture;
  startedAt?: string;
  completedAt?: string;
  status: SlaState;
  escalated?: boolean;
};

const SLA_WARN_RATIO = 0.8;

function minutesBetween(startIso?: string, endIso?: string) {
  if (!startIso) return 0;
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  return Math.max(0, (end - new Date(startIso).getTime()) / 60000);
}

function slaStatus(run: { startedAt?: string; completedAt?: string; slaMinutes: number }): SlaState {
  if (run.completedAt) {
    return minutesBetween(run.startedAt, run.completedAt) > run.slaMinutes ? "Completada con retraso" : "Completada";
  }
  if (!run.startedAt) return "Pendiente";
  const elapsed = minutesBetween(run.startedAt);
  if (elapsed > run.slaMinutes) return "Vencida";
  if (elapsed >= run.slaMinutes * SLA_WARN_RATIO) return "Por vencer";
  return "En curso";
}

function slaClassName(status: SlaState) {
  if (status === "Completada") return "ok";
  if (status === "Completada con retraso") return "warn";
  if (status === "Vencida") return "danger";
  if (status === "Por vencer") return "warn";
  if (status === "En curso") return "ok";
  return "muted";
}

function formatElapsed(startedAt?: string, completedAt?: string) {
  if (!startedAt) return "00:00";
  const totalSeconds = Math.max(
    0,
    Math.floor(((completedAt ? new Date(completedAt).getTime() : Date.now()) - new Date(startedAt).getTime()) / 1000),
  );
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

function slaSeverity(status: SlaState) {
  return (
    ({
      Vencida: 3,
      "Por vencer": 2,
      "En curso": 1,
      "Completada con retraso": 1,
      Completada: 0,
      Pendiente: 0,
    } as Record<SlaState, number>)[status] ?? 0
  );
}

function isWithinShift(shift?: { start: string; end: string }) {
  if (!shift) return false;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(shift.start);
  const end = timeToMinutes(shift.end);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return nowMinutes >= start && nowMinutes <= end;
}

function liveStatusFor(
  employee: Employee,
  activityRuns: ActivityRun[],
  dailyTasks: DailyTask[],
  shiftMap: Record<string, { start: string; end: string; name?: string }>,
  today: string,
): { state: "active" | "idle" | "breach" | "off"; label: string; className: string; sub: string } {
  const runningRun = activityRuns.find(
    (run) => run.employeeId === employee.id && run.date === today && run.startedAt && !run.completedAt,
  );
  const runningTask = dailyTasks.find(
    (task) =>
      task.employeeId === employee.id && task.date === today && task.startedAt && !task.completedAt && task.status !== "Pausada",
  );
  const candidates: { label: string; status: SlaState; elapsed: string }[] = [];
  if (runningTask) {
    const sla = runningTask.slaMinutes ?? 60;
    candidates.push({
      label: runningTask.title,
      status: slaStatus({ startedAt: runningTask.startedAt, completedAt: undefined, slaMinutes: sla }),
      elapsed: formatElapsed(runningTask.startedAt),
    });
  }
  if (runningRun) {
    candidates.push({ label: runningRun.title, status: slaStatus(runningRun), elapsed: formatElapsed(runningRun.startedAt) });
  }
  if (candidates.length) {
    const worst = candidates.sort((a, b) => slaSeverity(b.status) - slaSeverity(a.status))[0];
    return {
      state: worst.status === "Vencida" ? "breach" : "active",
      label: worst.label,
      className: slaClassName(worst.status),
      sub: `${worst.status} · ${worst.elapsed}`,
    };
  }
  if (isWithinShift(shiftMap[employee.shift])) {
    return { state: "idle", label: "Sin actividad activa", className: "warn", sub: "Tiempo libre" };
  }
  return { state: "off", label: "Fuera de turno", className: "muted", sub: shiftMap[employee.shift]?.name ?? "Sin turno" };
}

// Sueldos del Manual Corporativo (Sec. 3 — Perfiles de Puesto) se pactan quincenales;
// se toma el punto medio del rango y se divide entre 15 dias para el costo del dia.
function dailySalaryFor(employee: Employee) {
  if (employee.salaryMin === undefined || employee.salaryMax === undefined) return 0;
  return (employee.salaryMin + employee.salaryMax) / 2 / 15;
}

function paidMinutesFor(shift?: { start: string; end: string; lunchStart?: string; lunchEnd?: string }) {
  if (!shift) return 0;
  const start = timeToMinutes(shift.start);
  const end = timeToMinutes(shift.end);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  let total = end - start;
  const lunchStart = shift.lunchStart ? timeToMinutes(shift.lunchStart) : NaN;
  const lunchEnd = shift.lunchEnd ? timeToMinutes(shift.lunchEnd) : NaN;
  if (!Number.isNaN(lunchStart) && !Number.isNaN(lunchEnd) && lunchEnd > lunchStart) {
    total -= lunchEnd - lunchStart;
  }
  return Math.max(0, total);
}

// Minutos "concluidos" del cronometro SLA: actividades de rutina + tareas asignadas
// que ya se marcaron completadas hoy. Sirve como proxy de tiempo efectivo mientras
// no exista captura fotografica de evidencia (pendiente como modulo aparte).
function completedMinutesFor(employeeId: string, date: string, activityRuns: ActivityRun[], dailyTasks: DailyTask[]) {
  const fromRuns = activityRuns
    .filter((run) => run.employeeId === employeeId && run.date === date && run.completedAt)
    .reduce((sum, run) => sum + run.slaMinutes, 0);
  const fromTasks = dailyTasks
    .filter((task) => task.employeeId === employeeId && task.date === date && task.completedAt)
    .reduce((sum, task) => sum + (task.slaMinutes ?? Math.max(15, timeToMinutes(task.end) - timeToMinutes(task.start))), 0);
  return fromRuns + fromTasks;
}

type ShiftConfig = (typeof defaultShiftConfigs)[number];
type ActivitySchedule = (typeof defaultActivitySchedules)[number];
type CleaningRole = (typeof defaultCleaningRole)[number];
type Branch = Employee["branch"];

const auxiliaryViews = new Set(["panel", "asistencia", "tareas", "solicitudes", "instructivo"]);
const areaLeaderViews = new Set([
  "panel", "kpis", "asistencia", "organigrama", "procesos", "auditorias",
  "evaluacion", "garantias", "tareas", "solicitudes", "instructivo",
]);

function canAccessView(employee: Employee, targetView: string) {
  if (employee.role === "AUXILIAR") return auxiliaryViews.has(targetView);
  if (employee.role === "JEFE_AREA") return areaLeaderViews.has(targetView);
  return true;
}

// Autorización de apertura/cierre por puesto real de cada sucursal, no por nombre: quien hoy
// tenga el puesto de gerente/administrador de tienda de esa sucursal puede autorizar, sin
// importar quién sea la persona (evita el mismo problema que tuvo el aseo por nombre fijo).
function canAuthorizeAsManager(employee: Employee, branch: string) {
  return canGovern(employee) || (["GERENTE_TIENDA", "ADMIN_TIENDA"].includes(employee.role) && employee.branch === branch);
}

function canAuthorizeAsCashier(employee: Employee, branch: string) {
  return canGovern(employee) || (["CAJERO", "GERENTE_TIENDA", "ADMIN_TIENDA"].includes(employee.role) && employee.branch === branch);
}

function workSequenceFor(
  employee: Employee,
  date: string,
  location: string,
  schedules: ActivitySchedule[],
  tasks: DailyTask[],
) {
  const targeted = schedules.filter((item) => item.employeeIds?.includes(employee.id) && (!item.branch || item.branch === location));
  const routine = targeted.length
    ? targeted
    : schedules.filter((item) => item.branch === location && item.ownerRoles.includes(employee.role));
  const entries = [
    ...routine.map((item) => ({ id: item.id, title: item.name, start: item.start, end: item.end, status: "Programada", kind: "Proceso" })),
    ...tasks.filter((task) => task.employeeId === employee.id && task.date === date).map((task) => ({ id: task.id, title: task.title, start: task.start, end: task.end, status: task.status, kind: "Tarea" })),
  ].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const currentIndex = entries.findIndex((item) => timeToMinutes(item.start) <= minutes && timeToMinutes(item.end) > minutes);
  const nextIndex = currentIndex >= 0 ? currentIndex + 1 : entries.findIndex((item) => timeToMinutes(item.start) > minutes);
  const previousIndex = currentIndex >= 0 ? currentIndex - 1 : nextIndex > 0 ? nextIndex - 1 : entries.length - 1;
  return {
    entries,
    previous: previousIndex >= 0 ? entries[previousIndex] : undefined,
    current: currentIndex >= 0 ? entries[currentIndex] : undefined,
    next: nextIndex >= 0 ? entries[nextIndex] : undefined,
  };
}

const load = <T,>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
};

let lastCloudMutationAt = 0;
const save = (key: string, value: unknown) => {
  lastCloudMutationAt = Date.now();
  localStorage.setItem(key, JSON.stringify(value));
  markCloudPending(key, value);
  void cloudSave(key, value)
    .then(() => clearCloudPending(key))
    .catch((error) => console.error("No se pudo guardar la evidencia en la nube; se conserva localmente para reintento", error));
};

type WorkLocation = {
  id: string;
  employeeId: string;
  date: string;
  location: "Matriz" | "Sucursal Centro";
  assignedById: string;
};

type SlaReview = {
  id: string;
  sourceType: "Tarea" | "Actividad" | "Apertura";
  sourceId: string;
  employeeId: string;
  date: string;
  decision: "Justificada" | "Incumplimiento" | "Reconocimiento";
  scoreImpact: 0 | -1 | 1;
  note: string;
  reviewedById: string;
  reviewedAt: string;
};

type StoreOpeningCheck = {
  id: string;
  branch: "Matriz" | "Sucursal Centro";
  date: string;
  minimumStaff: boolean;
  systemsReady: boolean;
  processComplete: boolean;
  managerId?: string;
  openedAt?: string;
  openedById?: string;
  // Checklist detallado del proceso real de apertura. Orden: 1) gerente autoriza,
  // 2) cajero autoriza (caja + ERP), 3) con ambas autorizaciones, indicación para todos
  // de abrir cortinas y puertas (doorsOpenedAt/openedAt es esa confirmación final).
  managerAuthorizedAt?: string;
  managerAuthorizedById?: string;
  erpReady?: boolean;
  cashierAuthorizedAt?: string;
  cashierAuthorizedById?: string;
  doorsOpenedAt?: string;
  doorsOpenedById?: string;
  // Reflejo de "caja abierta" guardado aquí (en app_state, visible para todos los roles)
  // porque cash_session_records tiene permisos por sucursal/dueño y un auxiliar o cajero
  // de otra caja no puede leer la fila real: sin este reflejo, su pantalla mostraba
  // "tienda cerrada" aunque el gerente ya la hubiera abierto.
  cashOpenConfirmedAt?: string;
  cashOpenConfirmedById?: string;
  // Checklist de cierre, mismo patrón: gerente autoriza, cajero autoriza (requiere corte
  // de caja del día ya capturado), y con ambas listas, indicación de cerrar cortinas y
  // puertas (closedAt es esa confirmación final).
  managerClosingAuthorizedAt?: string;
  managerClosingAuthorizedById?: string;
  cashierClosingAuthorizedAt?: string;
  cashierClosingAuthorizedById?: string;
  closedAt?: string;
  closedById?: string;
};

type DailyClosure = {
  date: string;
  closedAt: string;
  attendanceRecords: number;
  completedTasks: number;
  incompleteTasks: number;
  incompleteActivities: number;
  incompleteProcesses: number;
  alertsCreated: number;
};

const clearLegacyLocalCache = () => {
  // Los datos operativos y pendientes no se eliminan: son evidencia hasta que
  // Supabase confirma el guardado. La sesión segura vive aparte en sessionStorage.
};

const timeNow = () =>
  new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

const oaxacaNow = () => new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", dateStyle: "full", timeStyle: "medium" }).format(new Date());
const oaxacaDateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const oaxacaDateKeyFrom = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));

// Minutos transcurridos desde medianoche (hora Ciudad de México) para un ISO dado. Se usa para
// validar la ventana de apertura puntual de tienda (8:00-8:15).
const minutesOfDayMx = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
};
const OPENING_WINDOW_START = 8 * 60;
const OPENING_WINDOW_END = 8 * 60 + 15;

// Ventanas de puntualidad para el checador de entrada.
const ARRIVAL_ON_TIME_END = 8 * 60 + 10; // 8:10
const ARRIVAL_LATE_END = 8 * 60 + 30; // 8:30
const ARRIVAL_BLOCK_AT = 8 * 60 + 45; // 8:45 — a partir de aquí se bloquea el autochecado
// Únicos 4 usuarios que pueden registrar la entrada de otro colaborador después del bloqueo
// (permisos, avisos o imprevistos ya autorizados fuera del sistema).
const LATE_ATTENDANCE_OVERRIDE_IDS = ["001", "002", "003", "005"];

function arrivalPunctuality(minutes: number): { label: string; className: string } {
  if (minutes <= ARRIVAL_ON_TIME_END) return { label: "A tiempo", className: "ok" };
  if (minutes <= ARRIVAL_LATE_END) return { label: "Tarde", className: "warn" };
  if (minutes < ARRIVAL_BLOCK_AT) return { label: "Muy tarde", className: "warn" };
  return { label: "Día no laborable", className: "danger" };
}

function App() {
  const [clockNow, setClockNow] = useState(() => new Date());
  const [activeId, setActiveId] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [view, setView] = useState("panel");
  const [collaborators, setCollaborators] = useState<Employee[]>(() => load("xoxo.collaborators", defaultEmployees));
  const [attendance, setAttendance] = useState<Attendance[]>(() => load("xoxo.attendance", []));
  const [evaluations, setEvaluations] = useState<Evaluation[]>(() => load("xoxo.evaluations", []));
  const [cashIncidents, setCashIncidents] = useState<CashIncident[]>(() => load("xoxo.cash", []));
  const [cashSessions, setCashSessions] = useState<CashSession[]>(() => load("xoxo.cashSessions", []));
  const [cashCuts, setCashCuts] = useState<CashCut[]>(() => load("xoxo.cashCuts", []));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => load("xoxo.suppliers", []));
  const [payables, setPayables] = useState<Payable[]>(() => load("xoxo.payables", []));
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => load("xoxo.bankAccounts", []));
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>(() => load("xoxo.bankTransactions", []));
  const [monthlyBudgets, setMonthlyBudgets] = useState<MonthlyBudget[]>(() => load("xoxo.monthlyBudgets", []));
  const [kpiRecords, setKpiRecords] = useState<KpiRecord[]>(() => load("xoxo.kpiRecords", []));
  const [processAudits, setProcessAudits] = useState<ProcessAudit[]>(() => load("xoxo.processAudits", []));
  const [branchOpenings, setBranchOpenings] = useState<BranchOpening[]>(() => load("xoxo.branchOpenings", []));
  const [warranties, setWarranties] = useState<Warranty[]>(() => load("xoxo.warranties", []));
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>(() => load("xoxo.dailyTasks", []));
  const [processInstances, setProcessInstances] = useState<ProcessInstance[]>(() => load("xoxo.processInstances", []));
  const [internalRequests, setInternalRequests] = useState<InternalRequest[]>(() => load("xoxo.internalRequests", []));
  const [activityRuns, setActivityRuns] = useState<ActivityRun[]>(() => load("xoxo.activityRuns", []));
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>(() => load("xoxo.workLocations", []));
  const [slaReviews, setSlaReviews] = useState<SlaReview[]>(() => load("xoxo.slaReviews", []));
  const [storeOpeningChecks, setStoreOpeningChecks] = useState<StoreOpeningCheck[]>(() => load("xoxo.storeOpeningChecks", []));
  const [dailyClosures, setDailyClosures] = useState<DailyClosure[]>(() => load("xoxo.dailyClosures", []));
  const [shiftConfigs, setShiftConfigs] = useState<ShiftConfig[]>(() => load("xoxo.shiftConfigs", defaultShiftConfigs));
  const [activitySchedules, setActivitySchedules] = useState<ActivitySchedule[]>(() =>
    load("xoxo.activitySchedules", defaultActivitySchedules),
  );
  const [cleaningRole, setCleaningRole] = useState<CleaningRole[]>(() => load("xoxo.cleaningRole", defaultCleaningRole));
  const [targetEvalId, setTargetEvalId] = useState("006");
  const [scores, setScores] = useState(evaluationCriteria.map(() => 10));
  const [note, setNote] = useState("");
  const [personalSales, setPersonalSales] = useState(0);
  const [salesGoal, setSalesGoal] = useState(1000);

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const navigate = (targetView: string) => {
    if (canAccessView(user, targetView)) setView(targetView);
  };

  useEffect(() => {
    let active = true;
    clearLegacyLocalCache();
    const applySession = async () => {
      const session = await getSession();
      if (!active) return;
      const employeeNumber = sessionEmployeeNumber(session);
      setActiveId(employeeNumber);
      setLoginId(employeeNumber);
      setIsAuthenticated(Boolean(session && employeeNumber));
      setMustChangePassword(Boolean(session?.user.user_metadata?.must_change_password));
      setAuthLoading(false);
    };
    void applySession();
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      const employeeNumber = sessionEmployeeNumber(session);
      setActiveId(employeeNumber);
      setIsAuthenticated(Boolean(session && employeeNumber));
      setMustChangePassword(Boolean(session?.user.user_metadata?.must_change_password));
      setAuthLoading(false);
    }).data.subscription;
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isCloudReady || !isAuthenticated) return;
    const hydrate = async () => {
      const [
        cloudCollaborators,
        cloudAttendance,
        cloudEvaluations,
        cloudCashIncidents,
        cloudCashSessions,
        cloudCashCuts,
        cloudSuppliers,
        cloudPayables,
        cloudBankAccounts,
        cloudBankTransactions,
        cloudMonthlyBudgets,
        cloudKpiRecords,
        cloudProcessAudits,
        cloudBranchOpenings,
        cloudWarranties,
        cloudDailyTasks,
        cloudProcessInstances,
        cloudInternalRequests,
        cloudActivityRuns,
        cloudShiftConfigs,
        cloudActivitySchedules,
        cloudCleaningRole,
        cloudWorkLocations,
        cloudSlaReviews,
        cloudStoreOpeningChecks,
      ] = await Promise.all([
        cloudLoad("xoxo.collaborators", collaborators),
        cloudLoad("xoxo.attendance", attendance),
        cloudLoad("xoxo.evaluations", evaluations),
        cloudLoad("xoxo.cash", cashIncidents),
        cloudLoad("xoxo.cashSessions", cashSessions),
        cloudLoad("xoxo.cashCuts", cashCuts),
        cloudLoad("xoxo.suppliers", suppliers),
        cloudLoad("xoxo.payables", payables),
        cloudLoad("xoxo.bankAccounts", bankAccounts),
        cloudLoad("xoxo.bankTransactions", bankTransactions),
        cloudLoad("xoxo.monthlyBudgets", monthlyBudgets),
        cloudLoad("xoxo.kpiRecords", kpiRecords),
        cloudLoad("xoxo.processAudits", processAudits),
        cloudLoad("xoxo.branchOpenings", branchOpenings),
        cloudLoad("xoxo.warranties", warranties),
        cloudLoad("xoxo.dailyTasks", dailyTasks),
        cloudLoad("xoxo.processInstances", processInstances),
        cloudLoad("xoxo.internalRequests", internalRequests),
        cloudLoad("xoxo.activityRuns", activityRuns),
        cloudLoad("xoxo.shiftConfigs", shiftConfigs),
        cloudLoad("xoxo.activitySchedules", activitySchedules),
        cloudLoad("xoxo.cleaningRole", cleaningRole),
        cloudLoad("xoxo.workLocations", workLocations),
        cloudLoad("xoxo.slaReviews", slaReviews),
        cloudLoad("xoxo.storeOpeningChecks", storeOpeningChecks),
      ]);
      const organizationOverrides: Record<string, Partial<Employee>> = {
        "005": { branch: "Sucursal Centro", shift: "A" }, "006": { branch: "Sucursal Centro", shift: "A", supervisorId: "005" },
        "008": { branch: "Matriz", shift: "A", supervisorId: "003" }, "009": { branch: "Matriz", shift: "A", supervisorId: "003" },
        "010": { branch: "Matriz", shift: "A", supervisorId: "003" }, "007": { branch: "Matriz", shift: "B", supervisorId: "003" },
        "011": { branch: "Matriz", shift: "B", supervisorId: "003" }, "012": { branch: "Matriz", shift: "B", supervisorId: "003" },
      };
      const normalizedCollaborators = cloudCollaborators.map((employee) => ({ ...employee, ...(organizationOverrides[employee.id] || {}) }));
      setCollaborators(normalizedCollaborators);
      setAttendance(cloudAttendance);
      setEvaluations(cloudEvaluations);
      setCashIncidents(cloudCashIncidents);
      setCashSessions(cloudCashSessions);
      setCashCuts(cloudCashCuts);
      setSuppliers(cloudSuppliers);
      setPayables(cloudPayables);
      setBankAccounts(cloudBankAccounts);
      setBankTransactions(cloudBankTransactions);
      setMonthlyBudgets(cloudMonthlyBudgets);
      setKpiRecords(cloudKpiRecords);
      setProcessAudits(cloudProcessAudits);
      setBranchOpenings(cloudBranchOpenings);
      setWarranties(cloudWarranties);
      setDailyTasks(cloudDailyTasks);
      setProcessInstances(cloudProcessInstances);
      setInternalRequests(cloudInternalRequests);
      setActivityRuns(cloudActivityRuns);
      setShiftConfigs(cloudShiftConfigs);
      const currentCloudSchedules = cloudActivitySchedules.filter((item) => item.id !== "centro-traslado-apertura");
      const mergedActivitySchedules = [...currentCloudSchedules, ...defaultActivitySchedules.filter((preset) => !currentCloudSchedules.some((item) => item.id === preset.id))];
      setActivitySchedules(mergedActivitySchedules);
      const normalizedCleaning = cloudCleaningRole.map((row) => ({ ...row, branch: row.branch || "Matriz" as const }));
      const mergedCleaning = [...normalizedCleaning, ...defaultCleaningRole.filter((preset)=>preset.branch==="Sucursal Centro"&&!normalizedCleaning.some((row)=>row.branch===preset.branch&&row.activity===preset.activity))];
      setCleaningRole(mergedCleaning);
      setWorkLocations(cloudWorkLocations);
      setSlaReviews(cloudSlaReviews);
      setStoreOpeningChecks(cloudStoreOpeningChecks);
      if (JSON.stringify(normalizedCollaborators) !== JSON.stringify(cloudCollaborators)) save("xoxo.collaborators", normalizedCollaborators);
      if (JSON.stringify(mergedActivitySchedules) !== JSON.stringify(cloudActivitySchedules)) save("xoxo.activitySchedules", mergedActivitySchedules);
      if (JSON.stringify(mergedCleaning) !== JSON.stringify(cloudCleaningRole)) save("xoxo.cleaningRole", mergedCleaning);
    };
    void hydrate();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let refreshing = false;
    const refreshOperationalState = async () => {
      if (refreshing) return;
      if (Date.now() - lastCloudMutationAt < 12000) return;
      refreshing = true;
      try {
        const [latestTasks, latestProcesses, latestRequests, latestAttendance, latestCashSessions, latestOpeningChecks, latestActivityRuns, latestWorkLocations, latestClosures, latestCollaborators, latestCleaningRole, latestSlaReviews] = await Promise.all([
          cloudRefresh<DailyTask[]>("xoxo.dailyTasks"),
          cloudRefresh<ProcessInstance[]>("xoxo.processInstances"),
          cloudRefresh<InternalRequest[]>("xoxo.internalRequests"),
          cloudRefresh<Attendance[]>("xoxo.attendance"),
          cloudRefresh<CashSession[]>("xoxo.cashSessions"),
          cloudRefresh<StoreOpeningCheck[]>("xoxo.storeOpeningChecks"),
          cloudRefresh<ActivityRun[]>("xoxo.activityRuns"),
          cloudRefresh<WorkLocation[]>("xoxo.workLocations"),
          cloudRefresh<DailyClosure[]>("xoxo.dailyClosures"),
          // Directorio y aseo también deben llegar a todas las sesiones abiertas: si un
          // director cambia un nombre, el resto de las pantallas ya conectadas deben
          // reflejarlo sin necesidad de cerrar sesión.
          cloudRefresh<Employee[]>("xoxo.collaborators"),
          cloudRefresh<CleaningRole[]>("xoxo.cleaningRole"),
          cloudRefresh<SlaReview[]>("xoxo.slaReviews"),
        ]);
        if (latestTasks) setDailyTasks(latestTasks);
        if (latestProcesses) setProcessInstances(latestProcesses);
        if (latestRequests) setInternalRequests(latestRequests);
        if (latestAttendance) setAttendance(latestAttendance);
        if (latestCashSessions) setCashSessions(latestCashSessions);
        if (latestOpeningChecks) setStoreOpeningChecks(latestOpeningChecks);
        if (latestActivityRuns) setActivityRuns(latestActivityRuns);
        if (latestWorkLocations) setWorkLocations(latestWorkLocations);
        if (latestClosures) setDailyClosures(latestClosures);
        if (latestCollaborators) setCollaborators(latestCollaborators);
        if (latestCleaningRole) setCleaningRole(latestCleaningRole);
        if (latestSlaReviews) setSlaReviews(latestSlaReviews);
      } finally {
        refreshing = false;
      }
    };
    void refreshOperationalState();
    const interval = window.setInterval(() => void refreshOperationalState(), 8000);
    const refreshOnFocus = () => void refreshOperationalState();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [isAuthenticated]);

  const user = collaborators.find((employee) => employee.id === activeId) ?? collaborators[0] ?? defaultEmployees[2];
  useEffect(() => {
    if (isAuthenticated && !canAccessView(user, view)) setView("panel");
  }, [isAuthenticated, user.role, view]);
  const visibleEmployees = canViewAll(user)
    ? collaborators
    : collaborators.filter((employee) => employee.branch === user.branch || employee.id === user.id);
  const today = todayKey();
  const myAttendance = attendance.find((entry) => entry.employeeId === user.id && entry.date === today);
  const myEval = useMemo(() => {
    const dayEvaluations = evaluations.filter((entry) => entry.date === today);
    const own = dayEvaluations.find((entry) => entry.employeeId === user.id);
    if (!own) return undefined;
    const average = own.scores.reduce((sum, value) => sum + value, 0) / own.scores.length;
    return { ...own, average, rate: commissionRate(average, own.salesGoal, own.personalSales) };
  }, [evaluations, today, user.id]);
  const shiftMap = Object.fromEntries(shiftConfigs.map((shift) => [shift.key, shift])) as Record<string, ShiftConfig>;
  const currentWorkLocation = workLocations.find((item) => item.employeeId === user.id && item.date === today)?.location ?? user.branch;
  const currentCleaningAssignment = getEditableCleaningAssignment(user, cleaningRole, currentWorkLocation);
  const currentCleaningRow = getEditableCleaningRow(user, cleaningRole, currentWorkLocation);
  const userTasks = dailyTasks.filter((task) => task.employeeId === user.id && task.date === today);

  const persistCollaborators = (next: Employee[]) => {
    const sanitized = next.map((employee) => {
      const copy = { ...employee } as Employee & { password?: string };
      delete copy.password;
      return copy;
    });
    const renamed = sanitized
      .map((employee) => ({ before: collaborators.find((current) => current.id === employee.id)?.name, after: employee.name }))
      .filter((item) => item.before && item.before !== item.after) as { before: string; after: string }[];
    if (renamed.length) {
      const updatedCleaning = cleaningRole.map((row) => ({
        ...row,
        assignments: Object.fromEntries(Object.entries(row.assignments).map(([day, assigned]) => {
          const names = assigned.split("/").map((name) => name.trim()).filter(Boolean).map((name) => renamed.find((item) => item.before.toLowerCase() === name.toLowerCase())?.after || name);
          return [day, names.join(" / ")];
        })),
      }));
      setCleaningRole(updatedCleaning);
      save("xoxo.cleaningRole", updatedCleaning);
    }
    setCollaborators(sanitized);
    save("xoxo.collaborators", sanitized);
  };

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    try {
      const session = await signIn(loginId, loginPassword);
      const employeeNumber = sessionEmployeeNumber(session);
      if (!session || !employeeNumber) throw new Error("Usuario sin numero de colaborador configurado.");
      setActiveId(employeeNumber);
      setIsAuthenticated(true);
      setLoginPassword("");
    } catch {
      setLoginError("Numero de colaborador o contrasena incorrecta.");
    }
  };

  const logout = async () => {
    await signOut();
    clearLegacyLocalCache();
    setIsAuthenticated(false);
    setLoginPassword("");
    setLoginId(activeId);
  };

  const persistDailyTasks = (next: DailyTask[]) => {
    setDailyTasks(next);
    save("xoxo.dailyTasks", next);
  };

  // Asignar/quitar actividad directamente desde el panel de inicio (tabla de equipo), sin
  // pasar por la pantalla de Tareas. Sólo lo usan roles con canGovern.
  const addQuickTask = (employeeId: string, title: string, notes: string, affectsEvaluation: boolean) => {
    const start = timeNow();
    const endMinutes = Math.min(23 * 60 + 59, timeToMinutes(start) + 60);
    const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
    const next: DailyTask[] = [
      ...dailyTasks,
      {
        id: crypto.randomUUID(), title, employeeId, assignedById: user.id, assignedAt: new Date().toISOString(),
        date: today, start, end, status: "Pendiente", priority: "Media",
        notes: notes || "Actividad asignada desde el panel de inicio.",
        currentStep: "Asignada", employeeComment: "", supervisorComment: "", incidentNote: "",
        paused: false, approvalStatus: "No requerida", requiresPhoto: false, affectsEvaluation,
      },
    ];
    persistDailyTasks(next);
  };

  const removeTaskWithDecision = (task: DailyTask, decision: "Sin efecto" | "Penalizar", note: string) => {
    persistDailyTasks(dailyTasks.filter((item) => item.id !== task.id));
    if (decision === "Penalizar" && task.affectsEvaluation !== false) {
      reviewSla("Tarea", task.id, task.employeeId, "Incumplimiento", note || `Se retiró "${task.title}" sin cumplirse.`);
    }
  };

  const persistProcessInstances = (next: ProcessInstance[]) => {
    setProcessInstances(next);
    save("xoxo.processInstances", next);
  };

  const updateAttendance = async (field: keyof Attendance) => {
    const latest = await cloudRefresh<Attendance[]>("xoxo.attendance") ?? attendance;
    const existing = latest.find((entry) => entry.employeeId === user.id && entry.date === today) ?? myAttendance;
    const next = latest.filter((entry) => !(entry.employeeId === user.id && entry.date === today));
    next.push({ ...(existing ?? { employeeId: user.id, date: today }), [field]: timeNow() });
    setAttendance(next);
    save("xoxo.attendance", next);
  };

  // Registrar la entrada de otro colaborador cuando ya pasó la hora de autochecado (8:45),
  // por permisos, avisos o imprevistos ya autorizados. Sólo lo usan los 4 usuarios permitidos
  // (se restringe también en la interfaz que llama a esta función).
  const registerAttendanceFor = async (employeeId: string) => {
    const latest = await cloudRefresh<Attendance[]>("xoxo.attendance") ?? attendance;
    const existing = latest.find((entry) => entry.employeeId === employeeId && entry.date === today);
    const next = latest.filter((entry) => !(entry.employeeId === employeeId && entry.date === today));
    next.push({ ...(existing ?? { employeeId, date: today }), in: timeNow() });
    setAttendance(next);
    save("xoxo.attendance", next);
  };

  const submitEvaluation = () => {
    const next = evaluations.filter(
      (entry) => !(entry.employeeId === targetEvalId && entry.evaluatorId === user.id && entry.date === today),
    );
    next.push({
      employeeId: targetEvalId,
      evaluatorId: user.id,
      date: today,
      scores,
      note,
      personalSales,
      salesGoal,
    });
    setEvaluations(next);
    save("xoxo.evaluations", next);
    setNote("");
    setPersonalSales(0);
  };

  const addCashIncident = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = [
      ...cashIncidents,
      {
        id: crypto.randomUUID(),
        branch: user.branch,
        type: String(form.get("type")),
        amount: Number(form.get("amount")),
        recipient: String(form.get("recipient")),
        purpose: String(form.get("purpose")),
        paymentMethod: String(form.get("paymentMethod")),
        note: String(form.get("note")),
        ownerId: user.id,
        date: oaxacaDateKey(),
        folio: String(form.get("folio")),
        status: "Pendiente" as const,
        createdAt: new Date().toISOString(),
      },
    ];
    setCashIncidents(next);
    save("xoxo.cash", next);
    event.currentTarget.reset();
  };

  const assignWorkLocation = (employeeId: string, location: WorkLocation["location"]) => {
    const next = workLocations.filter((item) => !(item.employeeId === employeeId && item.date === today));
    next.push({ id: `${today}-${employeeId}`, employeeId, date: today, location, assignedById: user.id });
    setWorkLocations(next);
    save("xoxo.workLocations", next);
  };

  const reviewSla = (sourceType: SlaReview["sourceType"], sourceId: string, employeeId: string, decision: SlaReview["decision"], note: string) => {
    const review: SlaReview = { id: crypto.randomUUID(), sourceType, sourceId, employeeId, date: today, decision, scoreImpact: decision === "Incumplimiento" ? -1 : 0, note, reviewedById: user.id, reviewedAt: new Date().toISOString() };
    const next = [...slaReviews.filter((item) => !(item.sourceType === sourceType && item.sourceId === sourceId)), review];
    setSlaReviews(next);
    save("xoxo.slaReviews", next);
  };

  const updateStoreOpening = async (branch: StoreOpeningCheck["branch"], patch: Partial<StoreOpeningCheck>) => {
    const latest = await cloudRefresh<StoreOpeningCheck[]>("xoxo.storeOpeningChecks") ?? storeOpeningChecks;
    const id = `${today}-${branch}`;
    const existing = latest.find((item)=>item.id===id) ?? { id, branch, date: today, minimumStaff:false, systemsReady:false, processComplete:false };
    const updated = { ...existing, ...patch, managerId: user.id };
    const next = [...latest.filter((item)=>item.id!==id), updated];
    setStoreOpeningChecks(next);
    save("xoxo.storeOpeningChecks", next);

    // El gerente autoriza la apertura final (openedAt) sólo cuando ya se hizo el checklist
    // completo (puertas, personal, cajera + ERP Visorus, sistemas). Si eso ocurre entre 8:00
    // y 8:15, se reconoce con +1 punto a quienes participaron y a todo el personal que ya
    // se había registrado; si se abre fuera de esa ventana o se reabre el checklist, no
    // aplica bono y se retira cualquier reconocimiento previo de esa apertura.
    if ("openedAt" in patch) {
      const latestSla = await cloudRefresh<SlaReview[]>("xoxo.slaReviews") ?? slaReviews;
      const withoutPrevious = latestSla.filter((item) => !(item.sourceType === "Apertura" && item.sourceId === id));
      if (patch.openedAt) {
        const onTime = (() => {
          const minutes = minutesOfDayMx(patch.openedAt!);
          return minutes >= OPENING_WINDOW_START && minutes <= OPENING_WINDOW_END;
        })();
        if (onTime) {
          const attendedIds = attendance
            .filter((entry) => entry.date === today && entry.in && collaborators.find((employee) => employee.id === entry.employeeId)?.branch === branch)
            .map((entry) => entry.employeeId);
          const participantIds = Array.from(new Set([...attendedIds, existing.doorsOpenedById, existing.cashierAuthorizedById, user.id].filter(Boolean))) as string[];
          const grantedAt = new Date().toISOString();
          const bonuses: SlaReview[] = participantIds.map((employeeId) => ({
            id: crypto.randomUUID(),
            sourceType: "Apertura",
            sourceId: id,
            employeeId,
            date: today,
            decision: "Reconocimiento",
            scoreImpact: 1,
            note: `Apertura puntual de ${branch}: checklist completo entre 8:00 y 8:15.`,
            reviewedById: user.id,
            reviewedAt: grantedAt,
          }));
          const nextSla = [...withoutPrevious, ...bonuses];
          setSlaReviews(nextSla);
          save("xoxo.slaReviews", nextSla);
        } else if (withoutPrevious.length !== latestSla.length) {
          setSlaReviews(withoutPrevious);
          save("xoxo.slaReviews", withoutPrevious);
        }
      } else if (withoutPrevious.length !== latestSla.length) {
        setSlaReviews(withoutPrevious);
        save("xoxo.slaReviews", withoutPrevious);
      }
    }
  };

  const addCashOpening = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const branch = String(form.get("branch") || user.branch);
    const date = String(form.get("date") || today);
    if (cashSessions.some((session) => session.branch === branch && session.date === date && session.status === "Abierta")) return;
    const next: CashSession[] = [{
      id: crypto.randomUUID(), branch, date, openedById: user.id,
      openingFund: Number(form.get("openingFund")), openedAt: new Date().toISOString(),
      status: "Abierta", notes: String(form.get("notes")),
    }, ...cashSessions];
    setCashSessions(next);
    save("xoxo.cashSessions", next);
    // cash_session_records sólo lo puede leer quien la abrió, la gerencia de esa sucursal o
    // dirección; el resto del personal (auxiliares, cajeras de otra caja) necesita saber que
    // la tienda ya abrió, así que se refleja también en el checklist (app_state), que sí es
    // visible para todos.
    if (branch === "Matriz" || branch === "Sucursal Centro") {
      void updateStoreOpening(branch, { cashOpenConfirmedAt: new Date().toISOString(), cashOpenConfirmedById: user.id });
    }
    event.currentTarget.reset();
  };

  const addCashCut = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const erpSales = Number(form.get("erpSales"));
    const cardTotal = Number(form.get("cardTotal"));
    const transferTotal = Number(form.get("transferTotal"));
    const withdrawals = Number(form.get("withdrawals"));
    const providerPayments = Number(form.get("providerPayments"));
    const operationalExpenses = Number(form.get("operationalExpenses"));
    const cashCounted = Number(form.get("cashCounted"));
    const branch = String(form.get("branch") || user.branch);
    const date = String(form.get("date") || today);
    const openSession = cashSessions.find((session) => session.branch === branch && session.date === date && session.status === "Abierta");
    if (!openSession) return;
    const openingFund = openSession.openingFund;
    const cashAdditions = cashIncidents.filter((item) => item.branch === branch && item.date === date && item.type === "Ingreso adicional de efectivo" && item.status !== "Rechazado").reduce((sum,item)=>sum+item.amount,0);
    const expectedCash = openingFund + cashAdditions + erpSales - cardTotal - transferTotal - withdrawals - providerPayments - operationalExpenses;
    const difference = cashCounted - expectedCash;
    const next = [
      {
        id: crypto.randomUUID(),
        branch,
        date,
        cashierId: user.id,
        erpSales,
        cardTotal,
        transferTotal,
        withdrawals,
        providerPayments,
        operationalExpenses,
        cashCounted,
        expectedCash,
        difference,
        matches: Math.abs(difference) < 1,
        incident: String(form.get("incident")),
        notes: String(form.get("notes")),
        openingFund,
        status: "Pendiente" as const,
      },
      ...cashCuts,
    ];
    setCashCuts(next);
    save("xoxo.cashCuts", next);
    const cutId = next[0].id;
    const nextSessions: CashSession[] = cashSessions.map((session) => session.id === openSession.id
      ? { ...session, status: "Cerrada", cutId, closedAt: new Date().toISOString() }
      : session);
    setCashSessions(nextSessions);
    save("xoxo.cashSessions", nextSessions);
    event.currentTarget.reset();
  };

  const reviewCashCut = (id: string, status: "Aprobado" | "Rechazado") => {
    const reviewedAt = new Date().toISOString();
    const nextCuts = cashCuts.map((cut) => cut.id === id ? { ...cut, status, reviewedById: user.id, reviewedAt } : cut);
    setCashCuts(nextCuts);
    save("xoxo.cashCuts", nextCuts);
    if (status === "Aprobado") {
      const nextSessions: CashSession[] = cashSessions.map((session) => session.cutId === id
        ? { ...session, status: "Aprobada", approvedById: user.id, approvedAt: reviewedAt }
        : session);
      setCashSessions(nextSessions);
      save("xoxo.cashSessions", nextSessions);
    }
  };

  const reviewCashIncident = (id: string, status: "Aprobado" | "Rechazado") => {
    const reviewed = cashIncidents.find((item) => item.id === id);
    const next = cashIncidents.map((item) => item.id === id
      ? { ...item, status, approvedById: user.id, approvedAt: new Date().toISOString() }
      : item);
    setCashIncidents(next);
    save("xoxo.cash", next);
    if (reviewed?.payableId) {
      const nextPayables: Payable[] = payables.map((payable) => {
        if (payable.id !== reviewed.payableId) return payable;
        if (status === "Rechazado") return { ...payable, status: payable.paidAmount > 0 ? "Parcial" : "Pendiente" };
        const paidAmount = Math.min(payable.amount, payable.paidAmount + reviewed.amount);
        return { ...payable, paidAmount, status: paidAmount >= payable.amount ? "Pagada" : "Parcial" };
      });
      setPayables(nextPayables);
      save("xoxo.payables", nextPayables);
      if (status === "Aprobado" && reviewed.bankAccountId) {
        const payable = payables.find((item) => item.id === reviewed.payableId);
        const transaction: BankTransaction = {
          id: crypto.randomUUID(), date: reviewed.date, type: "Pago a proveedor",
          bankAccountId: reviewed.bankAccountId, amount: reviewed.amount,
          supplierId: payable?.supplierId, payableId: reviewed.payableId,
          invoice: payable?.invoice || reviewed.folio, concept: payable?.concept || reviewed.purpose || "Pago a proveedor",
          hasInvoice: payable?.hasInvoice ?? true, deductible: payable?.deductible ?? false,
          counterparty: reviewed.recipient || "Proveedor", reference: reviewed.folio,
          branch: reviewed.branch, ownerId: user.id, createdAt: new Date().toISOString(),
          category: "Pago a proveedores", reconciled: false,
        };
        const nextTransactions = [...bankTransactions, transaction];
        setBankTransactions(nextTransactions); save("xoxo.bankTransactions", nextTransactions);
      }
    }
  };

  const addSupplier = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: Supplier[] = [...suppliers, {
      id: crypto.randomUUID(), name: String(form.get("name")), taxId: String(form.get("taxId")),
      contact: String(form.get("contact")), phone: String(form.get("phone")),
      paymentTermsDays: Number(form.get("paymentTermsDays")), branch: String(form.get("branch") || user.branch),
      status: "Activo", createdById: user.id, createdAt: new Date().toISOString(),
    }];
    setSuppliers(next); save("xoxo.suppliers", next); event.currentTarget.reset();
  };

  const addPayable = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const issueDate = String(form.get("issueDate"));
    const creditDays = Number(form.get("creditDays"));
    const explicitDueDate = String(form.get("dueDate"));
    const calculatedDue = new Date(`${issueDate}T12:00:00`);
    calculatedDue.setDate(calculatedDue.getDate() + creditDays);
    const dueDate = explicitDueDate || calculatedDue.toISOString().slice(0, 10);
    const next: Payable[] = [{
      id: crypto.randomUUID(), supplierId: String(form.get("supplierId")), invoice: String(form.get("invoice")),
      concept: String(form.get("concept")), branch: String(form.get("branch") || user.branch),
      issueDate, dueDate, amount: Number(form.get("amount")), paidAmount: 0,
      status: dueDate < today ? "Vencida" : "Pendiente", ownerId: user.id,
      notes: String(form.get("notes")), createdAt: new Date().toISOString(),
      hasInvoice: form.get("hasInvoice") === "on", deductible: form.get("deductible") === "on", creditDays,
    }, ...payables];
    setPayables(next); save("xoxo.payables", next); event.currentTarget.reset();
  };

  const requestPayablePayment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payableId = String(form.get("payableId"));
    const payable = payables.find((item) => item.id === payableId);
    if (!payable) return;
    const amount = Number(form.get("amount"));
    const incident: CashIncident = {
      id: crypto.randomUUID(), branch: payable.branch, type: "Pago a proveedor", amount,
      recipient: suppliers.find((supplier) => supplier.id === payable.supplierId)?.name,
      purpose: payable.concept, paymentMethod: String(form.get("paymentMethod")),
      note: String(form.get("note")), ownerId: user.id, date: today, folio: String(form.get("folio")),
      status: "Pendiente", createdAt: new Date().toISOString(), payableId,
      bankAccountId: String(form.get("bankAccountId")),
    };
    const nextCash = [...cashIncidents, incident]; setCashIncidents(nextCash); save("xoxo.cash", nextCash);
    const nextPayables: Payable[] = payables.map((item) => item.id === payableId ? { ...item, status: "Pago pendiente" } : item);
    setPayables(nextPayables); save("xoxo.payables", nextPayables); event.currentTarget.reset();
  };

  const addBankAccount = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const next: BankAccount[] = [...bankAccounts, {
      id: crypto.randomUUID(), bank: String(form.get("bank")), accountName: String(form.get("accountName")),
      lastFour: String(form.get("lastFour")), openingBalance: Number(form.get("openingBalance")),
      branch: String(form.get("branch") || user.branch), status: "Activa", createdById: user.id, createdAt: new Date().toISOString(),
    }];
    setBankAccounts(next); save("xoxo.bankAccounts", next); event.currentTarget.reset();
  };

  const addBankTransaction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const next: BankTransaction[] = [{
      id: crypto.randomUUID(), date: String(form.get("date")), type: String(form.get("type")) as BankTransaction["type"],
      bankAccountId: String(form.get("bankAccountId")), destinationBankAccountId: String(form.get("destinationBankAccountId")) || undefined,
      amount: Number(form.get("amount")), supplierId: String(form.get("supplierId")) || undefined,
      invoice: String(form.get("invoice")), concept: String(form.get("concept")),
      hasInvoice: form.get("hasInvoice") === "on", deductible: form.get("deductible") === "on",
      counterparty: String(form.get("counterparty")), reference: String(form.get("reference")),
      branch: String(form.get("branch") || user.branch), ownerId: user.id, createdAt: new Date().toISOString(),
      category: String(form.get("category") || "Sin clasificar"), reconciled: false,
    }, ...bankTransactions];
    setBankTransactions(next); save("xoxo.bankTransactions", next); event.currentTarget.reset();
  };

  const importBankTransactions = async (file: File) => {
    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map((value) => value.trim().toLowerCase());
    const valueAt = (values: string[], name: string) => values[headers.indexOf(name)]?.trim() || "";
    const imported: BankTransaction[] = lines.slice(1).map((line) => {
      const values = line.split(",").map((value) => value.replace(/^"|"$/g, ""));
      const bankName = valueAt(values, "banco");
      const account = bankAccounts.find((item) => `${item.bank} ${item.lastFour}`.toLowerCase().includes(bankName.toLowerCase()));
      return {
        id: crypto.randomUUID(), date: valueAt(values, "fecha"),
        type: (valueAt(values, "tipo") || "Gasto operativo") as BankTransaction["type"],
        bankAccountId: account?.id || "sin-cuenta", amount: Number(valueAt(values, "monto")),
        supplierId: suppliers.find((item) => item.name.toLowerCase() === valueAt(values, "proveedor").toLowerCase())?.id,
        invoice: valueAt(values, "factura"), concept: valueAt(values, "concepto"),
        hasInvoice: ["si","sí","true","1"].includes(valueAt(values, "tiene_factura").toLowerCase()),
        deductible: ["si","sí","true","1"].includes(valueAt(values, "deducible").toLowerCase()),
        counterparty: valueAt(values, "proveedor") || valueAt(values, "contraparte"),
        reference: valueAt(values, "referencia"), branch: valueAt(values, "sucursal") || user.branch,
        ownerId: user.id, createdAt: new Date().toISOString(),
        category: valueAt(values, "categoria") || "Sin clasificar",
        reconciled: ["si","sí","true","1"].includes(valueAt(values, "conciliado").toLowerCase()),
      };
    }).filter((item) => item.date && item.amount > 0 && item.bankAccountId !== "sin-cuenta");
    const next = [...imported, ...bankTransactions]; setBankTransactions(next); save("xoxo.bankTransactions", next);
  };

  const toggleBankReconciliation = (transactionId: string) => {
    const next = bankTransactions.map((item) => item.id === transactionId ? {
      ...item, reconciled: !item.reconciled,
      reconciledAt: !item.reconciled ? new Date().toISOString() : undefined,
      reconciledById: !item.reconciled ? user.id : undefined,
    } : item);
    setBankTransactions(next); save("xoxo.bankTransactions", next);
  };

  const addMonthlyBudget = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const month = String(form.get("month")); const category = String(form.get("category")); const branch = String(form.get("branch") || user.branch);
    const existing = monthlyBudgets.find((item) => item.month === month && item.category === category && item.branch === branch);
    const budget: MonthlyBudget = { id: existing?.id || crypto.randomUUID(), date: `${month}-01`, month, category, amount: Number(form.get("amount")), branch, ownerId: user.id, createdAt: existing?.createdAt || new Date().toISOString() };
    const next = existing ? monthlyBudgets.map((item) => item.id === existing.id ? budget : item) : [budget, ...monthlyBudgets];
    setMonthlyBudgets(next); save("xoxo.monthlyBudgets", next); event.currentTarget.reset();
  };

  const saveKpiRecord = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const month = String(form.get("month")); const name = String(form.get("name")); const employeeId = String(form.get("employeeId")) || undefined; const branch = String(form.get("branch") || user.branch);
    const existing = kpiRecords.find((item) => item.month === month && item.name === name && item.employeeId === employeeId && item.branch === branch);
    const record: KpiRecord = {
      id: existing?.id || crypto.randomUUID(), date: `${month}-01`, month, name, area: String(form.get("area")),
      role: String(form.get("role")) as KpiRecord["role"], employeeId, branch,
      target: Number(form.get("target")), actual: Number(form.get("actual")), unit: String(form.get("unit")),
      direction: String(form.get("direction")) as KpiRecord["direction"], frequency: String(form.get("frequency")) as KpiRecord["frequency"],
      ownerId: user.id, notes: String(form.get("notes")), createdAt: existing?.createdAt || new Date().toISOString(),
    };
    const next = existing ? kpiRecords.map((item) => item.id === existing.id ? record : item) : [record, ...kpiRecords];
    setKpiRecords(next); save("xoxo.kpiRecords", next); event.currentTarget.reset();
  };

  const startProcessAudit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const process = processes.find((item)=>item.id===String(form.get("processId"))); if(!process) return;
    const audit: ProcessAudit = { id: crypto.randomUUID(), date: String(form.get("date")), processId: process.id, processName: process.name, branch: String(form.get("branch")||user.branch), auditorId: user.id, responsibleId: String(form.get("responsibleId")), status: "Abierta", notes: String(form.get("notes")), createdAt: new Date().toISOString(), checks: process.steps.map((step)=>({title:step.title,result:"Pendiente",finding:"",correctiveAction:"",dueDate:"",closed:false})) };
    const next=[audit,...processAudits]; setProcessAudits(next); save("xoxo.processAudits",next); event.currentTarget.reset();
  };

  const updateProcessAudit = (audit: ProcessAudit) => {
    const failed = audit.checks.some((check)=>check.result==="No cumple"&&!check.closed); const pending = audit.checks.some((check)=>check.result==="Pendiente");
    const updated={...audit,status:(pending?"Abierta":failed?"En corrección":"Cerrada") as ProcessAudit["status"]};
    const next=processAudits.map((item)=>item.id===updated.id?updated:item); setProcessAudits(next); save("xoxo.processAudits",next);
  };

  const startBranchOpening = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form=new FormData(event.currentTarget); const targetDate=String(form.get("targetDate"));
    const template=[
      ["Estrategia","Validar estudio de mercado y zona"],["Legal","Constituir permisos, licencias y contratos"],["Local","Firmar contrato y recibir inmueble"],["Local","Completar adecuaciones, señalización y seguridad"],["Tecnología","Instalar internet, POS, ERP, cámaras e impresoras"],["Finanzas","Abrir cuentas, cajas y fondos autorizados"],["Personal","Definir plantilla y contratar responsables"],["Personal","Capacitar puestos, procesos y seguridad"],["Inventario","Definir surtido y presupuesto inicial"],["Inventario","Recibir, contar, etiquetar y acomodar mercancía"],["Proveedores","Activar proveedores y condiciones comerciales"],["Operación","Probar apertura, venta, entrega, devolución y cierre"],["Marketing","Ejecutar campaña de apertura local"],["Auditoría","Realizar auditoría preapertura"],["Dirección","Autorizar apertura al público"]
    ];
    const opening:BranchOpening={id:crypto.randomUUID(),date:todayKey(),name:String(form.get("name")),city:String(form.get("city")),address:String(form.get("address")),targetDate,managerId:String(form.get("managerId")),ownerId:user.id,status:"Planeación",investmentBudget:Number(form.get("investmentBudget")),actualInvestment:0,breakEvenMonthly:Number(form.get("breakEvenMonthly")),notes:String(form.get("notes")),createdAt:new Date().toISOString(),steps:template.map(([stage,title])=>({stage,title,responsibleId:"",dueDate:targetDate,budget:0,actual:0,done:false,evidence:""}))};
    const next=[opening,...branchOpenings];setBranchOpenings(next);save("xoxo.branchOpenings",next);event.currentTarget.reset();
  };

  const updateBranchOpening = (opening: BranchOpening) => {
    const actualInvestment=opening.steps.reduce((sum,step)=>sum+step.actual,0); const allDone=opening.steps.every((step)=>step.done);
    const updated={...opening,actualInvestment,status:(allDone&&opening.status!=="Abierta"?"Lista para abrir":opening.status) as BranchOpening["status"]};
    const next=branchOpenings.map((item)=>item.id===updated.id?updated:item);setBranchOpenings(next);save("xoxo.branchOpenings",next);
  };

  const addWarranty = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const created: Warranty = {
        id: crypto.randomUUID(),
        provider: String(form.get("provider")),
        product: String(form.get("product")),
        reason: String(form.get("reason")),
        status: "Recibida",
        ownerId: user.id,
        date: today,
        branch: String(form.get("branch")||user.branch), customer:String(form.get("customer")),phone:String(form.get("phone")),ticket:String(form.get("ticket")),purchaseDate:String(form.get("purchaseDate")),defectType:String(form.get("defectType")),eligible:"Pendiente",supplierFolio:"",solution:"Pendiente",resolutionReference:"",resolutionAmount:0,replacementProduct:"",timeline:[{at:new Date().toISOString(),byId:user.id,action:"Garantía recibida",note:String(form.get("reason"))}],
      };
    const next = [...warranties, created];
    setWarranties(next);
    save("xoxo.warranties", next);
    event.currentTarget.reset();
  };

  const updateWarranty = (warranty: Warranty, action: string, note: string) => {
    const terminal=["Resuelta","Rechazada"].includes(warranty.status); const updated={...warranty,resolvedAt:terminal?warranty.resolvedAt||new Date().toISOString():undefined,timeline:[...(warranty.timeline||[]),{at:new Date().toISOString(),byId:user.id,action,note}]};
    const next=warranties.map((item)=>item.id===updated.id?updated:item);setWarranties(next);save("xoxo.warranties",next);
  };

  const addInternalRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: InternalRequest[] = [
      {
        id: crypto.randomUUID(),
        type: String(form.get("type")) as InternalRequest["type"],
        title: String(form.get("title")),
        message: String(form.get("message")),
        requestedById: user.id,
        recipientId: String(form.get("recipientId")),
        date: today,
        priority: String(form.get("priority")) as InternalRequest["priority"],
        status: "Abierta",
        confidentiality: String(form.get("confidentiality")) as InternalRequest["confidentiality"],
        response: "",
      },
      ...internalRequests,
    ];
    setInternalRequests(next);
    save("xoxo.internalRequests", next);
    event.currentTarget.reset();
  };

  const updateInternalRequests = (next: InternalRequest[]) => {
    setInternalRequests(next);
    save("xoxo.internalRequests", next);
  };

  const persistActivityRuns = (next: ActivityRun[]) => {
    setActivityRuns(next);
    save("xoxo.activityRuns", next);
  };

  const escalate = (title: string, message: string, recipientId: string | undefined, priority: InternalRequest["priority"] = "Alta") => {
    if (!recipientId) return;
    const next: InternalRequest[] = [
      {
        id: crypto.randomUUID(),
        type: "Reporte",
        title,
        message,
        requestedById: "sistema",
        recipientId,
        date: today,
        priority,
        status: "Abierta",
        confidentiality: "Normal",
        response: "",
      },
      ...internalRequests,
    ];
    setInternalRequests(next);
    save("xoxo.internalRequests", next);
  };

  useEffect(() => {
    if (!isAuthenticated || !canGovern(user)) return;
    const closePreviousDay = async () => {
      const prior = new Date();
      prior.setDate(prior.getDate() - 1);
      const priorDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(prior);
      const [closuresCloud, tasksCloud, processesCloud, attendanceCloud, requestsCloud, runsCloud] = await Promise.all([
        cloudRefresh<DailyClosure[]>("xoxo.dailyClosures"), cloudRefresh<DailyTask[]>("xoxo.dailyTasks"),
        cloudRefresh<ProcessInstance[]>("xoxo.processInstances"), cloudRefresh<Attendance[]>("xoxo.attendance"),
        cloudRefresh<InternalRequest[]>("xoxo.internalRequests"),
        cloudRefresh<ActivityRun[]>("xoxo.activityRuns"),
      ]);
      const closures = closuresCloud ?? dailyClosures;
      if (closures.some((closure) => closure.date === priorDate)) return;
      const priorTasks = (tasksCloud ?? dailyTasks).filter((task) => task.date === priorDate);
      const incompleteTasks = priorTasks.filter((task) => task.status !== "Completada");
      const incompleteProcesses = (processesCloud ?? processInstances).filter((process) => process.date === priorDate && process.status !== "Completado");
      const incompleteActivities = (runsCloud ?? activityRuns).filter((run) => run.startedAt && oaxacaDateKeyFrom(run.startedAt) === priorDate && !run.completedAt);
      const existingRequests = requestsCloud ?? internalRequests;
      const taskAlerts: InternalRequest[] = incompleteTasks.map((task) => ({ id: `cierre-${priorDate}-${task.id}`, type: "Reporte", title: `Tarea no terminada: ${task.title}`, message: `El corte diario detectó que ${collaborators.find((person) => person.id === task.employeeId)?.name ?? task.employeeId} no terminó esta tarea. Debe revisarse la evidencia y determinar la sanción correspondiente.`, requestedById: "sistema", recipientId: task.assignedById, date: today, priority: "Alta", status: "Abierta", confidentiality: "Normal", response: "" }));
      const activityAlerts: InternalRequest[] = incompleteActivities.map((run) => { const employee = collaborators.find((person) => person.id === run.employeeId); return { id: `cierre-${priorDate}-${run.id}`, type: "Reporte", title: `Actividad no terminada: ${run.title}`, message: `${employee?.name ?? run.employeeId} inició esta actividad y no registró su conclusión. Debe revisarse para determinar la sanción correspondiente.`, requestedById: "sistema", recipientId: currentSupervisor(employee ?? user, collaborators)?.id ?? "003", date: today, priority: "Alta", status: "Abierta", confidentiality: "Normal", response: "" }; });
      const processAlerts: InternalRequest[] = incompleteProcesses.map((process) => ({ id: `cierre-${priorDate}-${process.id}`, type: "Reporte", title: `Proceso pendiente: ${process.title}`, message: `El proceso del día anterior quedó sin completar y requiere seguimiento y determinación de responsabilidad.`, requestedById: "sistema", recipientId: process.startedById || "003", date: today, priority: "Alta", status: "Abierta", confidentiality: "Normal", response: "" }));
      const alerts = [...taskAlerts, ...activityAlerts, ...processAlerts];
      const uniqueAlerts = alerts.filter((alert) => !existingRequests.some((request) => request.id === alert.id));
      const closure: DailyClosure = { date: priorDate, closedAt: new Date().toISOString(), attendanceRecords: (attendanceCloud ?? attendance).filter((entry) => entry.date === priorDate).length, completedTasks: priorTasks.length - incompleteTasks.length, incompleteTasks: incompleteTasks.length, incompleteActivities: incompleteActivities.length, incompleteProcesses: incompleteProcesses.length, alertsCreated: uniqueAlerts.length };
      const nextClosures = [closure, ...closures];
      setDailyClosures(nextClosures); save("xoxo.dailyClosures", nextClosures);
      if (uniqueAlerts.length) { const nextRequests = [...uniqueAlerts, ...existingRequests]; setInternalRequests(nextRequests); save("xoxo.internalRequests", nextRequests); }
    };
    void closePreviousDay();
  }, [isAuthenticated, user.id]);

  const startActivityRun = (item: {
    itemType: ActivityRun["itemType"];
    itemId: string;
    title: string;
    scheduledStart: string;
    scheduledEnd: string;
    slaMinutes: number;
    evidence?: string;
  }) => {
    const id = `${user.id}-${today}-${item.itemType}-${item.itemId}`;
    const existing = activityRuns.find((run) => run.id === id);
    if (existing?.startedAt) return;
    const startedAt = new Date().toISOString();
    const next = existing
      ? activityRuns.map((run) => (run.id === id ? { ...run, startedAt, status: "En curso" as SlaState } : run))
      : [
          ...activityRuns,
          {
            id,
            employeeId: user.id,
            date: today,
            itemType: item.itemType,
            itemId: item.itemId,
            title: item.title,
            scheduledStart: item.scheduledStart,
            scheduledEnd: item.scheduledEnd,
            slaMinutes: item.slaMinutes,
            evidence: item.evidence,
            startedAt,
            status: "En curso" as SlaState,
          },
        ];
    persistActivityRuns(next);
  };

  const completeActivityRun = (id: string) => {
    const run = activityRuns.find((entry) => entry.id === id);
    if (!run) return;
    if (run.evidence === "photo" && (!run.beforeEvidenceCapture || !run.afterEvidenceCapture)) return;
    if (run.evidence && run.evidence !== "none" && run.evidence !== "photo" && !run.evidenceCapture) return;
    const completedAt = new Date().toISOString();
    const next = activityRuns.map((entry) =>
      entry.id === id ? { ...entry, completedAt, status: slaStatus({ ...entry, completedAt }) } : entry,
    );
    persistActivityRuns(next);
  };

  const setActivityEvidence = (id: string, evidence: EvidenceCapture | undefined) => {
    const next = activityRuns.map((run) => (run.id === id ? { ...run, evidenceCapture: evidence } : run));
    persistActivityRuns(next);
  };

  const setActivityPhoto = (id: string, phase: "before" | "after", evidence: EvidenceCapture | undefined) => {
    const next = activityRuns.map((run) => run.id === id ? { ...run, [phase === "before" ? "beforeEvidenceCapture" : "afterEvidenceCapture"]: evidence } : run);
    persistActivityRuns(next);
  };

  const startDailyTask = (task: DailyTask) => {
    if (task.startedAt) return;
    persistDailyTasks(
      dailyTasks.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              startedAt: new Date().toISOString(),
              status: "En proceso",
              slaMinutes: entry.slaMinutes ?? Math.max(15, timeToMinutes(entry.end) - timeToMinutes(entry.start)),
            }
          : entry,
      ),
    );
  };

  useEffect(() => {
    const tick = () => {
      const runsToEscalate = activityRuns.filter(
        (run) => !run.completedAt && !run.escalated && slaStatus(run) === "Vencida",
      );
      const tasksToEscalate = dailyTasks.filter(
        (task) =>
          task.startedAt &&
          task.slaMinutes &&
          !task.escalated &&
          !["Completada", "Pausada"].includes(task.status) &&
          slaStatus({ startedAt: task.startedAt, completedAt: undefined, slaMinutes: task.slaMinutes }) === "Vencida",
      );
      if (runsToEscalate.length) {
        persistActivityRuns(
          activityRuns.map((run) => (runsToEscalate.some((item) => item.id === run.id) ? { ...run, escalated: true, status: "Vencida" } : run)),
        );
        runsToEscalate.forEach((run) => {
          const employee = collaborators.find((person) => person.id === run.employeeId);
          const supervisor = employee ? currentSupervisor(employee, collaborators) : undefined;
          escalate(
            `SLA vencido: ${run.title}`,
            `${employee?.name ?? run.employeeId} no ha completado "${run.title}" dentro del tiempo permitido (${run.slaMinutes} min). Inicio: ${new Date(run.startedAt!).toLocaleTimeString("es-MX")}.`,
            supervisor?.id,
          );
        });
      }
      if (tasksToEscalate.length) {
        persistDailyTasks(
          dailyTasks.map((task) => (tasksToEscalate.some((item) => item.id === task.id) ? { ...task, escalated: true } : task)),
        );
        tasksToEscalate.forEach((task) => {
          const employee = collaborators.find((person) => person.id === task.employeeId);
          escalate(
            `SLA vencido: ${task.title}`,
            `${employee?.name ?? task.employeeId} no ha completado la tarea "${task.title}" dentro del tiempo asignado (${task.slaMinutes} min).`,
            task.assignedById,
          );
        });
      }
    };
    const interval = setInterval(tick, 20000);
    tick();
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityRuns, dailyTasks, collaborators]);

  if (authLoading) {
    return <main className="loginPage"><div className="loginCard">Verificando sesion segura...</div></main>;
  }

  if (!isAuthenticated) {
    return (
      <LoginView
        loginId={loginId}
        setLoginId={setLoginId}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        loginError={loginError}
        submitLogin={submitLogin}
      />
    );
  }

  if (mustChangePassword) {
    return <PasswordChangeView onComplete={async (password) => { await changeOwnPassword(password); setMustChangePassword(false); }} />;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brandLogo" src="/logo-xoxo-ferreton.png" alt="Xoxo Ferretón" />
          <div>
            <strong>XOXO Ferreton</strong>
            <small>Control operativo</small>
          </div>
        </div>

        <div className="sessionBox">
          <small>Sesion activa</small>
          <strong>{user.id}</strong>
          <span>{user.name}</span>
          <em>{isCloudReady ? "Datos en Supabase" : "Datos locales"}</em>
        </div>

        <nav>
          <button className={view === "panel" ? "active" : ""} onClick={() => navigate("panel")}>
            <BarChart3 size={18} /> Panel
          </button>
          {canAccessView(user, "tableroFinanciero") && <button className={view === "tableroFinanciero" ? "active" : ""} onClick={() => navigate("tableroFinanciero")}>
            <WalletCards size={18} /> Tablero financiero
          </button>}
          {canAccessView(user, "kpis") && <button className={view === "kpis" ? "active" : ""} onClick={() => navigate("kpis")}>
            <BarChart3 size={18} /> KPIs
          </button>}
          <button className={view === "asistencia" ? "active" : ""} onClick={() => navigate("asistencia")}>
            <Clock size={18} /> Registro diario
          </button>
          {canAccessView(user, "equipo") && <button className={view === "equipo" ? "active" : ""} onClick={() => navigate("equipo")}>
            <UserRound size={18} /> Colaboradores
          </button>}
          {canAccessView(user, "organigrama") && <button className={view === "organigrama" ? "active" : ""} onClick={() => navigate("organigrama")}>
            <Network size={18} /> Organigrama
          </button>}
          {canAccessView(user, "procesos") && <button className={view === "procesos" ? "active" : ""} onClick={() => navigate("procesos")}>
            <FileCheck2 size={18} /> Procesos
          </button>}
          {canAccessView(user, "auditorias") && <button className={view === "auditorias" ? "active" : ""} onClick={() => navigate("auditorias")}>
            <ShieldCheck size={18} /> Auditorías
          </button>}
          {canAccessView(user, "expansion") && <button className={view === "expansion" ? "active" : ""} onClick={() => navigate("expansion")}>
            <Building2 size={18} /> Expansión
          </button>}
          {canAccessView(user, "evaluacion") && <button className={view === "evaluacion" ? "active" : ""} onClick={() => navigate("evaluacion")}>
            <CalendarCheck size={18} /> Evaluacion
          </button>}
          {canAccessView(user, "caja") && <button className={view === "caja" ? "active" : ""} onClick={() => navigate("caja")}>
            <WalletCards size={18} /> Caja
          </button>}
          {canAccessView(user, "finanzas") && <button className={view === "finanzas" ? "active" : ""} onClick={() => navigate("finanzas")}>
            <BriefcaseBusiness size={18} /> Finanzas
          </button>}
          {canAccessView(user, "bancos") && <button className={view === "bancos" ? "active" : ""} onClick={() => {
            setView("bancos");
            window.setTimeout(() => document.getElementById("bancos")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
          }}>
            <Building2 size={18} /> Bancos
          </button>}
          {canAccessView(user, "garantias") && <button className={view === "garantias" ? "active" : ""} onClick={() => navigate("garantias")}>
            <ShieldCheck size={18} /> Garantias
          </button>}
          {canAccessView(user, "evidencias") && <button className={view === "evidencias" ? "active" : ""} onClick={() => navigate("evidencias")}>
            <Camera size={18} /> Evidencias
          </button>}
          <button className={view === "tareas" ? "active" : ""} onClick={() => navigate("tareas")}>
            <ClipboardList size={18} /> Tareas
          </button>
          <button className={view === "solicitudes" ? "active" : ""} onClick={() => navigate("solicitudes")}>
            <MessageSquare size={18} /> Solicitudes
          </button>
          {canAccessView(user, "reportes") && <button className={view === "reportes" ? "active" : ""} onClick={() => navigate("reportes")}>
            <FileText size={18} /> Reportes
          </button>}
          <button className={view === "instructivo" ? "active" : ""} onClick={() => navigate("instructivo")}>
            <BookOpen size={18} /> Instructivo
          </button>
          {canGovern(user) && (
            <button className={view === "configuracion" ? "active" : ""} onClick={() => setView("configuracion")}>
              <Settings2 size={18} /> Configuracion
            </button>
          )}
        </nav>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <div className="systemClock"><Clock size={18}/><span><strong>{new Intl.DateTimeFormat("es-MX",{timeZone:"America/Mexico_City",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true}).format(clockNow)}</strong><small>{new Intl.DateTimeFormat("es-MX",{timeZone:"America/Mexico_City",weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(clockNow)} · Oaxaca de Juárez</small></span></div>
            <h1>{titleFor(view)}</h1>
          </div>
          <div className="userPill">
            <span>{user.name}</span>
            <small>
              {user.roleLabel} · {user.branch}
            </small>
            <button className="iconButton" title="Cerrar sesion" onClick={logout}>
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {view === "panel" && (
          <Dashboard
            user={user}
            attendance={attendance}
            evaluations={evaluations}
            cashIncidents={cashIncidents}
            warranties={warranties}
            shiftConfigs={shiftConfigs}
            cleaningRole={cleaningRole}
            collaborators={collaborators}
            dailyTasks={dailyTasks}
            activityRuns={activityRuns}
            shiftMap={shiftMap}
            activitySchedules={activitySchedules}
            workLocations={workLocations}
            onNavigate={navigate}
            slaReviews={slaReviews}
            reviewSla={reviewSla}
            cashSessions={cashSessions}
            cashCuts={cashCuts}
            storeOpeningChecks={storeOpeningChecks}
            updateStoreOpening={updateStoreOpening}
            addQuickTask={addQuickTask}
            removeTaskWithDecision={removeTaskWithDecision}
          />
        )}
        {view === "asistencia" && (
          <AttendanceView
            user={user}
            attendance={attendance}
            dailyClosures={dailyClosures}
            collaborators={collaborators}
            myAttendance={myAttendance}
            updateAttendance={updateAttendance}
            registerAttendanceFor={registerAttendanceFor}
            myEval={myEval}
            shift={shiftMap[user.shift]}
            activitySchedules={activitySchedules}
            workLocation={workLocations.find((item) => item.employeeId === user.id && item.date === today)?.location ?? user.branch}
            cleaningAssignment={currentCleaningAssignment}
            cleaningRow={currentCleaningRow}
            dailyTasks={userTasks}
            allDailyTasks={dailyTasks}
            setDailyTasks={persistDailyTasks}
            startDailyTask={startDailyTask}
            activityRuns={activityRuns}
            startActivityRun={startActivityRun}
            completeActivityRun={completeActivityRun}
            setActivityEvidence={setActivityEvidence}
            setActivityPhoto={setActivityPhoto}
          />
        )}
        {view === "equipo" && (
          <TeamView
            user={user}
            visibleEmployees={visibleEmployees}
            collaborators={collaborators}
            setCollaborators={persistCollaborators}
          />
        )}
        {view === "organigrama" && <OrgView collaborators={collaborators} />}
        {view === "auditorias" && <AuditDashboard user={user} collaborators={collaborators} audits={processAudits} startAudit={startProcessAudit} updateAudit={updateProcessAudit} />}
        {view === "expansion" && <ExpansionDashboard user={user} collaborators={collaborators} openings={branchOpenings} startOpening={startBranchOpening} updateOpening={updateBranchOpening} />}
        {view === "procesos" && (
          <ProcessesView
            user={user}
            collaborators={collaborators}
            processInstances={processInstances}
            setProcessInstances={persistProcessInstances}
            notify={escalate}
          />
        )}
        {view === "evaluacion" && (
          <EvaluationView
            user={user}
            targetEvalId={targetEvalId}
            setTargetEvalId={setTargetEvalId}
            scores={scores}
            setScores={setScores}
            note={note}
            setNote={setNote}
            personalSales={personalSales}
            setPersonalSales={setPersonalSales}
            salesGoal={salesGoal}
            setSalesGoal={setSalesGoal}
            submitEvaluation={submitEvaluation}
            evaluations={evaluations}
            collaborators={collaborators}
            activityRuns={activityRuns}
            dailyTasks={dailyTasks}
            shiftMap={shiftMap}
            cashIncidents={cashIncidents}
            slaReviews={slaReviews}
          />
        )}
        {view === "caja" && (
          <CashView
            user={user}
            addCashIncident={addCashIncident}
            cashIncidents={cashIncidents}
            cashSessions={cashSessions}
            addCashOpening={addCashOpening}
            addCashCut={addCashCut}
            cashCuts={cashCuts}
            reviewCashCut={reviewCashCut}
            reviewCashIncident={reviewCashIncident}
            collaborators={collaborators}
          />
        )}
        {view === "tableroFinanciero" && (
          <FinancialDashboard
            user={user}
            suppliers={suppliers}
            payables={payables}
            bankAccounts={bankAccounts}
            bankTransactions={bankTransactions}
            monthlyBudgets={monthlyBudgets}
            addMonthlyBudget={addMonthlyBudget}
          />
        )}
        {view === "kpis" && <KpiDashboard user={user} collaborators={collaborators} records={kpiRecords} saveRecord={saveKpiRecord} />}
        {(view === "finanzas" || view === "bancos") && (
          <FinanceView
            user={user} suppliers={suppliers} payables={payables}
            addSupplier={addSupplier} addPayable={addPayable} requestPayablePayment={requestPayablePayment}
            bankAccounts={bankAccounts} bankTransactions={bankTransactions}
            addBankAccount={addBankAccount} addBankTransaction={addBankTransaction}
            importBankTransactions={importBankTransactions}
            toggleBankReconciliation={toggleBankReconciliation}
          />
        )}
        {view === "garantias" && <WarrantyView user={user} collaborators={collaborators} addWarranty={addWarranty} updateWarranty={updateWarranty} warranties={warranties} />}
        {view === "evidencias" && <EvidenceGalleryView user={user} today={today} collaborators={collaborators} dailyTasks={dailyTasks} activityRuns={activityRuns} />}
        {view === "tareas" && (
          <TasksView
            user={user}
            collaborators={collaborators}
            dailyTasks={dailyTasks}
            setDailyTasks={persistDailyTasks}
            workLocations={workLocations}
            assignWorkLocation={assignWorkLocation}
          />
        )}
        {view === "solicitudes" && (
          <RequestsView
            user={user}
            collaborators={collaborators}
            internalRequests={internalRequests}
            addInternalRequest={addInternalRequest}
            setInternalRequests={updateInternalRequests}
          />
        )}
        {view === "configuracion" && canGovern(user) && (
          <GovernanceView
            user={user}
            shiftConfigs={shiftConfigs}
            setShiftConfigs={setShiftConfigs}
            activitySchedules={activitySchedules}
            setActivitySchedules={setActivitySchedules}
            cleaningRole={cleaningRole}
            setCleaningRole={setCleaningRole}
          />
        )}
        {view === "reportes" && (
          <ReportsView
            user={user}
            collaborators={collaborators}
            attendance={attendance}
            evaluations={evaluations}
            cashIncidents={cashIncidents}
            cashCuts={cashCuts}
            warranties={warranties}
            dailyTasks={dailyTasks}
            processInstances={processInstances}
            internalRequests={internalRequests}
            activityRuns={activityRuns}
            suppliers={suppliers}
            payables={payables}
            bankAccounts={bankAccounts}
            bankTransactions={bankTransactions}
            monthlyBudgets={monthlyBudgets}
          />
        )}
        {view === "instructivo" && <GuideView />}
      </main>
    </div>
  );
}

function titleFor(view: string) {
  return (
    {
      panel: "Panel de control",
      tableroFinanciero: "Tablero financiero gerencial",
      kpis: "Indicadores por puesto y sucursal",
      asistencia: "Registro diario",
      equipo: "Colaboradores y directorio",
      organigrama: "Organigrama",
      procesos: "Procesos y protocolos",
      auditorias: "Auditoría de procesos",
      expansion: "Apertura y expansión de sucursales",
      evaluacion: "Evaluacion diaria",
      caja: "Caja e incidencias",
      finanzas: "Proveedores y cuentas por pagar",
      garantias: "Garantias a proveedores",
      evidencias: "Evidencia fotográfica del día",
      tareas: "Tareas asignadas",
      solicitudes: "Solicitudes y reportes internos",
      reportes: "Reportes imprimibles",
      instructivo: "Instructivo de uso",
      configuracion: "Configuracion directiva",
    }[view] ?? "Panel"
  );
}

function LoginView({
  loginId,
  setLoginId,
  loginPassword,
  setLoginPassword,
  loginError,
  submitLogin,
}: {
  loginId: string;
  setLoginId: (value: string) => void;
  loginPassword: string;
  setLoginPassword: (value: string) => void;
  loginError: string;
  submitLogin: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="loginPage">
      <form className="loginCard" onSubmit={submitLogin}>
        <div className="brand loginBrand">
          <img className="brandLogo" src="/logo-xoxo-ferreton.png" alt="Xoxo Ferretón" />
          <div>
            <strong>XOXO Ferreton</strong>
            <small>Acceso al sistema</small>
          </div>
        </div>
        <label>
          Numero de colaborador
          <input
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            inputMode="numeric"
            autoComplete="username"
            required
          />
        </label>
        <label>
          Contrasena
          <input
            type="password"
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {loginError && <p className="loginError">{loginError}</p>}
        <button className="primary">Entrar</button>
      </form>
    </main>
  );
}

function getEditableCleaningAssignment(employee: Employee, cleaningRole: CleaningRole[], branch: string = employee.branch) {
  const assignment = getEditableCleaningRow(employee, cleaningRole, branch);
  if (!assignment) return "Sin aseo asignado en el rol editable";
  return `${assignment.activity} (${assignment.start} - ${assignment.end})`;
}

function getEditableCleaningRow(employee: Employee, cleaningRole: CleaningRole[], branch: string = employee.branch) {
  const dayName = weekDays[(new Date().getDay() + 6) % 7];
  return cleaningRole.find((row) => row.branch === branch &&
    row.assignments[dayName]
      .toLowerCase()
      .split("/")
      .map((name) => name.trim())
      .includes(employee.name.toLowerCase()),
  );
}

function supervisorFor(employee: Employee, collaborators: Employee[]) {
  return currentSupervisor(employee, collaborators);
}

function profileFor(role: Role) {
  return roleProfiles.find((profile) => profile.role === role);
}

function Dashboard({
  user,
  attendance,
  evaluations,
  cashIncidents,
  warranties,
  shiftConfigs,
  cleaningRole,
  collaborators,
  dailyTasks,
  activityRuns,
  shiftMap,
  activitySchedules,
  workLocations,
  onNavigate,
  slaReviews,
  reviewSla,
  cashSessions,
  cashCuts,
  storeOpeningChecks,
  updateStoreOpening,
  addQuickTask,
  removeTaskWithDecision,
}: {
  user: Employee;
  attendance: Attendance[];
  evaluations: Evaluation[];
  cashIncidents: CashIncident[];
  warranties: Warranty[];
  shiftConfigs: ShiftConfig[];
  cleaningRole: CleaningRole[];
  collaborators: Employee[];
  dailyTasks: DailyTask[];
  activityRuns: ActivityRun[];
  shiftMap: Record<string, ShiftConfig>;
  activitySchedules: ActivitySchedule[];
  workLocations: WorkLocation[];
  onNavigate: (view: string) => void;
  slaReviews: SlaReview[];
  reviewSla: (sourceType: SlaReview["sourceType"], sourceId: string, employeeId: string, decision: SlaReview["decision"], note: string) => void;
  cashSessions: CashSession[];
  cashCuts: CashCut[];
  storeOpeningChecks: StoreOpeningCheck[];
  updateStoreOpening: (branch: StoreOpeningCheck["branch"], patch: Partial<StoreOpeningCheck>) => void;
  addQuickTask: (employeeId: string, title: string, notes: string, affectsEvaluation: boolean) => void;
  removeTaskWithDecision: (task: DailyTask, decision: "Sin efecto" | "Penalizar", note: string) => void;
}) {
  const [, setTick] = useState(0);
  const [showSlaReview, setShowSlaReview] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 15000);
    return () => clearInterval(interval);
  }, []);
  const today = todayKey();
  const todaysAttendance = attendance.filter((entry) => entry.date === today);
  const todaysEvaluations = evaluations.filter((entry) => entry.date === today);
  const average =
    todaysEvaluations.length === 0
      ? 0
      : todaysEvaluations.reduce((sum, entry) => sum + entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length, 0) /
        todaysEvaluations.length;
  const visibleForMonitor = collaborators.filter(
    (employee) =>
      canViewAll(user) ||
      employee.supervisorId === user.id ||
      dailyTasks.some((task) => task.employeeId === employee.id && task.assignedById === user.id),
  );
  const liveStatuses = visibleForMonitor.map((employee) => ({ employee, live: liveStatusFor(employee, activityRuns, dailyTasks, shiftMap, today) }));
  const idleNow = liveStatuses.filter((entry) => entry.live.state === "idle").length;
  const reviewedSourceIds = new Set(slaReviews.filter((item) => item.date === today).map((item) => `${item.sourceType}-${item.sourceId}`));
  const breachedTasks = dailyTasks.filter((task) => task.date === today && task.startedAt && !task.completedAt && task.slaMinutes && slaStatus({ startedAt: task.startedAt, slaMinutes: task.slaMinutes }) === "Vencida" && !reviewedSourceIds.has(`Tarea-${task.id}`));
  const breachedRuns = activityRuns.filter((run) => run.date === today && run.startedAt && !run.completedAt && slaStatus(run) === "Vencida" && !reviewedSourceIds.has(`Actividad-${run.id}`));
  const breachedNow = breachedTasks.length + breachedRuns.length;
  const locationFor = (employee: Employee) => workLocations.find((item) => item.employeeId === employee.id && item.date === today)?.location ?? employee.branch;
  const ownSequence = workSequenceFor(user, today, locationFor(user), activitySchedules, dailyTasks);
  const openingBoard = <StoreOpeningBoard user={user} today={today} cashSessions={cashSessions} cashCuts={cashCuts} checks={storeOpeningChecks} attendance={attendance} collaborators={collaborators} onUpdate={updateStoreOpening} onOpenCash={()=>onNavigate("caja")}/>;
  if (user.role === "AUXILIAR") {
    const myTasks = dailyTasks.filter((task) => task.employeeId === user.id && task.date === today);
    const myAttendance = todaysAttendance.find((entry) => entry.employeeId === user.id);
    const myEvaluation = todaysEvaluations.find((entry) => entry.employeeId === user.id);
    const myAverage = myEvaluation ? myEvaluation.scores.reduce((sum, score) => sum + score, 0) / myEvaluation.scores.length : 0;
    const myCleaning = getEditableCleaningAssignment(user, cleaningRole, locationFor(user));
    const myShift = shiftConfigs.find((shift) => shift.key === user.shift);
    // Un auxiliar no veía cuántos compañeros de su misma sucursal ya estaban trabajando hoy;
    // esta cuenta no depende de permisos especiales, sólo de asistencia y colaboradores, que
    // ya llegan a todos los roles.
    const branchToday = locationFor(user);
    const coworkersToday = collaborators.filter((employee) => employee.id !== user.id && locationFor(employee) === branchToday);
    const coworkersPresent = coworkersToday.filter((employee) => todaysAttendance.some((entry) => entry.employeeId === employee.id && entry.in)).length;
    return <section className="grid">
      {openingBoard}
      <article className="wide panelCard workLocationHero"><img src="/logo-xoxo-ferreton.png" alt="Xoxo Ferretón" /><MapPin /><div><small>HOY DEBES PRESENTARTE Y LABORAR EN</small><strong>{locationFor(user)}</strong><span>{locationFor(user)==="Sucursal Centro"?"Itinerario obligatorio: llegada a Matriz 8:00, salida 8:15 en vehículo de la empresa, llegada a Centro 8:45 y apertura 8:55.":"Tu agenda y procesos de este panel corresponden a Matriz."}</span></div></article>
      <button className="metric metricButton" onClick={() => onNavigate("tareas")}><span><ClipboardList /></span><div><strong>{myTasks.length}</strong><small>Mis tareas de hoy</small></div></button>
      <Metric label="Tareas completadas" value={String(myTasks.filter((task) => task.status === "Completada").length)} icon={<CheckCircle2 />} />
      <Metric label="Entrada de hoy" value={myAttendance?.in ?? "Pendiente"} icon={<Clock />} />
      <Metric label="Mi evaluación" value={myAverage ? myAverage.toFixed(1) : "Pendiente"} icon={<BarChart3 />} />
      <Metric label="Compañeros trabajando hoy" value={`${coworkersPresent}/${coworkersToday.length}`} icon={<UserRound />} />
      <article className="wide panelCard"><div className="sectionHead"><div><h2>Mi jornada</h2><span>Sólo información necesaria para ejecutar y reportar</span></div></div>
        <p><strong>Turno:</strong> {myShift ? `${myShift.start}-${myShift.end}` : user.shift}</p>
        <p><strong>Aseo:</strong> {myCleaning}</p>
        <p><strong>Lugar de trabajo hoy:</strong> {locationFor(user)}</p><p><strong>Jefe inmediato:</strong> {supervisorFor(user, collaborators)?.name ?? "Gerencia"}</p>
      </article>
      <SequenceCard sequence={ownSequence} location={locationFor(user)} />
      <DailyContinuityCard sequence={ownSequence} />
      <article className="wide panelCard"><h2>Mis tareas asignadas</h2><div className="taskList">{myTasks.map((task)=><div className="taskRow" key={task.id}><span>{task.start}-{task.end}<small>{task.notes}</small></span><strong>{task.title} · {task.status}</strong></div>)}{myTasks.length===0&&<p className="muted">No tienes tareas especiales asignadas hoy. Continúa con tu rutina programada.</p>}</div></article>
      <article className="wide panelCard"><h2>Regla de trabajo</h2><p>Atiende primero al cliente, ejecuta una actividad a la vez y reporta avances, evidencia o impedimentos en Registro diario o Tareas.</p></article>
    </section>;
  }
  return (
    <section className="grid">
      {openingBoard}
      <Metric label="Colaboradores activos" value={collaborators.length.toString()} icon={<UserRound />} />
      <Metric label="Entradas registradas hoy" value={todaysAttendance.length.toString()} icon={<Clock />} />
      <Metric label="Evaluacion promedio" value={average ? average.toFixed(1) : "0.0"} icon={<BarChart3 />} />
      <Metric label="Garantias abiertas" value={warranties.filter((item) => !["Resuelta", "Rechazada"].includes(item.status)).length.toString()} icon={<ShieldCheck />} />
      <button className="metric metricButton" onClick={() => onNavigate("tareas")}><span><Clock /></span><div><strong>{idleNow}</strong><small>En tiempo libre ahora</small></div></button>
      <button className="metric metricButton" onClick={() => setShowSlaReview((value)=>!value)}><span><AlertTriangle /></span><div><strong>{breachedNow}</strong><small>SLA vencidos ahora · ver detalle</small></div></button>

      {showSlaReview && <SlaReviewPanel user={user} collaborators={collaborators} tasks={breachedTasks} runs={breachedRuns} reviews={slaReviews.filter((item)=>item.date===today)} onReview={reviewSla} />}

      <article className="wide panelCard">
        <div className="sectionHead">
          <h2>Resumen operativo</h2>
          <span>Usuario activo: {user.name}</span>
        </div>
        <div className="summaryRows">
          <p>
            <strong>Correo de contacto:</strong> xoxoferreton1@gmail.com
          </p>
          <p>
            <strong>WhatsApp:</strong> 9511251386
          </p>
          <p>
            <strong>Regla de jerarquia:</strong> un colaborador solo puede asignar tareas a niveles inferiores.
          </p>
          <p>
            <strong>Alertas pendientes:</strong> {cashIncidents.length} incidencias de caja, {warranties.length} garantias registradas.
          </p>
        </div>
      </article>

      <article className="wide panelCard">
        <div className="sectionHead">
          <h2>Mi puesto</h2>
          <span>{profileFor(user.role)?.reportTo}</span>
        </div>
        <p>{profileFor(user.role)?.objective}</p>
        <div className="pillList">
          {(profileFor(user.role)?.baseActivities ?? []).slice(0, 6).map((activity) => (
            <span key={activity}>{activity}</span>
          ))}
        </div>
      </article>

      <SequenceCard sequence={ownSequence} location={locationFor(user)} />

      {(canViewAll(user) || dailyTasks.some((task) => task.assignedById === user.id)) && (
        <article className="wide panelCard">
          <div className="sectionHead">
            <div>
              <h2>Monitor en vivo</h2>
              <span>Que esta haciendo cada colaborador ahora mismo, con SLA en tiempo real y tiempos libres</span>
            </div>
          </div>
          <div className="operationTable liveMonitorTable">
            <div className="operationRow head">
              <span>Colaborador</span>
              <span>Entrada</span>
              <span>Actividad en vivo</span>
              <span>Estado SLA</span>
              <span>Seguimiento</span>
            </div>
            {liveStatuses.map(({ employee, live }) => {
              const dayAttendance = attendance.find((entry) => entry.employeeId === employee.id && entry.date === today);
              const activeTask =
                dailyTasks.find(
                  (task) =>
                    task.employeeId === employee.id &&
                    task.date === today &&
                    ["En proceso", "Incidencia", "Pausada"].includes(task.status),
                ) ?? dailyTasks.find((task) => task.employeeId === employee.id && task.date === today);
              const sequence = workSequenceFor(employee, today, locationFor(employee), activitySchedules, dailyTasks);
              return (
                <div className="operationRow" key={employee.id}>
                  <strong>{employee.name}</strong>
                  <span>{dayAttendance?.in ?? "Sin entrada"}</span>
                  <span>{live.label}</span>
                  <span>
                    <span className={`statusPill ${live.className}`}>{live.sub}</span>
                    {activeTask?.approvalStatus === "Pendiente" ? <small className="danger">Requiere aprobacion</small> : null}
                  </span>
                  <span><small>Anterior: {sequence.previous?.title ?? "--"}</small><strong>Ahora: {sequence.current?.title ?? live.label}</strong><small>Siguiente: {sequence.next?.title ?? "--"} · {locationFor(employee)}</small>{(canViewAll(user) || employee.supervisorId === user.id) && <button className="ghost compact" onClick={() => onNavigate("tareas")}>Cambiar o quitar actividad</button>}</span>
                </div>
              );
            })}
          </div>
        </article>
      )}

      {canGovern(user) && (
        <TeamActivityBoard
          user={user}
          today={today}
          employees={visibleForMonitor}
          collaborators={collaborators}
          dailyTasks={dailyTasks}
          activityRuns={activityRuns}
          shiftMap={shiftMap}
          attendance={attendance}
          addQuickTask={addQuickTask}
          removeTaskWithDecision={removeTaskWithDecision}
        />
      )}

      <article className="panelCard">
        <h2>Tareas asignadas hoy</h2>
        <div className="taskList">
          {dailyTasks
            .filter((task) => task.date === todayKey())
            .slice(0, 6)
            .map((task) => (
              <div className="taskRow" key={task.id}>
                <span>{collaborators.find((person) => person.id === task.employeeId)?.name}</span>
                <strong>{task.title}</strong>
              </div>
            ))}
        </div>
      </article>

      <article className="panelCard">
        <h2>Aseo de hoy</h2>
        <div className="taskList">
          {cleaningRole.slice(0, 6).map((row) => {
            const dayName = weekDays[(new Date().getDay() + 6) % 7];
            return (
              <div key={row.activity} className="taskRow">
                <span>{row.activity}</span>
                <strong>
                  {row.assignments[dayName] || "Sin asignar"} · {row.start}-{row.end}
                </strong>
              </div>
            );
          })}
        </div>
      </article>

      <article className="panelCard">
        <h2>Turnos</h2>
        {shiftConfigs.map((shift) => (
          <div className="taskRow" key={shift.key}>
            <span>{shift.name}</span>
            <strong>
              {shift.start}-{shift.end}
            </strong>
          </div>
        ))}
      </article>
    </section>
  );
}

function TeamActivityBoard({
  user,
  today,
  employees,
  collaborators,
  dailyTasks,
  activityRuns,
  shiftMap,
  attendance,
  addQuickTask,
  removeTaskWithDecision,
}: {
  user: Employee;
  today: string;
  employees: Employee[];
  collaborators: Employee[];
  dailyTasks: DailyTask[];
  activityRuns: ActivityRun[];
  shiftMap: Record<string, ShiftConfig>;
  attendance: Attendance[];
  addQuickTask: (employeeId: string, title: string, notes: string, affectsEvaluation: boolean) => void;
  removeTaskWithDecision: (task: DailyTask, decision: "Sin efecto" | "Penalizar", note: string) => void;
}) {
  return (
    <article className="wide panelCard teamActivityBoard">
      <div className="sectionHead">
        <div>
          <h2>Actividades del equipo</h2>
          <span>Actividad en vivo, pendientes, terminadas hoy y quién asignó cada una. Puedes asignar o quitar actividades, con o sin efecto en la evaluación.</span>
        </div>
        <strong>{employees.length} colaboradores</strong>
      </div>
      <div className="stack">
        {employees.map((employee) => (
          <TeamActivityRow
            key={employee.id}
            employee={employee}
            collaborators={collaborators}
            employeeTasks={dailyTasks.filter((task) => task.employeeId === employee.id && task.date === today)}
            live={liveStatusFor(employee, activityRuns, dailyTasks, shiftMap, today)}
            todaysAttendance={attendance.find((entry) => entry.employeeId === employee.id && entry.date === today)}
            addQuickTask={addQuickTask}
            removeTaskWithDecision={removeTaskWithDecision}
          />
        ))}
        {employees.length === 0 && <p className="muted">No hay colaboradores visibles para tu usuario.</p>}
      </div>
    </article>
  );
}

function TeamActivityRow({
  employee,
  collaborators,
  employeeTasks,
  live,
  todaysAttendance,
  addQuickTask,
  removeTaskWithDecision,
}: {
  employee: Employee;
  collaborators: Employee[];
  employeeTasks: DailyTask[];
  live: ReturnType<typeof liveStatusFor>;
  todaysAttendance?: Attendance;
  addQuickTask: (employeeId: string, title: string, notes: string, affectsEvaluation: boolean) => void;
  removeTaskWithDecision: (task: DailyTask, decision: "Sin efecto" | "Penalizar", note: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [affectsEvaluation, setAffectsEvaluation] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeNote, setRemoveNote] = useState("");

  const pending = employeeTasks.filter((task) => ["Pendiente", "En proceso", "Pausada", "Incidencia"].includes(task.status));
  const completed = employeeTasks.filter((task) => task.status === "Completada");

  const submitAdd = () => {
    if (title.trim().length < 3) return;
    addQuickTask(employee.id, title.trim(), notes.trim(), affectsEvaluation);
    setTitle(""); setNotes(""); setAffectsEvaluation(true); setShowAdd(false);
  };

  const startRemoving = (id: string) => { setRemovingId(id); setRemoveNote(""); };
  const cancelRemoving = () => { setRemovingId(null); setRemoveNote(""); };
  const confirmRemove = (task: DailyTask, decision: "Sin efecto" | "Penalizar") => {
    removeTaskWithDecision(task, decision, removeNote);
    cancelRemoving();
  };

  return (
    <div className="teamActivityRow">
      <div className="sectionHead">
        <div>
          <strong>{employee.name}</strong>
          <small>{employee.roleLabel} · {employee.branch} · entrada {todaysAttendance?.in ?? "sin registrar"}</small>
        </div>
        <span className={`statusPill ${live.className}`}>{live.label}</span>
      </div>
      <div className="teamActivityLists">
        <div>
          <small>Pendientes ({pending.length})</small>
          {pending.map((task) => (
            <div className="teamActivityTask" key={task.id}>
              <span>
                {task.title}
                <small> {task.status} · asignó {collaborators.find((person) => person.id === task.assignedById)?.name ?? task.assignedById}{task.affectsEvaluation === false ? " · no afecta evaluación" : ""}</small>
              </span>
              {removingId === task.id ? (
                <div className="teamActivityRemove">
                  <input value={removeNote} onChange={(event) => setRemoveNote(event.target.value)} placeholder="Motivo (mínimo 10 caracteres)" />
                  <button className="ghost compact" disabled={removeNote.trim().length < 10} onClick={() => confirmRemove(task, "Sin efecto")}>Quitar sin afectar</button>
                  <button className="ghost danger compact" disabled={removeNote.trim().length < 10} onClick={() => confirmRemove(task, "Penalizar")}>Quitar y penalizar -1</button>
                  <button className="ghost compact" onClick={cancelRemoving}>Cancelar</button>
                </div>
              ) : (
                <button className="ghost compact" onClick={() => startRemoving(task.id)}>Quitar</button>
              )}
            </div>
          ))}
          {pending.length === 0 && <p className="muted">Sin pendientes hoy.</p>}
        </div>
        <div>
          <small>Completadas hoy ({completed.length})</small>
          {completed.map((task) => (
            <div className="teamActivityTask" key={task.id}>
              <span>{task.title} <small>asignó {collaborators.find((person) => person.id === task.assignedById)?.name ?? task.assignedById}</small></span>
            </div>
          ))}
          {completed.length === 0 && <p className="muted">Aún ninguna.</p>}
        </div>
      </div>
      {showAdd ? (
        <div className="teamActivityAdd">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título de la actividad" />
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Instrucción breve (opcional)" />
          <label><input type="checkbox" checked={affectsEvaluation} onChange={(event) => setAffectsEvaluation(event.target.checked)} /> Afecta evaluación</label>
          <button className="primary compact" disabled={title.trim().length < 3} onClick={submitAdd}>Asignar</button>
          <button className="ghost compact" onClick={() => setShowAdd(false)}>Cancelar</button>
        </div>
      ) : (
        <button className="ghost compact" onClick={() => setShowAdd(true)}>+ Asignar actividad</button>
      )}
    </div>
  );
}

function AttendanceView({
  user,
  attendance,
  dailyClosures,
  collaborators,
  myAttendance,
  updateAttendance,
  registerAttendanceFor,
  myEval,
  shift,
  activitySchedules,
  cleaningAssignment,
  cleaningRow,
  dailyTasks,
  allDailyTasks,
  setDailyTasks,
  startDailyTask,
  activityRuns,
  startActivityRun,
  completeActivityRun,
  setActivityEvidence,
  workLocation,
  setActivityPhoto,
}: {
  user: Employee;
  attendance: Attendance[];
  dailyClosures: DailyClosure[];
  collaborators: Employee[];
  myAttendance?: Attendance;
  updateAttendance: (field: keyof Attendance) => void;
  registerAttendanceFor: (employeeId: string) => void;
  myEval?: Evaluation & { average: number; rate: number };
  shift?: ShiftConfig;
  activitySchedules: ActivitySchedule[];
  cleaningAssignment: string;
  cleaningRow?: CleaningRole;
  dailyTasks: DailyTask[];
  allDailyTasks: DailyTask[];
  setDailyTasks: (value: DailyTask[]) => void;
  startDailyTask: (task: DailyTask) => void;
  activityRuns: ActivityRun[];
  startActivityRun: (item: {
    itemType: ActivityRun["itemType"];
    itemId: string;
    title: string;
    scheduledStart: string;
    scheduledEnd: string;
    slaMinutes: number;
    evidence?: string;
  }) => void;
  completeActivityRun: (id: string) => void;
  setActivityEvidence: (id: string, evidence: EvidenceCapture | undefined) => void;
  setActivityPhoto: (id: string, phase: "before" | "after", evidence: EvidenceCapture | undefined) => void;
  workLocation: string;
}) {
  // Refresca cada 30s para que el bloqueo de las 8:45 se active sin necesidad de recargar.
  const [, setArrivalTick] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setArrivalTick((value) => value + 1), 30000);
    return () => window.clearInterval(interval);
  }, []);
  const canRegisterLateAttendance = LATE_ATTENDANCE_OVERRIDE_IDS.includes(user.id);
  const [lateEmployeeId, setLateEmployeeId] = useState("");
  const targetedActivities = activitySchedules.filter((activity) => activity.employeeIds?.includes(user.id) && (!activity.branch || activity.branch === workLocation));
  const userActivities = targetedActivities.length
    ? targetedActivities
    : activitySchedules.filter((activity) => activity.ownerRoles.includes(user.role) && (!activity.branch || activity.branch === workLocation));
  const today = todayKey();
  const runFor = (itemType: ActivityRun["itemType"], itemId: string) =>
    activityRuns.find((run) => run.id === `${user.id}-${today}-${itemType}-${itemId}`);
  const attendanceLog = attendance
    .flatMap((entry) => ([
      entry.in ? { employeeId: entry.employeeId, date: entry.date, time: entry.in, event: "Entrada" } : undefined,
      entry.lunchOut ? { employeeId: entry.employeeId, date: entry.date, time: entry.lunchOut, event: "Salida a comida" } : undefined,
      entry.lunchIn ? { employeeId: entry.employeeId, date: entry.date, time: entry.lunchIn, event: "Regreso de comida" } : undefined,
      entry.out ? { employeeId: entry.employeeId, date: entry.date, time: entry.out, event: "Salida" } : undefined,
    ]).filter(Boolean) as { employeeId: string; date: string; time: string; event: string }[])
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  const updateTask = (id: string, patch: Partial<DailyTask>) => {
    setDailyTasks(allDailyTasks.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  };
  const pauseTaskForIncident = (task: DailyTask, incidentNote: string) => {
    updateTask(task.id, {
      status: "Pausada",
      paused: true,
      approvalStatus: "Pendiente",
      incidentNote,
    });
  };
  const completeTask = (task: DailyTask) => {
    if (task.requiresPhoto && (!task.beforeEvidenceCapture || !task.afterEvidenceCapture)) return;
    updateTask(task.id, { status: "Completada", completedAt: new Date().toISOString() });
  };

  return (
    <section className="grid two">
      <article className="panelCard">
        <div className="sectionHead">
          <h2>Entrada del dia</h2>
          <span>
            {shift ? `${shift.start} - ${shift.end} / comida ${shift.lunchStart} - ${shift.lunchEnd}` : "Turno por asignar"}
          </span>
        </div>
        <p className="statusPill ok">Lugar de trabajo hoy: {workLocation}</p>
        <div className="cleaningHero">
          <Sparkles />
          <div>
            <small>Aseo asignado automaticamente</small>
            <strong>{cleaningAssignment}</strong>
          </div>
        </div>
        {cleaningRow &&
          (() => {
            const slaMinutes = Math.max(5, timeToMinutes(cleaningRow.end) - timeToMinutes(cleaningRow.start));
            return (
              <LiveActivityCard
                title={cleaningRow.activity}
                scheduledStart={cleaningRow.start}
                scheduledEnd={cleaningRow.end}
                slaMinutes={slaMinutes}
                evidence="photo"
                run={runFor("Aseo", cleaningRow.activity)}
                onStart={() =>
                  startActivityRun({
                    itemType: "Aseo",
                    itemId: cleaningRow.activity,
                    title: cleaningRow.activity,
                    scheduledStart: cleaningRow.start,
                    scheduledEnd: cleaningRow.end,
                    slaMinutes,
                    evidence: "photo",
                  })
                }
                onComplete={completeActivityRun}
                onCapturePhoto={(phase, evidence) => setActivityPhoto(runFor("Aseo", cleaningRow.activity)!.id, phase, evidence)}
                onClearPhoto={(phase) => setActivityPhoto(runFor("Aseo", cleaningRow.activity)!.id, phase, undefined)}
              />
            );
          })()}
        <div className="cleaningChecklist">
          <strong>Lista obligatoria para un buen aseo</strong>
          <ul className="guideList">
            <li>Retirar toda la mercancía del mostrador.</li>
            <li>Limpiar y desinfectar la superficie, esquinas y equipo.</li>
            <li>Acomodar únicamente el material autorizado en su lugar.</li>
            <li>Limpiar piso, exhibición y zona de atención.</li>
            <li>Confirmar que no quede mercancía sobre los mostradores.</li>
            <li>Subir foto de antes y foto de cómo quedó.</li>
          </ul>
        </div>
        {(() => {
          const nowMinutes = timeToMinutes(timeNow());
          const arrivalBlocked = !myAttendance?.in && nowMinutes >= ARRIVAL_BLOCK_AT;
          const punctuality = arrivalPunctuality(myAttendance?.in ? timeToMinutes(myAttendance.in) : nowMinutes);
          return (
            <>
              <div className="punchGrid">
                <button disabled={arrivalBlocked || Boolean(myAttendance?.in)} onClick={() => updateAttendance("in")}>
                  Entrada {myAttendance?.in && <span>{myAttendance.in}</span>}
                  {!myAttendance?.in && <small className={`statusPill ${punctuality.className}`}>{punctuality.label}</small>}
                </button>
                <button onClick={() => updateAttendance("lunchOut")}>Salida comida {myAttendance?.lunchOut && <span>{myAttendance.lunchOut}</span>}</button>
                <button onClick={() => updateAttendance("lunchIn")}>Entrada comida {myAttendance?.lunchIn && <span>{myAttendance.lunchIn}</span>}</button>
                <button onClick={() => updateAttendance("out")}>Salida {myAttendance?.out && <span>{myAttendance.out}</span>}</button>
              </div>
              {arrivalBlocked && (
                <p className="loginError">
                  Ya pasaron las 8:45 y no registraste tu entrada: hoy cuenta como día no laborable. Si tenías permiso o aviso previo, pide a un director que la registre por ti.
                </p>
              )}
            </>
          );
        })()}
        {canRegisterLateAttendance && (() => {
          const nowMinutes = timeToMinutes(timeNow());
          if (nowMinutes < ARRIVAL_BLOCK_AT) return null;
          const pendingEmployees = collaborators.filter((employee) => !attendance.some((entry) => entry.employeeId === employee.id && entry.date === today && entry.in));
          if (pendingEmployees.length === 0) return null;
          return (
            <div className="lateAttendancePanel">
              <strong>Registrar entrada tardía de un colaborador</strong>
              <small>Sólo para permisos, avisos o imprevistos ya autorizados fuera del sistema.</small>
              <div className="inlineTimes">
                <select value={lateEmployeeId} onChange={(event) => setLateEmployeeId(event.target.value)}>
                  <option value="">Selecciona colaborador</option>
                  {pendingEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                </select>
                <button className="ghost compact" disabled={!lateEmployeeId} onClick={() => { registerAttendanceFor(lateEmployeeId); setLateEmployeeId(""); }}>Registrar entrada ahora</button>
              </div>
            </div>
          );
        })()}
      </article>

      <article className="panelCard">
        <div className="sectionHead">
          <h2>Actividades programadas</h2>
          <span>Cronometro en vivo · SLA por actividad</span>
        </div>
        <div className="taskList liveList">
          {userActivities.map((activity) => (
            <div className="scheduledMission" key={activity.id}>
            <LiveActivityCard
              title={activity.name}
              scheduledStart={activity.start}
              scheduledEnd={activity.end}
              slaMinutes={activity.durationMinutes}
              evidence={activity.evidence}
              run={runFor("Actividad", activity.id)}
              onStart={() =>
                startActivityRun({
                  itemType: "Actividad",
                  itemId: activity.id,
                  title: activity.name,
                  scheduledStart: activity.start,
                  scheduledEnd: activity.end,
                  slaMinutes: activity.durationMinutes,
                  evidence: activity.evidence,
                })
              }
              onComplete={completeActivityRun}
              onCaptureEvidence={(evidence) => setActivityEvidence(runFor("Actividad", activity.id)?.id ?? `${user.id}-${today}-Actividad-${activity.id}`, evidence)}
              onClearEvidence={() => setActivityEvidence(runFor("Actividad", activity.id)?.id ?? `${user.id}-${today}-Actividad-${activity.id}`, undefined)}
              onCapturePhoto={(phase,evidence) => setActivityPhoto(runFor("Actividad", activity.id)?.id ?? `${user.id}-${today}-Actividad-${activity.id}`,phase,evidence)}
              onClearPhoto={(phase) => setActivityPhoto(runFor("Actividad", activity.id)?.id ?? `${user.id}-${today}-Actividad-${activity.id}`,phase,undefined)}
            />
            {activity.instructions && <p className="muted"><strong>Instrucciones:</strong> {activity.instructions}</p>}
            </div>
          ))}
        </div>
      </article>

      <article className="panelCard">
        <h2>Tareas asignadas por superior</h2>
        <div className="taskList">
          {dailyTasks.length ? (
            dailyTasks.map((task) => {
              const sla = task.slaMinutes ?? Math.max(15, timeToMinutes(task.end) - timeToMinutes(task.start));
              const status = task.completedAt
                ? task.status
                : slaStatus({ startedAt: task.startedAt, completedAt: undefined, slaMinutes: sla });
              return (
                <div className="taskProgressCard" key={task.id}>
                  <div className="sectionHead">
                    <span>
                      <strong>{task.title}</strong>
                      <small>
                        {task.start}-{task.end} · {task.priority} · SLA {sla} min
                      </small>
                    </span>
                    <span className={`statusPill ${slaClassName(status as SlaState)}`}>
                      {task.status === "Pausada" || task.status === "Incidencia" ? task.status : status}
                    </span>
                  </div>
                  {task.startedAt && !task.completedAt && <LiveStopwatch startedAt={task.startedAt} slaMinutes={sla} />}
                  <div className="taskProgressInputs">
                    <input
                      value={task.currentStep ?? ""}
                      disabled={task.paused}
                      onChange={(event) => updateTask(task.id, { currentStep: event.target.value })}
                      placeholder="Paso actual de la tarea"
                    />
                    <textarea
                      value={task.employeeComment ?? ""}
                      disabled={task.paused}
                      onChange={(event) => updateTask(task.id, { employeeComment: event.target.value })}
                      placeholder="Comentario de avance"
                    />
                    <textarea
                      value={task.incidentNote ?? ""}
                      onChange={(event) => updateTask(task.id, { incidentNote: event.target.value })}
                      placeholder="Incidencia que detiene la tarea"
                    />
                  </div>
                  {task.requiresPhoto && task.startedAt && <div className="beforeAfterEvidence"><div><strong>1. Foto antes de realizar la tarea</strong><PhotoCapture label="Antes de la tarea" value={task.beforeEvidenceCapture} onCapture={(evidence)=>updateTask(task.id,{beforeEvidenceCapture:evidence})} onClear={()=>updateTask(task.id,{beforeEvidenceCapture:undefined})}/></div><div><strong>2. Foto del resultado final</strong><PhotoCapture label="Después de la tarea" value={task.afterEvidenceCapture} onCapture={(evidence)=>updateTask(task.id,{afterEvidenceCapture:evidence})} onClear={()=>updateTask(task.id,{afterEvidenceCapture:undefined})}/></div></div>}
                  <div className="taskActions">
                    {!task.startedAt && (
                      <button className="ghost compact" onClick={() => startDailyTask(task)}>
                        Iniciar tarea
                      </button>
                    )}
                    <button
                      className="ghost danger"
                      disabled={task.paused}
                      onClick={() => pauseTaskForIncident(task, task.incidentNote || "Incidencia reportada por colaborador")}
                    >
                      Reportar incidencia y pausar
                    </button>
                    <button className="primary compact" disabled={task.paused || Boolean(task.requiresPhoto && (!task.beforeEvidenceCapture || !task.afterEvidenceCapture))} onClick={() => completeTask(task)}>
                      Marcar completada
                    </button>
                  </div>
                  {task.paused && <p className="muted">Tarea pausada hasta aprobacion del superior.</p>}
                </div>
              );
            })
          ) : (
            <p className="muted">Sin tareas especiales asignadas hoy.</p>
          )}
        </div>
      </article>

      <article className="panelCard">
        <h2>Mi evaluacion de hoy</h2>
        {myEval ? (
          <div className="scoreBox">
            <strong>{myEval.average.toFixed(1)}</strong>
            <span>Comision estimada: {(myEval.rate * 100).toFixed(0)}%</span>
            <p>{myEval.note || "Sin observaciones"}</p>
          </div>
        ) : (
          <p className="muted">Aun no hay evaluacion registrada para hoy.</p>
        )}
      </article>

      {canViewAll(user) && (
        <article className="wide panelCard">
          <div className="sectionHead">
            <div><h2>Bitácora de registros</h2><span>Quién se registró, qué movimiento hizo y a qué hora</span></div>
            <strong>{attendanceLog.length} movimientos</strong>
          </div>
          <div className="operationTable attendanceLogTable">
            <div className="operationRow head"><span>Colaborador</span><span>Número</span><span>Sucursal</span><span>Registro</span><span>Fecha y hora</span></div>
            {attendanceLog.slice(0, 100).map((entry, index) => {
              const employee = collaborators.find((person) => person.id === entry.employeeId);
              return <div className="operationRow" key={`${entry.employeeId}-${entry.date}-${entry.time}-${entry.event}-${index}`}><strong>{employee?.name ?? "Colaborador no encontrado"}</strong><span>{employee?.id ?? entry.employeeId}</span><span>{employee?.branch ?? "--"}</span><span className="statusPill ok">{entry.event}</span><strong>{entry.date} · {entry.time}</strong></div>;
            })}
            {attendanceLog.length === 0 && <p className="muted">Todavía no hay registros de asistencia.</p>}
          </div>
        </article>
      )}

      {canViewAll(user) && (() => {
        const processLog = [
          ...activityRuns
            .filter((run) => run.date === today)
            .map((run) => ({ id: run.id, employeeId: run.employeeId, kind: run.itemType, title: run.title, scheduled: `${run.scheduledStart}-${run.scheduledEnd}`, startedAt: run.startedAt, completedAt: run.completedAt, status: run.status })),
          ...allDailyTasks
            .filter((task) => task.date === today)
            .map((task) => ({ id: task.id, employeeId: task.employeeId, kind: "Tarea" as const, title: task.title, scheduled: `${task.start}-${task.end}`, startedAt: task.startedAt, completedAt: task.completedAt, status: task.status })),
        ].sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
        return (
          <article className="wide panelCard">
            <div className="sectionHead">
              <div><h2>Bitácora de procesos y aseo (todo el personal)</h2><span>A qué hora inició y terminó cada quien su aseo, actividad o tarea de hoy</span></div>
              <strong>{processLog.length} registros</strong>
            </div>
            <div className="operationTable processLogTable">
              <div className="operationRow head"><span>Colaborador</span><span>Tipo</span><span>Título</span><span>Horario</span><span>Inicio</span><span>Fin</span><span>Estado</span></div>
              {processLog.slice(0, 150).map((entry) => {
                const employee = collaborators.find((person) => person.id === entry.employeeId);
                return (
                  <div className="operationRow" key={entry.id}>
                    <strong>{employee?.name ?? "Colaborador no encontrado"}</strong>
                    <span>{entry.kind}</span>
                    <span>{entry.title}</span>
                    <span>{entry.scheduled}</span>
                    <span>{entry.startedAt ? new Date(entry.startedAt).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" }) : "Sin iniciar"}</span>
                    <span>{entry.completedAt ? new Date(entry.completedAt).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" }) : "--"}</span>
                    <span className={`statusPill ${entry.status === "Completada" || entry.status === "Completada con retraso" ? "ok" : entry.status === "Vencida" ? "danger" : "warn"}`}>{entry.status}</span>
                  </div>
                );
              })}
              {processLog.length === 0 && <p className="muted">Todavía no hay actividades, aseo o tareas registradas hoy.</p>}
            </div>
          </article>
        );
      })()}

      {canViewAll(user) && (
        <article className="wide panelCard">
          <div className="sectionHead"><div><h2>Cortes diarios guardados</h2><span>Cada día anterior queda cerrado como evidencia y el nuevo día inicia separado.</span></div><strong>{dailyClosures.length} cortes</strong></div>
          <div className="taskList">{dailyClosures.slice(0, 30).map((closure) => <div className="taskRow" key={closure.date}><span><strong>{closure.date}</strong><small>Cerrado {new Date(closure.closedAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</small></span><span>Asistencias: {closure.attendanceRecords} · Tareas pendientes: {closure.incompleteTasks} · Actividades pendientes: {closure.incompleteActivities ?? 0} · Procesos pendientes: {closure.incompleteProcesses}</span><strong className={closure.alertsCreated ? "danger" : "ok"}>{closure.alertsCreated} alertas</strong></div>)}</div>
        </article>
      )}
    </section>
  );
}

function ImageLightbox({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  return (
    <div className="lightboxBackdrop" onClick={onClose}>
      <div className="lightboxFrame" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="ghost compact lightboxClose" onClick={onClose}>Cerrar ✕</button>
        <img src={src} alt={label} />
      </div>
    </div>
  );
}

function EvidenceCaptured({
  value,
  label,
  onClear,
  retakeLabel,
  readOnly,
}: {
  value: EvidenceCapture;
  label: string;
  onClear: () => void;
  retakeLabel: string;
  readOnly?: boolean;
}) {
  const [zoomed, setZoomed] = useState(false);
  return (
    <div className="evidenceCaptured">
      <img src={value.dataUrl} alt={label} className="evidenceThumb" onClick={() => setZoomed(true)} />
      {zoomed && <ImageLightbox src={value.dataUrl} label={label} onClose={() => setZoomed(false)} />}
      <div>
        <small>
          <CheckCircle2 size={13} className="greenIcon" /> {new Date(value.capturedAt).toLocaleString("es-MX")}
        </small>
        <small>
          <MapPin size={13} />{" "}
          {value.lat !== undefined && value.lng !== undefined
            ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
            : "Sin ubicacion (permiso no otorgado)"}
        </small>
        {!readOnly && (
          <button type="button" className="ghost compact" onClick={onClear}>
            {retakeLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function PhotoCapture({
  value,
  onCapture,
  onClear,
  label,
  readOnly,
}: {
  value?: EvidenceCapture;
  onCapture: (evidence: EvidenceCapture) => void;
  onClear: () => void;
  label: string;
  readOnly?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const openCamera = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setCameraError("No se pudo abrir la camara del dispositivo. Usa 'Subir foto' como alternativa.");
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const snap = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setBusy(false);
      return;
    }
    ctx.drawImage(video, 0, 0);
    const raw = canvas.toDataURL("image/jpeg", 0.85);
    const [compressed, geo] = await Promise.all([compressImage(raw), captureGeolocation()]);
    onCapture({ dataUrl: compressed, capturedAt: new Date().toISOString(), ...geo });
    setBusy(false);
    closeCamera();
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const [compressed, geo] = await Promise.all([compressImage(String(reader.result)), captureGeolocation()]);
      onCapture({ dataUrl: compressed, capturedAt: new Date().toISOString(), ...geo });
      setBusy(false);
    };
    reader.readAsDataURL(file);
  };

  if (value) {
    return <EvidenceCaptured value={value} label={label} onClear={onClear} retakeLabel="Volver a tomar foto" readOnly={readOnly} />;
  }

  return (
    <div className="evidenceCapture">
      {cameraOpen ? (
        <div className="cameraBox">
          <video ref={videoRef} autoPlay playsInline muted />
          <div className="cameraActions">
            <button type="button" className="primary compact" disabled={busy} onClick={snap}>
              <Camera size={15} /> {busy ? "Guardando..." : "Capturar"}
            </button>
            <button type="button" className="ghost compact" onClick={closeCamera}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="evidenceButtons">
          <button type="button" className="ghost compact" onClick={openCamera}>
            <Camera size={15} /> Abrir camara
          </button>
          <button type="button" className="ghost compact" onClick={() => fileInputRef.current?.click()}>
            Subir foto
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
        </div>
      )}
      {cameraError && <small className="danger">{cameraError}</small>}
    </div>
  );
}

function SignaturePad({
  value,
  onCapture,
  onClear,
  readOnly,
}: {
  value?: EvidenceCapture;
  onCapture: (evidence: EvidenceCapture) => void;
  onClear: () => void;
  readOnly?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);

  const getPos = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    hasStroke.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = getPos(event);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = getPos(event);
    if (!ctx) return;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#14211b";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    drawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStroke.current = false;
  };

  const save = async () => {
    if (!hasStroke.current || !canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const geo = await captureGeolocation();
    onCapture({ dataUrl, capturedAt: new Date().toISOString(), ...geo });
  };

  if (value) {
    return <EvidenceCaptured value={value} label="Firma" onClear={onClear} retakeLabel="Volver a firmar" readOnly={readOnly} />;
  }

  return (
    <div className="signaturePad">
      <canvas
        ref={canvasRef}
        width={280}
        height={110}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="cameraActions">
        <button type="button" className="ghost compact" onClick={clearCanvas}>
          Borrar
        </button>
        <button type="button" className="primary compact" onClick={save}>
          <PenTool size={15} /> Guardar firma
        </button>
      </div>
    </div>
  );
}

function EvidenceField({
  evidence,
  value,
  onCapture,
  onClear,
  readOnly,
}: {
  evidence?: string;
  value?: EvidenceCapture;
  onCapture: (evidence: EvidenceCapture) => void;
  onClear: () => void;
  readOnly?: boolean;
}) {
  if (!evidence || evidence === "none") return null;
  if (evidence === "signature") {
    return <SignaturePad value={value} onCapture={onCapture} onClear={onClear} readOnly={readOnly} />;
  }
  return (
    <PhotoCapture
      value={value}
      onCapture={onCapture}
      onClear={onClear}
      label={evidence === "ticket" ? "Foto del ticket" : "Foto de evidencia"}
      readOnly={readOnly}
    />
  );
}

function LiveStopwatch({ startedAt, slaMinutes }: { startedAt: string; slaMinutes: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const elapsedMinutes = minutesBetween(startedAt);
  const ratio = Math.min(1.2, elapsedMinutes / slaMinutes);
  const status = slaStatus({ startedAt, completedAt: undefined, slaMinutes });
  return (
    <div className={`slaTimer ${status === "Vencida" ? "pulse" : ""}`}>
      <span className="slaClock">{formatElapsed(startedAt)}</span>
      <div className="slaBar">
        <div className={`fill ${slaClassName(status)}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <small className={slaClassName(status)}>
        {status === "Vencida" ? `SLA vencido · limite ${slaMinutes} min` : `${Math.round(elapsedMinutes)} / ${slaMinutes} min`}
      </small>
    </div>
  );
}

function LiveActivityCard({
  title,
  scheduledStart,
  scheduledEnd,
  slaMinutes,
  evidence,
  run,
  onStart,
  onComplete,
  onCaptureEvidence,
  onClearEvidence,
  onCapturePhoto,
  onClearPhoto,
}: {
  title: string;
  scheduledStart: string;
  scheduledEnd: string;
  slaMinutes: number;
  evidence?: string;
  run?: ActivityRun;
  onStart: () => void;
  onComplete: (id: string) => void;
  onCaptureEvidence?: (evidence: EvidenceCapture) => void;
  onClearEvidence?: () => void;
  onCapturePhoto?: (phase: "before" | "after", evidence: EvidenceCapture) => void;
  onClearPhoto?: (phase: "before" | "after") => void;
}) {
  const status = run ? slaStatus(run) : "Pendiente";
  const needsEvidence = Boolean(evidence && evidence !== "none");
  const evidenceReady = !needsEvidence || (evidence === "photo" ? Boolean(run?.beforeEvidenceCapture && run?.afterEvidenceCapture) : Boolean(run?.evidenceCapture));
  const inProgress = Boolean(run?.startedAt) && !run?.completedAt;
  return (
    <div className="taskRow liveActivityRow">
      <span>
        {title}
        <small>
          Programada {scheduledStart}-{scheduledEnd} · SLA {slaMinutes} min{needsEvidence ? ` · Evidencia: ${evidence}` : ""}
        </small>
        {inProgress && <LiveStopwatch startedAt={run!.startedAt!} slaMinutes={slaMinutes} />}
        {inProgress && evidence === "photo" && <div className="beforeAfterEvidence"><div><strong>1. Foto antes de iniciar el trabajo</strong><PhotoCapture label="Antes de la actividad" value={run?.beforeEvidenceCapture} onCapture={(value)=>onCapturePhoto?.("before",value)} onClear={()=>onClearPhoto?.("before")}/></div><div><strong>2. Foto de cómo quedó</strong><PhotoCapture label="Después de la actividad" value={run?.afterEvidenceCapture} onCapture={(value)=>onCapturePhoto?.("after",value)} onClear={()=>onClearPhoto?.("after")}/></div></div>}
        {inProgress && needsEvidence && evidence !== "photo" && (
          <EvidenceField
            evidence={evidence}
            value={run?.evidenceCapture}
            onCapture={onCaptureEvidence ?? (() => {})}
            onClear={onClearEvidence ?? (() => {})}
          />
        )}
      </span>
      <div className="liveActivityActions">
        <span className={`statusPill ${slaClassName(status)}`}>{status}</span>
        {!run?.startedAt && (
          <button className="ghost compact" onClick={onStart}>
            Iniciar
          </button>
        )}
        {inProgress && (
          <button className="primary compact" disabled={!evidenceReady} onClick={() => onComplete(run!.id)}>
            Completar
          </button>
        )}
      </div>
    </div>
  );
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function GovernanceView({
  user,
  shiftConfigs,
  setShiftConfigs,
  activitySchedules,
  setActivitySchedules,
  cleaningRole,
  setCleaningRole,
}: {
  user: Employee;
  shiftConfigs: ShiftConfig[];
  setShiftConfigs: (value: ShiftConfig[]) => void;
  activitySchedules: ActivitySchedule[];
  setActivitySchedules: (value: ActivitySchedule[]) => void;
  cleaningRole: CleaningRole[];
  setCleaningRole: (value: CleaningRole[]) => void;
}) {
  const [cleaningBranch, setCleaningBranch] = useState<"Matriz" | "Sucursal Centro">("Matriz");
  const updateShift = (index: number, field: keyof ShiftConfig, value: string) => {
    const next = shiftConfigs.map((shift, current) => (current === index ? { ...shift, [field]: value } : shift));
    setShiftConfigs(next);
    save("xoxo.shiftConfigs", next);
  };

  const updateActivity = (index: number, field: keyof ActivitySchedule, value: string | number) => {
    const next = activitySchedules.map((activity, current) =>
      current === index ? { ...activity, [field]: value } : activity,
    );
    setActivitySchedules(next);
    save("xoxo.activitySchedules", next);
  };

  const updateCleaning = (index: number, day: string, value: string) => {
    const next = cleaningRole.map((row, current) =>
      current === index ? { ...row, assignments: { ...row.assignments, [day]: value } } : row,
    );
    setCleaningRole(next);
    save("xoxo.cleaningRole", next);
  };

  const updateCleaningField = (index:number,field:"activity"|"start"|"end"|"details",value:string) => { const next=cleaningRole.map((row,current)=>current===index?{...row,[field]:value}:row);setCleaningRole(next);save("xoxo.cleaningRole",next); };
  const addCleaningRow = () => { const assignments=Object.fromEntries(weekDays.map((day)=>[day,""]));const next=[...cleaningRole,{branch:cleaningBranch,activity:"Nueva actividad de limpieza",start:"09:00",end:"09:30",details:"Describe el resultado esperado.",assignments} as CleaningRole];setCleaningRole(next);save("xoxo.cleaningRole",next); };
  const removeCleaningRow = (index:number) => { const next=cleaningRole.filter((_,current)=>current!==index);setCleaningRole(next);save("xoxo.cleaningRole",next); };

  const resetDefaults = () => {
    setShiftConfigs(defaultShiftConfigs);
    setActivitySchedules(defaultActivitySchedules);
    setCleaningRole(defaultCleaningRole);
    save("xoxo.shiftConfigs", defaultShiftConfigs);
    save("xoxo.activitySchedules", defaultActivitySchedules);
    save("xoxo.cleaningRole", defaultCleaningRole);
  };

  return (
    <section className="stack">
      <article className="panelCard">
        <div className="sectionHead">
          <div>
            <h2>Gobierno de informacion</h2>
            <span>Activo para {user.name}</span>
          </div>
          <button className="ghost" onClick={resetDefaults}>
            Restaurar propuesta
          </button>
        </div>
        <div className="governanceGrid">
          <div>
            <strong>Directivos</strong>
            <p>Modifican puestos, turnos, horarios, actividades, procesos, evaluaciones, sueldos y reglas.</p>
          </div>
          <div>
            <strong>Gerentes</strong>
            <p>Asignan actividades operativas a niveles inferiores y revisan cumplimiento por sucursal.</p>
          </div>
          <div>
            <strong>Jefes de area</strong>
            <p>Solo distribuyen trabajo dentro de su area y reportan cumplimiento, sin cambiar estructura.</p>
          </div>
        </div>
      </article>

      <article className="panelCard">
        <div className="sectionHead">
          <h2>Turnos y horarios asignables</h2>
          <span>Se rotan cada 15 dias cuando aplique</span>
        </div>
        <div className="editableTable shiftsTable">
          <div className="editableRow head">
            <span>Turno</span>
            <span>Entrada</span>
            <span>Salida</span>
            <span>Comida inicia</span>
            <span>Comida termina</span>
            <span>Rotacion</span>
          </div>
          {shiftConfigs.map((shift, index) => (
            <div className="editableRow" key={shift.key}>
              <input value={shift.name} onChange={(event) => updateShift(index, "name", event.target.value)} />
              <input value={shift.start} onChange={(event) => updateShift(index, "start", event.target.value)} />
              <input value={shift.end} onChange={(event) => updateShift(index, "end", event.target.value)} />
              <input value={shift.lunchStart} onChange={(event) => updateShift(index, "lunchStart", event.target.value)} />
              <input value={shift.lunchEnd} onChange={(event) => updateShift(index, "lunchEnd", event.target.value)} />
              <input value={shift.rotation} onChange={(event) => updateShift(index, "rotation", event.target.value)} />
            </div>
          ))}
        </div>
      </article>

      <article className="panelCard">
        <div className="sectionHead">
          <h2>Actividades diarias con horario</h2>
          <span>Propuesta base editable por directivos</span>
        </div>
        <div className="editableTable activityTable">
          <div className="editableRow head">
            <span>Actividad</span>
            <span>Area</span>
            <span>Inicio</span>
            <span>Fin</span>
            <span>Min</span>
            <span>Asigna</span>
          </div>
          {activitySchedules.map((activity, index) => (
            <div className="editableRow" key={activity.id}>
              <input value={activity.name} onChange={(event) => updateActivity(index, "name", event.target.value)} />
              <input value={activity.area} onChange={(event) => updateActivity(index, "area", event.target.value)} />
              <input value={activity.start} onChange={(event) => updateActivity(index, "start", event.target.value)} />
              <input value={activity.end} onChange={(event) => updateActivity(index, "end", event.target.value)} />
              <input
                type="number"
                value={activity.durationMinutes}
                onChange={(event) => updateActivity(index, "durationMinutes", Number(event.target.value))}
              />
              <input value={activity.assignedBy} onChange={(event) => updateActivity(index, "assignedBy", event.target.value)} />
            </div>
          ))}
        </div>
      </article>

      <article className="panelCard">
        <div className="sectionHead">
          <div><h2>Rol de limpieza semanal</h2><span>Configuración independiente para cada sucursal</span></div>
          <div className="taskActions"><select value={cleaningBranch} onChange={(event)=>setCleaningBranch(event.target.value as typeof cleaningBranch)}><option>Matriz</option><option>Sucursal Centro</option></select><button className="primary compact" onClick={addCleaningRow}>Agregar actividad</button></div>
        </div>
        <div className="editableTable cleaningTable">
          <div className="editableRow head">
            <span>Actividad</span>
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          {cleaningRole.map((row, index) => ({row,index})).filter(({row})=>row.branch===cleaningBranch).map(({row,index}) => (
            <div className="editableRow" key={`${row.branch}-${row.activity}-${index}`}>
              <div>
                <input value={row.activity} onChange={(event)=>updateCleaningField(index,"activity",event.target.value)}/>
                <span className="inlineTimes"><input type="time" value={row.start} onChange={(event)=>updateCleaningField(index,"start",event.target.value)}/><input type="time" value={row.end} onChange={(event)=>updateCleaningField(index,"end",event.target.value)}/></span>
                <input value={row.details} onChange={(event)=>updateCleaningField(index,"details",event.target.value)} placeholder="Resultado esperado"/>
                <button className="ghost danger compact" onClick={()=>removeCleaningRow(index)}>Eliminar</button>
              </div>
              {weekDays.map((day) => (
                <input key={day} value={row.assignments[day]} onChange={(event) => updateCleaning(index, day, event.target.value)} />
              ))}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function TeamView({
  user,
  visibleEmployees,
  collaborators,
  setCollaborators,
}: {
  user: Employee;
  visibleEmployees: Employee[];
  collaborators: Employee[];
  setCollaborators: (value: Employee[]) => void;
}) {
  const updateEmployee = (index: number, field: keyof Employee, value: string | number | undefined) => {
    const employee = visibleEmployees[index];
    const next = collaborators.map((person) => (person.id === employee.id ? { ...person, [field]: value } : person));
    setCollaborators(next);
  };

  const updateEmployeePatch = (index: number, patch: Partial<Employee>) => {
    const employee = visibleEmployees[index];
    const next = collaborators.map((person) => (person.id === employee.id ? { ...person, ...patch } : person));
    setCollaborators(next);
  };

  const addEmployee = () => {
    const nextId = String(Math.max(...collaborators.map((person) => Number(person.id) || 0)) + 1).padStart(3, "0");
    const supervisor = collaborators.find((person) => person.role === "JEFE_AREA") ?? collaborators.find((person) => person.role === "GERENTE_TIENDA");
    const newEmployee: Employee = {
      id: nextId,
      name: "Nuevo colaborador",
      role: "AUXILIAR",
      roleLabel: "Auxiliar",
      branch: "Matriz",
      area: "Apoyo operativo",
      supervisorId: supervisor?.id,
      shift: "A",
      salaryMin: 4000,
      salaryMax: 4200,
      commissionBase: "Se asigna automaticamente por puesto",
    };
    setCollaborators([...collaborators, newEmployee]);
  };

  const removeEmployee = (id: string) => {
    setCollaborators(collaborators.filter((person) => person.id !== id));
  };

  return (
    <section className="stack">
      <article className="panelCard">
      <div className="sectionHead">
        <div>
          <h2>Directorio editable</h2>
          <span>La lista de colaboradores alimenta usuarios, organigrama, evaluaciones, horarios y tareas.</span>
        </div>
        {canGovern(user) && (
          <button className="primary compact" onClick={addEmployee}>
            Agregar colaborador
          </button>
        )}
      </div>
      <div className="table editablePeople">
        <div className="tr peopleHead">
          <span>No.</span>
          <span>Nombre</span>
          <span>Puesto</span>
          <span>Sucursal</span>
          <span>Area</span>
          <span>Turno</span>
          <span>Superior</span>
          <span>Sueldo</span>
          <span></span>
        </div>
        {visibleEmployees.map((employee, index) => (
          <div className="tr peopleRow" key={employee.id}>
            <input disabled value={employee.id} title="Identificador maestro: no se modifica para conservar todas las relaciones" />
            <input disabled={!canGovern(user)} value={employee.name} onChange={(event) => updateEmployee(index, "name", event.target.value)} />
            <select
              disabled={!canGovern(user)}
              value={employee.role}
              onChange={(event) => {
                const role = event.target.value as Role;
                updateEmployeePatch(index, { role, roleLabel: roleLabel(role) });
              }}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
            <select disabled={!canGovern(user)} value={employee.branch} onChange={(event) => updateEmployee(index, "branch", event.target.value as Branch)}>
              {["Corporativo", "Matriz", "Sucursal Centro"].map((branch) => (
                <option key={branch}>{branch}</option>
              ))}
            </select>
            <input disabled={!canGovern(user)} value={employee.area} onChange={(event) => updateEmployee(index, "area", event.target.value)} />
            <select disabled={!canGovern(user)} value={employee.shift} onChange={(event) => updateEmployee(index, "shift", event.target.value as Employee["shift"])}>
              {["A", "B", "Completo", "Directivo"].map((shift) => (
                <option key={shift}>{shift}</option>
              ))}
            </select>
            <select
              disabled={!canGovern(user)}
              value={employee.supervisorId ?? ""}
              onChange={(event) => updateEmployee(index, "supervisorId", event.target.value || undefined)}
            >
              <option value="">Sin superior</option>
              {collaborators
                .filter((person) => person.id !== employee.id)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
            </select>
            <span>
              ${(employee.salaryMin ?? 0).toLocaleString("es-MX")} - ${(employee.salaryMax ?? 0).toLocaleString("es-MX")}
            </span>
            <button className="ghost danger" disabled={!canGovern(user)} onClick={() => removeEmployee(employee.id)}>
              Borrar
            </button>
          </div>
        ))}
      </div>
      {["001","002","003","005"].includes(user.id)&&<div className="accessAdmin"><div className="sectionHead"><div><h2>Accesos y contraseñas temporales</h2><span>La contraseña se usa una vez; el colaborador deberá reemplazarla al entrar.</span></div></div>{collaborators.filter((employee)=>employee.name!=="Vacante").map((employee)=><EmployeeAccessControl key={employee.id} employee={employee}/>)}</div>}
      </article>

      <article className="panelCard">
        <h2>Informacion automatica por puesto</h2>
        <div className="profileGrid">
          {roleProfiles.map((profile) => (
            <div key={profile.role}>
              <strong>{roleLabel(profile.role)}</strong>
              <p>{profile.objective}</p>
              <small>Reporta a: {profile.reportTo}</small>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function OrgView({ collaborators }: { collaborators: Employee[] }) {
  const levelFor = (employee: Employee, seen: string[] = []): number => {
    if (!employee.supervisorId || seen.includes(employee.id)) return 0;
    const supervisor = collaborators.find((person) => person.id === employee.supervisorId);
    return supervisor ? levelFor(supervisor, [...seen, employee.id]) + 1 : 0;
  };
  const levels = collaborators.reduce<Record<number, Employee[]>>((grouped, employee) => {
    const level = levelFor(employee);
    grouped[level] = [...(grouped[level] ?? []), employee];
    return grouped;
  }, {});
  const sortedLevels = Object.entries(levels).sort(([a], [b]) => Number(a) - Number(b));
  const initials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  return (
    <section className="panelCard orgWrap">
      <div className="sectionHead">
        <div>
          <h2>Organigrama automatico</h2>
          <span>Se genera desde la tabla de colaboradores y sus superiores inmediatos.</span>
        </div>
        <Network className="greenIcon" />
      </div>
      <div className="orgCanvas">
        {sortedLevels.map(([level, employees]) => (
          <div className="orgLevel" key={level}>
            <span className="levelTag">Nivel {Number(level) + 1}</span>
            <div className="orgLevelNodes">
              {employees.map((employee) => {
                const supervisor = supervisorFor(employee, collaborators);
                return (
                  <div className={`orgCard rank${Math.min(Number(level) + 1, 6)}`} key={employee.id}>
                    <div className="avatar">{initials(employee.name)}</div>
                    <strong>{employee.name}</strong>
                    <span>{employee.roleLabel}</span>
                    <small>
                      {employee.branch} · {employee.area}
                    </small>
                    {supervisor && <em>Reporta a {supervisor.name}</em>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProcessesView({
  user,
  collaborators,
  processInstances,
  setProcessInstances,
  notify,
}: {
  user: Employee;
  collaborators: Employee[];
  processInstances: ProcessInstance[];
  setProcessInstances: (value: ProcessInstance[]) => void;
  notify: (title: string, message: string, recipientId: string | undefined, priority?: InternalRequest["priority"]) => void;
}) {
  const startProcess = (processId: string, ownerId: string, notes: string) => {
    const process = processes.find((item) => item.id === processId);
    if (!process) return;
    const next: ProcessInstance = {
      id: crypto.randomUUID(),
      processId: process.id,
      title: process.name,
      startedById: user.id,
      ownerId,
      date: todayKey(),
      status: "Activo",
      notes,
      startedAt: new Date().toISOString(),
      slaMinutes: process.id === "recepcion-mercancia" ? 180 : undefined,
      stepStates: process.steps.map((step) => ({
        title: step.title,
        owner: step.owner,
        evidence: step.evidence,
        done: false,
        note: "",
      })),
    };
    setProcessInstances([next, ...processInstances]);
  };

  const updateInstance = (instance: ProcessInstance) => {
    setProcessInstances(processInstances.map((item) => (item.id === instance.id ? instance : item)));
  };

  const availableOwners = collaborators.filter((employee) => employee.id === user.id || canAssign(user, employee));
  const visibleInstances = canViewAll(user)
    ? processInstances
    : processInstances.filter((instance) => instance.processId === "recepcion-mercancia" || instance.ownerId === user.id || instance.startedById === user.id);
  const activeInstances = visibleInstances.filter((instance) => instance.status === "Activo" || instance.status === "Incidencia");

  return (
    <section className="stack">
      <article className="panelCard">
        <div className="sectionHead">
          <div>
            <h2>Procesos activos</h2>
            <span>Se abren al momento de ejecutar la actividad</span>
          </div>
          <strong>{activeInstances.length}</strong>
        </div>
        <div className="instanceGrid">
          {activeInstances.length === 0 && <p className="muted">No hay procesos activos para este usuario.</p>}
          {activeInstances.map((instance) => {
            const owner = collaborators.find((employee) => employee.id === instance.ownerId);
            const completed = instance.stepStates.filter((step) => step.done).length;
            if (instance.processId === "recepcion-mercancia") {
              return (
                <RecepcionMercanciaCard
                  key={instance.id}
                  instance={instance}
                  user={user}
                  owner={owner}
                  collaborators={collaborators}
                  updateInstance={updateInstance}
                  notify={notify}
                />
              );
            }
            return (
              <div className="processInstance" key={instance.id}>
                <div className="sectionHead">
                  <div>
                    <strong>{instance.title}</strong>
                    <span>
                      Responsable: {owner?.name ?? "Sin asignar"} · {instance.date}
                    </span>
                  </div>
                  <span className={instance.status === "Incidencia" ? "status dangerText" : "status"}>{instance.status}</span>
                </div>
                {instance.notes && <p className="muted">{instance.notes}</p>}
                <div className="progressLine">
                  <span style={{ width: `${(completed / Math.max(instance.stepStates.length, 1)) * 100}%` }} />
                </div>
                <div className="steps">
                  {instance.stepStates.map((step, index) => {
                    const needsEvidence = step.evidence !== "none";
                    const setEvidence = (evidenceCapture: EvidenceCapture | undefined) => {
                      const stepStates = instance.stepStates.map((current, currentIndex) =>
                        currentIndex === index ? { ...current, evidenceCapture } : current,
                      );
                      updateInstance({ ...instance, stepStates });
                    };
                    const setPhoto = (phase:"before"|"after",evidence:EvidenceCapture|undefined) => { const key=phase==="before"?"beforeEvidenceCapture":"afterEvidenceCapture";const stepStates=instance.stepStates.map((current,currentIndex)=>currentIndex===index?{...current,[key]:evidence}:current);updateInstance({...instance,stepStates}); };
                    const toggleDone = (done: boolean) => {
                      if (done && step.evidence === "photo" && (!step.beforeEvidenceCapture || !step.afterEvidenceCapture)) return;
                      if (done && needsEvidence && step.evidence !== "photo" && !step.evidenceCapture) return;
                      const stepStates = instance.stepStates.map((current, currentIndex) =>
                        currentIndex === index ? { ...current, done, completedAt: done ? timeNow() : undefined } : current,
                      );
                      updateInstance({ ...instance, stepStates });
                    };
                    if (!needsEvidence) {
                      return (
                        <label className="checkStep" key={`${instance.id}-${step.title}`}>
                          <input type="checkbox" checked={step.done} onChange={(event) => toggleDone(event.target.checked)} />
                          <span>
                            <strong>{step.title}</strong>
                            <small>
                              {step.owner} · Evidencia: {step.evidence}
                              {step.completedAt ? ` · ${step.completedAt}` : ""}
                            </small>
                          </span>
                        </label>
                      );
                    }
                    return (
                      <div className={`luzVerdeStep ${step.done ? "done" : "active"}`} key={`${instance.id}-${step.title}`}>
                        <div className="stepHeader">
                          <b>{index + 1}</b>
                          <span>
                            <strong>{step.title}</strong>
                            <small>
                              {step.owner} · Evidencia: {step.evidence}
                              {step.completedAt ? ` · ${step.completedAt}` : ""}
                            </small>
                          </span>
                          {step.done ? (
                            <button className="ghost compact" onClick={() => toggleDone(false)}>
                              Deshacer
                            </button>
                          ) : (
                            <button className="ghost compact" disabled={step.evidence==="photo"?!step.beforeEvidenceCapture||!step.afterEvidenceCapture:!step.evidenceCapture} onClick={() => toggleDone(true)}>
                              Marcar hecho
                            </button>
                          )}
                        </div>
                        {step.evidence==="photo"?<div className="beforeAfterEvidence"><div><strong>Foto antes</strong><PhotoCapture label="Antes" value={step.beforeEvidenceCapture} onCapture={(evidence)=>setPhoto("before",evidence)} onClear={()=>setPhoto("before",undefined)} readOnly={step.done}/></div><div><strong>Foto después</strong><PhotoCapture label="Después" value={step.afterEvidenceCapture} onCapture={(evidence)=>setPhoto("after",evidence)} onClear={()=>setPhoto("after",undefined)} readOnly={step.done}/></div></div>:<EvidenceField
                          evidence={step.evidence}
                          value={step.evidenceCapture}
                          onCapture={setEvidence}
                          onClear={() => setEvidence(undefined)}
                          readOnly={step.done}
                        />}
                      </div>
                    );
                  })}
                </div>
                <textarea
                  value={instance.notes}
                  onChange={(event) => updateInstance({ ...instance, notes: event.target.value })}
                  placeholder="Notas, proveedor, factura, incidencia o evidencia pendiente"
                />
                <div className="taskActions">
                  <button className="ghost danger" onClick={() => updateInstance({ ...instance, status: "Incidencia" })}>
                    Marcar incidencia
                  </button>
                  <button
                    className="primary"
                    onClick={() => updateInstance({ ...instance, status: "Completado" })}
                    disabled={completed < instance.stepStates.length}
                  >
                    Completar proceso
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </article>

      <section className="processGrid">
        {processes.map((process) => (
          <ProcessCard key={process.id} process={process} user={user} owners={availableOwners} startProcess={startProcess} />
        ))}
      </section>

      <article className="panelCard">
        <div className="sectionHead">
          <div>
            <h2>Reglamento interno</h2>
            <span>Referencia para incidencias, permisos y disciplina</span>
          </div>
          <ShieldCheck className="greenIcon" />
        </div>
        <div className="ruleGrid">
          {internalRules.map((rule) => (
            <div key={rule.id}>
              <strong>{rule.title}</strong>
              <small>{rule.appliesTo}</small>
              <p>{rule.policy}</p>
              <span>Escala: {rule.escalation}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

// Paso 6 (indice 5) del proceso "recepcion-mercancia": captura de precios en ERP.
// Al marcarse, se dispara la notificacion de Luz Verde y se desbloquea el paso 7 (acomodo).
const RECEPCION_LUZ_VERDE_INDEX = 5;

function merchandisingHint(tipo?: ProcessInstance["merchandisingTipo"]) {
  if (tipo === "Oferta" || tipo === "Novedad") return "Ubicar en zona de alto impacto visual (entrada, cabecera o mostrador principal).";
  if (tipo === "Producto ancla") return "Ubicar en zona estrategica de paso obligado del cliente.";
  return "Acomodo estandar en su zona / anaquel correspondiente.";
}

function RecepcionMercanciaCard({
  instance,
  user,
  owner,
  collaborators,
  updateInstance,
  notify,
}: {
  instance: ProcessInstance;
  user: Employee;
  owner?: Employee;
  collaborators: Employee[];
  updateInstance: (instance: ProcessInstance) => void;
  notify: (title: string, message: string, recipientId: string | undefined, priority?: InternalRequest["priority"]) => void;
}) {
  const completed = instance.stepStates.filter((step) => step.done).length;
  const merchandiseSla = instance.slaMinutes ?? 180;
  const canManageReception = canGovern(user) || ["GERENTE_TIENDA", "ADMIN_TIENDA"].includes(user.role);
  const canInspect = canManageReception || user.role === "JEFE_AREA";
  const canCaptureErp = canGovern(user) || ["007", "009", "010"].includes(user.id);
  const luzVerde = instance.stepStates[RECEPCION_LUZ_VERDE_INDEX]?.done ?? false;
  const isUnlocked = (index: number) => (index === 0 ? Boolean(instance.fleteType) : Boolean(instance.stepStates[index - 1]?.done));

  const setStepNote = (index: number, note: string) => {
    const stepStates = instance.stepStates.map((current, currentIndex) => (currentIndex === index ? { ...current, note } : current));
    updateInstance({ ...instance, stepStates });
  };

  const setStepEvidence = (index: number, evidenceCapture: EvidenceCapture | undefined) => {
    const stepStates = instance.stepStates.map((current, currentIndex) => (currentIndex === index ? { ...current, evidenceCapture } : current));
    updateInstance({ ...instance, stepStates });
  };

  const setStepPhoto = (index: number, phase: "before" | "after", evidence: EvidenceCapture | undefined) => {
    const key = phase === "before" ? "beforeEvidenceCapture" : "afterEvidenceCapture";
    const stepStates = instance.stepStates.map((current, currentIndex) => currentIndex === index ? { ...current, [key]: evidence } : current);
    updateInstance({ ...instance, stepStates });
  };

  const completeStep = (index: number) => {
    const step = instance.stepStates[index];
    if (step.evidence === "photo" && (!step.beforeEvidenceCapture || !step.afterEvidenceCapture)) return;
    if (step.evidence !== "none" && step.evidence !== "photo" && !step.evidenceCapture) return;
    const stepStates = instance.stepStates.map((current, currentIndex) =>
      currentIndex === index ? { ...current, done: true, completedAt: timeNow() } : current,
    );
    updateInstance({ ...instance, stepStates });
    if (index === RECEPCION_LUZ_VERDE_INDEX) {
      notify(
        "Luz verde: mercancia lista para acomodo",
        `El administrador ya capturo precios en ERP para "${instance.title}"${instance.notes ? ` (${instance.notes})` : ""}. Ya se puede acomodar, etiquetar y exhibir.`,
        instance.ownerId,
        "Alta",
      );
    }
  };

  const undoStep = (index: number) => {
    const stepStates = instance.stepStates.map((current, currentIndex) =>
      currentIndex === index ? { ...current, done: false, completedAt: undefined } : current,
    );
    updateInstance({ ...instance, stepStates });
  };

  return (
    <div className="processInstance luzVerdeCard">
      <div className="sectionHead">
        <div>
          <strong>{instance.title}</strong>
          <span>
            Responsable: {owner?.name ?? "Sin asignar"} · {instance.date}
          </span>
        </div>
        <span className={instance.status === "Incidencia" ? "status dangerText" : "status"}>{instance.status}</span>
      </div>

      <div className="processSlaBanner">
        <span>Tiempo máximo para completar todo el proceso: 3 horas</span>
        {instance.startedAt ? <LiveStopwatch startedAt={instance.startedAt} slaMinutes={merchandiseSla} /> : <strong>Proceso anterior sin hora de inicio</strong>}
      </div>

      {luzVerde && (
        <div className="luzVerdeBanner">
          <Sparkles size={16} /> LUZ VERDE — precios capturados, ya se puede acomodar y exhibir
        </div>
      )}

      <label className="fleteTypeSelect">
        Tipo de flete
        <select
          value={instance.fleteType ?? ""}
          disabled={instance.stepStates[0]?.done}
          onChange={(event) => updateInstance({ ...instance, fleteType: event.target.value as ProcessInstance["fleteType"] })}
        >
          <option value="" disabled>
            Selecciona...
          </option>
          <option value="Fletera externa">Fletera externa (revisar sellos y empaque exterior)</option>
          <option value="Flete propio del proveedor">Flete propio del proveedor (revisar pieza por pieza contra remision)</option>
        </select>
      </label>

      <div className="progressLine">
        <span style={{ width: `${(completed / Math.max(instance.stepStates.length, 1)) * 100}%` }} />
      </div>

      <div className="luzVerdeSteps">
        {instance.stepStates.map((step, index) => {
          const unlocked = isUnlocked(index);
          const gatedByLuzVerde = index === RECEPCION_LUZ_VERDE_INDEX + 1 && !luzVerde;
          const authorized = index === 0 || (index >= 1 && index <= 3 && canInspect) || (index >= 4 && index <= 5 && canCaptureErp) || (index === 6 && (canInspect || user.role === "AUXILIAR") && (!instance.stockingAssigneeId || instance.stockingAssigneeId === user.id || canInspect)) || (index === 7 && canManageReception);
          return (
            <div className={`luzVerdeStep ${step.done ? "done" : unlocked ? "active" : "locked"}`} key={`${instance.id}-${step.title}`}>
              <div className="stepHeader">
                <b>{index + 1}</b>
                <span>
                  <strong>{step.title}</strong>
                  <small>
                    {step.owner} · Evidencia: {step.evidence}
                    {step.completedAt ? ` · ${step.completedAt}` : ""}
                  </small>
                </span>
                {step.done ? (
                  <CheckCircle2 className="greenIcon" size={18} />
                ) : unlocked && authorized ? (
                  <button className="ghost compact" onClick={() => completeStep(index)}>
                    Marcar hecho
                  </button>
                ) : unlocked ? (
                  <span className="statusPill muted">Esperando: {step.owner}</span>
                ) : (
                  <span className="statusPill muted">{gatedByLuzVerde ? "Esperando luz verde" : "Bloqueado"}</span>
                )}
              </div>
              {index === RECEPCION_LUZ_VERDE_INDEX + 1 && (
                <><label className="merchandisingSelect">
                  Tipo de exhibicion
                  <select
                    value={instance.merchandisingTipo ?? "Normal"}
                    disabled={!unlocked}
                    onChange={(event) =>
                      updateInstance({ ...instance, merchandisingTipo: event.target.value as ProcessInstance["merchandisingTipo"] })
                    }
                  >
                    <option value="Normal">Normal</option>
                    <option value="Oferta">Oferta</option>
                    <option value="Producto ancla">Producto ancla</option>
                    <option value="Novedad">Novedad</option>
                  </select>
                  <small>{merchandisingHint(instance.merchandisingTipo)}</small>
                </label>{canInspect && <label className="merchandisingSelect">Responsable del acomodo<select value={instance.stockingAssigneeId ?? ""} onChange={(event) => updateInstance({ ...instance, stockingAssigneeId: event.target.value || undefined })}><option value="">Jefe de área lo realizará</option>{collaborators.filter((person) => ["JEFE_AREA", "AUXILIAR"].includes(person.role)).map((person) => <option key={person.id} value={person.id}>{person.name} · {person.branch}</option>)}</select></label>}</>
              )}
              {unlocked && authorized && step.evidence === "photo" && !step.done && <div className="beforeAfterEvidence"><div><strong>Foto antes</strong><PhotoCapture label="Antes" value={step.beforeEvidenceCapture} onCapture={(evidence)=>setStepPhoto(index,"before",evidence)} onClear={()=>setStepPhoto(index,"before",undefined)}/></div><div><strong>Foto después</strong><PhotoCapture label="Después" value={step.afterEvidenceCapture} onCapture={(evidence)=>setStepPhoto(index,"after",evidence)} onClear={()=>setStepPhoto(index,"after",undefined)}/></div></div>}
              {unlocked && authorized && step.evidence !== "none" && step.evidence !== "photo" && !step.done && (
                <EvidenceField
                  evidence={step.evidence}
                  value={step.evidenceCapture}
                  onCapture={(evidence) => setStepEvidence(index, evidence)}
                  onClear={() => setStepEvidence(index, undefined)}
                />
              )}
              {!step.done && unlocked && authorized && (
                <textarea
                  value={step.note}
                  onChange={(event) => setStepNote(index, event.target.value)}
                  placeholder="Comentario opcional"
                />
              )}
              {step.done && step.evidenceCapture && (
                <EvidenceField evidence={step.evidence} value={step.evidenceCapture} onCapture={() => {}} onClear={() => {}} readOnly />
              )}
              {step.done && step.note && <p className="muted stepNote">{step.note}</p>}
              {step.done && (
                <button className="ghost compact" onClick={() => undoStep(index)}>
                  Deshacer
                </button>
              )}
            </div>
          );
        })}
      </div>

      <textarea
        value={instance.notes}
        onChange={(event) => updateInstance({ ...instance, notes: event.target.value })}
        placeholder="Proveedor, numero de factura, incidencia u observacion general"
      />
      <div className="taskActions">
        <button className="ghost danger" onClick={() => updateInstance({ ...instance, status: "Incidencia" })}>
          Marcar incidencia
        </button>
        <button
          className="primary"
          onClick={() => updateInstance({ ...instance, status: "Completado" })}
          disabled={completed < instance.stepStates.length}
        >
          Completar proceso
        </button>
      </div>
    </div>
  );
}

function ProcessCard({
  process,
  user,
  owners,
  startProcess,
}: {
  process: (typeof processes)[number];
  user: Employee;
  owners: Employee[];
  startProcess: (processId: string, ownerId: string, notes: string) => void;
}) {
  const [ownerId, setOwnerId] = useState(user.id);
  const [notes, setNotes] = useState("");
  const canStart = process.allowedRoles.includes(user.role) || canGovern(user);
  return (
    <article className="panelCard processCard">
      <div className="sectionHead">
        <div>
          <h2>{process.name}</h2>
          <span>{process.area}</span>
        </div>
        {canStart ? <CheckCircle2 className="greenIcon" /> : <AlertTriangle className="amberIcon" />}
      </div>
      <p className="muted">{process.risk}</p>
      <div className="steps">
        {process.steps.map((step, index) => (
          <div key={step.title} className="step">
            <b>{index + 1}</b>
            <div>
              <strong>{step.title}</strong>
              <span>
                {step.owner} · {step.time} · Evidencia: {step.evidence}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="processActions">
        <select disabled={!canStart} value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
          {owners.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} - {employee.roleLabel}
            </option>
          ))}
        </select>
        <input
          disabled={!canStart}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Proveedor, cliente, factura o detalle"
        />
        <button
          className="primary"
          disabled={!canStart}
          onClick={() => {
            startProcess(process.id, ownerId, notes);
            setNotes("");
          }}
        >
          Activar proceso
        </button>
      </div>
      <small className="mutedText">Si falla: notificar a {process.notifyOnFailure}</small>
    </article>
  );
}

function EvaluationView(props: {
  user: Employee;
  targetEvalId: string;
  setTargetEvalId: (id: string) => void;
  scores: number[];
  setScores: (scores: number[]) => void;
  note: string;
  setNote: (note: string) => void;
  personalSales: number;
  setPersonalSales: (value: number) => void;
  salesGoal: number;
  setSalesGoal: (value: number) => void;
  submitEvaluation: () => void;
  evaluations: Evaluation[];
  collaborators: Employee[];
  activityRuns: ActivityRun[];
  dailyTasks: DailyTask[];
  shiftMap: Record<string, ShiftConfig>;
  cashIncidents: CashIncident[];
  slaReviews: SlaReview[];
}) {
  const slaPenalty = props.slaReviews.filter((review)=>review.employeeId===props.targetEvalId&&review.date===todayKey()).reduce((sum,review)=>sum+review.scoreImpact,0);
  const baseAverage = props.scores.reduce((sum, value) => sum + value, 0) / props.scores.length;
  const average = Math.max(0, baseAverage + slaPenalty);
  const rate = commissionRate(average, props.salesGoal, props.personalSales);
  const canSeeStoreSummary =
    canViewAll(props.user) || props.collaborators.some((employee) => employee.supervisorId === props.user.id);
  return (
    <section className="grid two">
      {canSeeStoreSummary && (
        <StoreSummaryPanel
          user={props.user}
          collaborators={props.collaborators}
          evaluations={props.evaluations}
          activityRuns={props.activityRuns}
          dailyTasks={props.dailyTasks}
          shiftMap={props.shiftMap}
          cashIncidents={props.cashIncidents}
        />
      )}
      <article className="panelCard">
        <div className="sectionHead">
          <h2>Evaluar colaborador</h2>
          <span>Escala 10 / 8 / 6 / 4 · ajuste SLA {slaPenalty} punto(s)</span>
        </div>
        <select value={props.targetEvalId} onChange={(event) => props.setTargetEvalId(event.target.value)}>
          {props.collaborators
            .filter((employee) => canAssign(props.user, employee))
            .map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} - {employee.roleLabel}
              </option>
            ))}
        </select>
        <div className="criteria">
          {evaluationCriteria.map((criterion, index) => (
            <label key={criterion}>
              <span>{criterion}</span>
              <select
                value={props.scores[index]}
                onChange={(event) => {
                  const next = [...props.scores];
                  next[index] = Number(event.target.value);
                  props.setScores(next);
                }}
              >
                {[10, 8, 6, 4].map((score) => (
                  <option key={score}>{score}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="moneyInputs">
          <label>
            Venta personal
            <input type="number" value={props.personalSales} onChange={(event) => props.setPersonalSales(Number(event.target.value))} />
          </label>
          <label>
            Meta diaria
            <input type="number" value={props.salesGoal} onChange={(event) => props.setSalesGoal(Number(event.target.value))} />
          </label>
        </div>
        <textarea value={props.note} onChange={(event) => props.setNote(event.target.value)} placeholder="Observaciones del dia" />
        <button className="primary" onClick={props.submitEvaluation}>
          Guardar evaluacion
        </button>
      </article>

      <article className="panelCard">
        <h2>Resultado calculado</h2>
        <div className="scoreBox">
          <strong>{average.toFixed(1)}</strong>
          <span>Comision sugerida: {(rate * 100).toFixed(0)}%</span>
          <p>
            El sistema mezcla evaluacion diaria, ventas personales, asistencia y cumplimiento de procesos. Los porcentajes quedan configurables para la version con base de datos.
          </p>
        </div>
        <h3>Evaluaciones guardadas</h3>
        <div className="taskList">
          {props.evaluations.slice(-5).map((entry) => (
            <div className="taskRow" key={`${entry.employeeId}-${entry.evaluatorId}-${entry.date}`}>
              <span>{props.collaborators.find((employee) => employee.id === entry.employeeId)?.name}</span>
              <strong>{(entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length).toFixed(1)}</strong>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function semaforoFor(average?: number): { label: string; className: string } {
  if (average === undefined) return { label: "Sin evaluar", className: "muted" };
  if (average >= 9) return { label: "Excelente", className: "ok" };
  if (average >= 8) return { label: "Aceptable", className: "warn" };
  return { label: "Problema", className: "danger" };
}

function StoreSummaryPanel({
  user,
  collaborators,
  evaluations,
  activityRuns,
  dailyTasks,
  shiftMap,
  cashIncidents,
}: {
  user: Employee;
  collaborators: Employee[];
  evaluations: Evaluation[];
  activityRuns: ActivityRun[];
  dailyTasks: DailyTask[];
  shiftMap: Record<string, ShiftConfig>;
  cashIncidents: CashIncident[];
}) {
  const today = todayKey();
  const visible = canViewAll(user) ? collaborators : collaborators.filter((employee) => employee.supervisorId === user.id);
  const rows = visible.map((employee) => {
    const todaysEval = evaluations.find((entry) => entry.employeeId === employee.id && entry.date === today);
    const average = todaysEval ? todaysEval.scores.reduce((sum, value) => sum + value, 0) / todaysEval.scores.length : undefined;
    const rate = todaysEval ? commissionRate(average ?? 0, todaysEval.salesGoal, todaysEval.personalSales) : 0;
    const commission = todaysEval ? todaysEval.personalSales * rate : 0;
    const cost = dailySalaryFor(employee) + commission;
    const paidMinutes = paidMinutesFor(shiftMap[employee.shift]);
    const doneMinutes = completedMinutesFor(employee.id, today, activityRuns, dailyTasks);
    const productivity = paidMinutes > 0 ? Math.min(100, (doneMinutes / paidMinutes) * 100) : 0;
    const incidents =
      cashIncidents.filter((item) => item.ownerId === employee.id && item.date === today).length +
      activityRuns.filter((run) => run.employeeId === employee.id && run.date === today && run.escalated).length +
      dailyTasks.filter((task) => task.employeeId === employee.id && task.date === today && task.escalated).length;
    return { employee, average, cost, productivity, incidents, semaforo: semaforoFor(average) };
  });
  const totalSales = evaluations
    .filter((entry) => entry.date === today && visible.some((employee) => employee.id === entry.employeeId))
    .reduce((sum, entry) => sum + entry.personalSales, 0);
  const totalGoal = evaluations
    .filter((entry) => entry.date === today && visible.some((employee) => employee.id === entry.employeeId))
    .reduce((sum, entry) => sum + entry.salesGoal, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);

  return (
    <article className="wide panelCard">
      <div className="sectionHead">
        <div>
          <h2>Resumen diario de tienda — costo, productividad y calidad</h2>
          <span>Formato B del Manual + costo real por colaborador (sueldo quincenal / 15 + comision del dia)</span>
        </div>
      </div>
      <div className="reportMetrics">
        <div>
          <span>Venta total del dia</span>
          <strong>${totalSales.toLocaleString("es-MX")}</strong>
        </div>
        <div>
          <span>Meta del dia</span>
          <strong>${totalGoal.toLocaleString("es-MX")}</strong>
        </div>
        <div>
          <span>% Cumplimiento</span>
          <strong>{totalGoal > 0 ? `${((totalSales / totalGoal) * 100).toFixed(0)}%` : "--"}</strong>
        </div>
        <div>
          <span>Costo total del dia</span>
          <strong>${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</strong>
        </div>
      </div>
      <div className="operationTable storeSummaryTable">
        <div className="operationRow head">
          <span>Colaborador / Puesto</span>
          <span>Costo del dia</span>
          <span>% Tiempo efectivo</span>
          <span>Calificacion</span>
          <span>Semaforo</span>
          <span>Incidencias</span>
        </div>
        {rows.map(({ employee, average, cost, productivity, incidents, semaforo }) => (
          <div className="operationRow" key={employee.id}>
            <span>
              <strong>{employee.name}</strong>
              <small>{employee.roleLabel}</small>
            </span>
            <span>${cost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
            <span>{productivity.toFixed(0)}%</span>
            <span>{average !== undefined ? average.toFixed(1) : "--"}</span>
            <span className={`statusPill ${semaforo.className}`}>{semaforo.label}</span>
            <span className={incidents > 0 ? "danger" : ""}>{incidents}</span>
          </div>
        ))}
      </div>
      <p className="muted">
        % Tiempo efectivo = minutos de actividades y tareas completadas hoy / minutos pagados del turno. Aun no incorpora
        evidencia fotografica (modulo pendiente) — por ahora cuenta lo marcado como completado en el cronometro.
      </p>
    </article>
  );
}

function TasksView({
  user,
  collaborators,
  dailyTasks,
  setDailyTasks,
  workLocations,
  assignWorkLocation,
}: {
  user: Employee;
  collaborators: Employee[];
  dailyTasks: DailyTask[];
  setDailyTasks: (value: DailyTask[]) => void;
  workLocations: WorkLocation[];
  assignWorkLocation: (employeeId: string, location: WorkLocation["location"]) => void;
}) {
  const today = todayKey();
  const isAuxiliary = user.role === "AUXILIAR";
  const [taskError, setTaskError] = useState("");
  const [reviewStatus, setReviewStatus] = useState("Todas");
  const assignable = collaborators.filter((employee) => canAssign(user, employee));
  const addTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const employeeId=String(form.get("employeeId"));const start=String(form.get("start"));const end=String(form.get("end"));const notes=String(form.get("notes")).trim();
    if(timeToMinutes(end)<=timeToMinutes(start)){setTaskError("La hora final debe ser posterior a la hora inicial.");return;}
    if(notes.length<20){setTaskError("La misión necesita instrucciones completas de al menos 20 caracteres.");return;}
    const targetEmployee=collaborators.find((employee)=>employee.id===employeeId);
    const overlaps=dailyTasks.filter((task)=>task.employeeId===employeeId&&task.date===today&&task.status!=="Completada"&&timeToMinutes(start)<timeToMinutes(task.end)&&timeToMinutes(end)>timeToMinutes(task.start));
    const overlapLimit=targetEmployee?.role==="AUXILIAR"?2:1;
    if(overlaps.length>=overlapLimit){setTaskError(targetEmployee?.role==="AUXILIAR"?"Un auxiliar no puede tener más de 2 tareas en el mismo horario.":`Horario ocupado por: ${overlaps[0].title} (${overlaps[0].start}-${overlaps[0].end}).`);return;}
    const targetedSchedule=defaultActivitySchedules.filter((activity)=>activity.employeeIds?.includes(employeeId));
    const fixedConflict=targetEmployee&&(targetedSchedule.length?targetedSchedule:defaultActivitySchedules.filter((activity)=>!activity.employeeIds?.length&&activity.ownerRoles.includes(targetEmployee.role))).find((activity)=>activity.area!=="Operación"&&timeToMinutes(start)<timeToMinutes(activity.end)&&timeToMinutes(end)>timeToMinutes(activity.start));
    if(fixedConflict){setTaskError(`Ese horario choca con una actividad fija: ${fixedConflict.name} (${fixedConflict.start}-${fixedConflict.end}).`);return;}
    setTaskError("");
    const next: DailyTask[] = [
      ...dailyTasks,
      {
        id: crypto.randomUUID(),
        title: String(form.get("title")),
        employeeId,
        assignedById: user.id,
        assignedAt: new Date().toISOString(),
        date: today,
        start,
        end,
        status: "Pendiente",
        priority: String(form.get("priority")) as DailyTask["priority"],
        notes,
        currentStep: "Asignada",
        employeeComment: "",
        supervisorComment: "",
        incidentNote: "",
        paused: false,
        approvalStatus: "No requerida",
        requiresPhoto: form.get("requiresPhoto") === "on",
      },
    ];
    setDailyTasks(next);
    event.currentTarget.reset();
  };

  const updateTaskStatus = (id: string, status: DailyTask["status"]) => {
    setDailyTasks(
      dailyTasks.map((task) =>
        task.id === id
          ? {
              ...task,
              status,
              paused: status === "Pausada" || status === "Incidencia" ? true : task.paused,
              approvalStatus: status === "Pausada" || status === "Incidencia" ? "Pendiente" : task.approvalStatus,
            }
          : task,
      ),
    );
  };

  const updateTaskPatch = (id: string, patch: Partial<DailyTask>) => {
    setDailyTasks(dailyTasks.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  };

  const approveTask = (id: string) => {
    updateTaskPatch(id, {
      status: "En proceso",
      paused: false,
      approvalStatus: "Aprobada",
    });
  };

  const deleteTask = (id: string) => {
    setDailyTasks(dailyTasks.filter((task) => task.id !== id));
  };

  const [reviewEmployee, setReviewEmployee] = useState("Todos");
  const visibleTasks = canViewAll(user)
    ? dailyTasks
    : dailyTasks.filter((task) => task.employeeId === user.id || task.assignedById === user.id);
  const reviewedTasks = visibleTasks
    .filter((task) => reviewStatus === "Todas" || task.status === reviewStatus)
    .filter((task) => reviewEmployee === "Todos" || task.employeeId === reviewEmployee);
  const canDirectAllTasks = ["001", "002", "003"].includes(user.id);
  const locationTargets = collaborators.filter((employee) => employee.role === "AUXILIAR" || employee.id === "006");

  return (
    <section className="grid two">
      {!isAuxiliary && <form className="panelCard form" onSubmit={addTask}>
        <h2>Asignar tarea del dia</h2>
        <select name="employeeId" required>
          {assignable.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} - {employee.roleLabel}
            </option>
          ))}
        </select>
        <input name="title" placeholder="Tarea o actividad" required />
        <div className="moneyInputs">
          <label>
            Inicio
            <input name="start" type="time" defaultValue="10:00" required />
          </label>
          <label>
            Fin
            <input name="end" type="time" defaultValue="11:00" required />
          </label>
        </div>
        <select name="priority">
          <option>Media</option>
          <option>Alta</option>
          <option>Baja</option>
        </select>
        <textarea name="notes" placeholder="Misión bien redactada: objetivo, pasos, resultado esperado y evidencia" required />
        <label className="auditClose"><input name="requiresPhoto" type="checkbox" defaultChecked /> Exigir foto antes y después de la tarea</label>
        {taskError&&<p className="loginError">{taskError}</p>}
        <button className="primary">Asignar</button>
      </form>}

      {canGovern(user) && <article className="panelCard"><div className="sectionHead"><div><h2>Lugar de trabajo de hoy</h2><span>Auxiliares y Jan reciben los procesos del lugar asignado.</span></div></div><div className="taskList">{locationTargets.map((employee)=>{const assigned=workLocations.find((item)=>item.employeeId===employee.id&&item.date===today)?.location??employee.branch;return <div className="taskRow" key={employee.id}><span><strong>{employee.name}</strong><small>{employee.roleLabel}</small></span><select value={assigned} onChange={(event)=>assignWorkLocation(employee.id,event.target.value as WorkLocation["location"])}><option>Matriz</option><option>Sucursal Centro</option></select></div>;})}</div></article>}

      {isAuxiliary && <article className="panelCard">
        <h2>Mis instrucciones</h2>
        <p>Ejecuta una tarea a la vez, sigue las instrucciones y registra aquí el avance, la evidencia o cualquier impedimento.</p>
        <p className="muted">No puedes asignar, borrar, aprobar ni modificar tareas de otros colaboradores.</p>
      </article>}

      <article className="panelCard">
        <div className="sectionHead">
          <div><h2>Revisión de tareas</h2><span>Asignadas, en proceso, incidencias y terminadas.{canViewAll(user)?` · ${visibleTasks.length} tareas de todo el personal`:""}</span></div>
          <span className="inlineTimes">
            {canViewAll(user) && <select value={reviewEmployee} onChange={(event)=>setReviewEmployee(event.target.value)}><option value="Todos">Todos los colaboradores</option>{collaborators.map((employee)=><option key={employee.id} value={employee.id}>{employee.name}</option>)}</select>}
            <select value={reviewStatus} onChange={(event)=>setReviewStatus(event.target.value)}><option>Todas</option><option>Pendiente</option><option>En proceso</option><option>Completada</option><option>Incidencia</option><option>Pausada</option></select>
          </span>
        </div>
        <div className="taskList">
          {reviewedTasks.map((task) => (
            <div className="taskFollowCard" key={task.id}>
              <div className="sectionHead">
                <span>
                  {canDirectAllTasks ? <input value={task.title} onChange={(event)=>updateTaskPatch(task.id,{title:event.target.value})}/> : <strong>{task.title}</strong>}
                  {canDirectAllTasks ? (
                    <span className="inlineTimes">
                      <select value={task.employeeId} onChange={(event)=>updateTaskPatch(task.id,{employeeId:event.target.value})}>
                        {collaborators.map((employee)=><option key={employee.id} value={employee.id}>{employee.name}</option>)}
                      </select>
                      <select value={task.priority} onChange={(event)=>updateTaskPatch(task.id,{priority:event.target.value as DailyTask["priority"]})}>
                        <option>Alta</option><option>Media</option><option>Baja</option>
                      </select>
                    </span>
                  ) : <small>{collaborators.find((employee) => employee.id === task.employeeId)?.name} · {task.priority}</small>}
                  <small>Asignó {collaborators.find((employee) => employee.id === task.assignedById)?.name ?? task.assignedById}{task.assignedAt ? ` · ${new Date(task.assignedAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}` : ""}</small>
                  {canDirectAllTasks ? <span className="inlineTimes"><input type="time" value={task.start} onChange={(event)=>updateTaskPatch(task.id,{start:event.target.value})}/><input type="time" value={task.end} onChange={(event)=>updateTaskPatch(task.id,{end:event.target.value})}/></span> : <small>{task.start}-{task.end}</small>}
                </span>
                <strong className={task.paused ? "danger" : ""}>{task.status}</strong>
              </div>
              {canDirectAllTasks && <textarea value={task.notes} onChange={(event)=>updateTaskPatch(task.id,{notes:event.target.value})} placeholder="Instrucciones de la tarea"/>}
              <div className="taskFollowGrid">
                <div>
                  <small>Paso actual</small>
                  <strong>{task.currentStep || "Sin paso registrado"}</strong>
                </div>
                <div>
                  <small>Comentario colaborador</small>
                  <span>{task.employeeComment || "--"}</span>
                </div>
                <div>
                  <small>Incidencia</small>
                  <span className={task.incidentNote ? "danger" : ""}>{task.incidentNote || "--"}</span>
                </div>
                <div>
                  <small>Aprobacion</small>
                  <span>{task.approvalStatus || "No requerida"}</span>
                </div>
              </div>
              {task.requiresPhoto && <div className="beforeAfterEvidence"><div><strong>Foto antes</strong>{task.beforeEvidenceCapture?<EvidenceCaptured value={task.beforeEvidenceCapture} label="Antes de tarea" onClear={()=>{}} retakeLabel="" readOnly/>:<p className="muted">Pendiente</p>}</div><div><strong>Foto después</strong>{task.afterEvidenceCapture?<EvidenceCaptured value={task.afterEvidenceCapture} label="Después de tarea" onClear={()=>{}} retakeLabel="" readOnly/>:<p className="muted">Pendiente</p>}</div></div>}
              {isAuxiliary ? <textarea
                value={task.employeeComment ?? ""}
                onChange={(event) => updateTaskPatch(task.id, { employeeComment: event.target.value })}
                placeholder="Reporta avance, evidencia, resultado o impedimento"
              /> : <textarea
                value={task.supervisorComment ?? ""}
                onChange={(event) => updateTaskPatch(task.id, { supervisorComment: event.target.value })}
                placeholder="Comentario, instruccion o seguimiento del superior"
              />}
              <div className="taskActions">
                <select value={task.status} onChange={(event) => updateTaskStatus(task.id, event.target.value as DailyTask["status"])}>
                  {(isAuxiliary ? ["Pendiente", "En proceso", "Completada", "Incidencia"] : ["Pendiente", "En proceso", "Completada", "Incidencia", "Pausada"]).map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
                {!isAuxiliary && <button className="ghost" disabled={!task.paused && task.approvalStatus !== "Pendiente"} onClick={() => approveTask(task.id)}>
                  Aprobar y reanudar
                </button>}
                {!isAuxiliary && (canDirectAllTasks || task.assignedById === user.id) && <button className="ghost danger" onClick={() => deleteTask(task.id)}>
                  Borrar
                </button>}
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

const roleOptions: Role[] = [
  "APODERADA_LEGAL",
  "DIRECTOR",
  "GERENTE_GENERAL",
  "ADMIN_GENERAL",
  "GERENTE_TIENDA",
  "ADMIN_TIENDA",
  "JEFE_AREA",
  "CAJERO",
  "AUXILIAR",
];

function roleLabel(role: Role) {
  return (
    {
      APODERADA_LEGAL: "Apoderada legal",
      DIRECTOR: "Director / Fundador",
      GERENTE_GENERAL: "Gerente general",
      ADMIN_GENERAL: "Administrador general",
      GERENTE_TIENDA: "Gerente de tienda",
      ADMIN_TIENDA: "Administrador de tienda",
      JEFE_AREA: "Jefe de area",
      CAJERO: "Cajero",
      AUXILIAR: "Auxiliar",
    } satisfies Record<Role, string>
  )[role];
}

function EmployeeAccessControl({employee}:{employee:Employee}) {
  const [password,setPassword]=useState("");const [message,setMessage]=useState("");const [saving,setSaving]=useState(false);
  const generate=()=>{const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";const bytes=crypto.getRandomValues(new Uint8Array(12));let value="Xf";for(const byte of bytes)value+=alphabet[byte%alphabet.length];value+="7";setPassword(value);setMessage("Contraseña temporal generada. Entrégala de forma privada.");};
  const apply=async()=>{setSaving(true);setMessage("");try{const result=await manageEmployeeAccess(employee,password);setMessage(result.created?"Cuenta creada. La contraseña se mostrará sólo aquí.":"Contraseña restablecida. Se exigirá cambiarla al entrar.");}catch(error){setMessage(error instanceof Error?error.message:"No se pudo actualizar el acceso.");}finally{setSaving(false);}};
  return <div className="accessRow"><span><strong>{employee.id} · {employee.name}</strong><small>{employee.roleLabel} · {employee.branch}</small></span><input type="text" value={password} onChange={(event)=>setPassword(event.target.value)} placeholder="Contraseña temporal" autoComplete="off"/><button type="button" className="ghost compact" onClick={generate}>Generar</button><button type="button" className="primary compact" disabled={saving||password.length<10} onClick={apply}>{saving?"Guardando...":"Crear / Restablecer"}</button><small className={message.includes("No se pudo")||message.includes("requiere")?"danger":"ok"}>{message}</small></div>;
}

function PasswordChangeView({ onComplete }: { onComplete: (password: string) => Promise<void> }) {
  const [password,setPassword]=useState("");const [confirm,setConfirm]=useState("");const [error,setError]=useState("");const [saving,setSaving]=useState(false);
  const submit=async(event:React.FormEvent)=>{event.preventDefault();if(password!==confirm){setError("Las contraseñas no coinciden.");return;}if(password.length<10||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)){setError("Usa al menos 10 caracteres, mayúscula, minúscula y número.");return;}setSaving(true);setError("");try{await onComplete(password);}catch{setError("No se pudo actualizar la contraseña.");setSaving(false);}};
  return <main className="loginPage"><form className="loginCard" onSubmit={submit}><div className="brand loginBrand"><span className="brandMark">XF</span><div><strong>Cambio obligatorio</strong><small>Protege tu cuenta personal</small></div></div><p>La contraseña temporal sólo sirve para el primer acceso. Crea ahora una contraseña privada que ningún administrador podrá consultar.</p><label>Nueva contraseña<input type="password" value={password} onChange={(event)=>setPassword(event.target.value)} autoComplete="new-password" required/></label><label>Confirmar contraseña<input type="password" value={confirm} onChange={(event)=>setConfirm(event.target.value)} autoComplete="new-password" required/></label>{error&&<p className="loginError">{error}</p>}<button className="primary" disabled={saving}>{saving?"Guardando...":"Cambiar contraseña y entrar"}</button></form></main>;
}

function ExpansionDashboard({ user, collaborators, openings, startOpening, updateOpening }: {
  user:Employee; collaborators:Employee[]; openings:BranchOpening[];
  startOpening:(event:React.FormEvent<HTMLFormElement>)=>void; updateOpening:(opening:BranchOpening)=>void;
}) {
  const active=openings.filter((item)=>item.status!=="Abierta"&&item.status!=="Pausada"); const totalBudget=openings.reduce((sum,item)=>sum+item.investmentBudget,0); const totalActual=openings.reduce((sum,item)=>sum+item.actualInvestment,0);
  const delayed=openings.reduce((sum,item)=>sum+item.steps.filter((step)=>!step.done&&step.dueDate<todayKey()).length,0);
  return <section className="stack"><div className="grid"><Metric label="Proyectos activos" value={String(active.length)} icon={<Building2/>}/><Metric label="Inversión autorizada" value={`$${totalBudget.toLocaleString("es-MX")}`} icon={<WalletCards/>}/><Metric label="Inversión ejercida" value={`$${totalActual.toLocaleString("es-MX")}`} icon={<BriefcaseBusiness/>}/><Metric label="Actividades vencidas" value={String(delayed)} icon={<AlertTriangle/>}/></div>
    {canGovern(user)&&<form className="panelCard form" onSubmit={startOpening}><h2>Nuevo proyecto de sucursal</h2><div className="expansionFormGrid"><label>Nombre<input name="name" placeholder="Sucursal Norte" required/></label><label>Ciudad<input name="city" required/></label><label>Dirección<input name="address" required/></label><label>Fecha objetivo<input name="targetDate" type="date" required/></label><label>Gerente responsable<select name="managerId" required><option value="">Selecciona responsable</option>{collaborators.filter((employee)=>["DIRECTOR","GERENTE_GENERAL","GERENTE_TIENDA","ADMIN_TIENDA"].includes(employee.role)).map((employee)=><option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label><label>Inversión autorizada<input name="investmentBudget" type="number" min="0" step="0.01" required/></label><label>Punto de equilibrio mensual<input name="breakEvenMonthly" type="number" min="0" step="0.01" required/></label></div><textarea name="notes" placeholder="Supuestos, alcance y restricciones"/><button className="primary">Crear plan estándar</button></form>}
    {openings.map((opening)=><ExpansionEditor key={opening.id} opening={opening} collaborators={collaborators} canEdit={canGovern(user)||opening.managerId===user.id} onSave={updateOpening}/>)}{openings.length===0&&<article className="panelCard"><p className="muted">No hay proyectos de apertura. El primer proyecto generará automáticamente el checklist estándar.</p></article>}
  </section>;
}

function ExpansionEditor({opening,collaborators,canEdit,onSave}:{opening:BranchOpening;collaborators:Employee[];canEdit:boolean;onSave:(opening:BranchOpening)=>void}) {
  const [draft,setDraft]=useState(opening);useEffect(()=>setDraft(opening),[opening]); const updateStep=(index:number,changes:Partial<BranchOpening["steps"][number]>)=>setDraft({...draft,steps:draft.steps.map((step,current)=>current===index?{...step,...changes}:step)});
  const completed=draft.steps.filter((step)=>step.done).length;const progress=draft.steps.length?completed/draft.steps.length*100:0;const actual=draft.steps.reduce((sum,step)=>sum+step.actual,0);const committed=draft.steps.reduce((sum,step)=>sum+step.budget,0);
  return <article className="panelCard"><div className="sectionHead"><div><h2>{draft.name} · {draft.city}</h2><span>Objetivo {draft.targetDate} · gerente {collaborators.find((employee)=>employee.id===draft.managerId)?.name||draft.managerId}</span></div><span className={`statusPill ${draft.status==="Abierta"||draft.status==="Lista para abrir"?"ok":draft.status==="Pausada"?"danger":"warn"}`}>{draft.status} · {progress.toFixed(0)}%</span></div><div className="expansionSummary"><span>Autorizado <strong>${draft.investmentBudget.toLocaleString("es-MX")}</strong></span><span>Comprometido <strong>${committed.toLocaleString("es-MX")}</strong></span><span>Ejercido <strong>${actual.toLocaleString("es-MX")}</strong></span><span>Punto equilibrio <strong>${draft.breakEvenMonthly.toLocaleString("es-MX")}/mes</strong></span></div>{canEdit&&<label className="openingStatus">Estado<select value={draft.status} onChange={(event)=>setDraft({...draft,status:event.target.value as BranchOpening["status"]})}><option>Planeación</option><option>En ejecución</option><option>Lista para abrir</option><option>Abierta</option><option>Pausada</option></select></label>}<div className="operationTable expansionTable"><div className="operationRow head"><span>Etapa / actividad</span><span>Responsable</span><span>Fecha límite</span><span>Presupuesto</span><span>Ejercido</span><span>Evidencia</span><span>Listo</span></div>{draft.steps.map((step,index)=><div className="operationRow" key={`${step.stage}-${step.title}`}><span><strong>{step.stage}</strong><small>{step.title}</small></span><select disabled={!canEdit} value={step.responsibleId} onChange={(event)=>updateStep(index,{responsibleId:event.target.value})}><option value="">Sin asignar</option>{collaborators.map((employee)=><option key={employee.id} value={employee.id}>{employee.name}</option>)}</select><input disabled={!canEdit} type="date" value={step.dueDate} onChange={(event)=>updateStep(index,{dueDate:event.target.value})}/><input disabled={!canEdit} type="number" min="0" step="0.01" value={step.budget} onChange={(event)=>updateStep(index,{budget:Number(event.target.value)})}/><input disabled={!canEdit} type="number" min="0" step="0.01" value={step.actual} onChange={(event)=>updateStep(index,{actual:Number(event.target.value)})}/><input disabled={!canEdit} value={step.evidence} onChange={(event)=>updateStep(index,{evidence:event.target.value})} placeholder="Folio, liga o nota"/><input disabled={!canEdit} type="checkbox" checked={step.done} onChange={(event)=>updateStep(index,{done:event.target.checked})}/></div>)}</div>{canEdit&&<button className="primary compact" onClick={()=>onSave(draft)}>Guardar avance</button>}</article>;
}

function AuditDashboard({ user, collaborators, audits, startAudit, updateAudit }: {
  user: Employee; collaborators: Employee[]; audits: ProcessAudit[];
  startAudit: (event: React.FormEvent<HTMLFormElement>) => void; updateAudit: (audit: ProcessAudit) => void;
}) {
  const visible = canViewAll(user) ? audits : audits.filter((item)=>item.auditorId===user.id||item.responsibleId===user.id);
  const openFindings=visible.reduce((sum,audit)=>sum+audit.checks.filter((check)=>check.result==="No cumple"&&!check.closed).length,0);
  const completedChecks=visible.flatMap((audit)=>audit.checks).filter((check)=>check.result!=="Pendiente"&&check.result!=="No aplica");
  const compliance=completedChecks.length?completedChecks.filter((check)=>check.result==="Cumple").length/completedChecks.length*100:0;
  return <section className="stack"><div className="grid"><Metric label="Auditorías abiertas" value={String(visible.filter((item)=>item.status!=="Cerrada").length)} icon={<ShieldCheck/>}/><Metric label="Hallazgos abiertos" value={String(openFindings)} icon={<AlertTriangle/>}/><Metric label="Cumplimiento" value={`${compliance.toFixed(0)}%`} icon={<BarChart3/>}/><Metric label="Auditorías cerradas" value={String(visible.filter((item)=>item.status==="Cerrada").length)} icon={<CheckCircle2/>}/></div>
    {(canGovern(user)||["GERENTE_TIENDA","ADMIN_TIENDA"].includes(user.role))&&<form className="panelCard form" onSubmit={startAudit}><h2>Iniciar auditoría</h2><div className="auditFormGrid"><label>Fecha<input name="date" type="date" defaultValue={todayKey()} required/></label><label>Proceso<select name="processId" required><option value="">Selecciona proceso</option>{processes.map((process)=><option key={process.id} value={process.id}>{process.name}</option>)}</select></label><label>Responsable auditado<select name="responsibleId" required><option value="">Selecciona responsable</option>{collaborators.map((employee)=><option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label><label>Sucursal<select name="branch" defaultValue={user.branch}><option>Corporativo</option><option>Matriz</option><option>Sucursal Centro</option></select></label></div><textarea name="notes" placeholder="Objetivo, alcance u observaciones iniciales"/><button className="primary">Crear checklist de auditoría</button></form>}
    <div className="stack">{visible.map((audit)=><AuditEditor key={audit.id} audit={audit} collaborators={collaborators} canEdit={canGovern(user)||audit.auditorId===user.id} onSave={updateAudit}/>)}{visible.length===0&&<article className="panelCard"><p className="muted">No hay auditorías registradas.</p></article>}</div>
  </section>;
}

function AuditEditor({ audit, collaborators, canEdit, onSave }: { audit: ProcessAudit; collaborators: Employee[]; canEdit: boolean; onSave:(audit:ProcessAudit)=>void }) {
  const [draft,setDraft]=useState(audit); useEffect(()=>setDraft(audit),[audit]);
  const updateCheck=(index:number,changes:Partial<ProcessAudit["checks"][number]>)=>setDraft({...draft,checks:draft.checks.map((check,current)=>current===index?{...check,...changes}:check)});
  const scoreChecks=draft.checks.filter((check)=>check.result!=="Pendiente"&&check.result!=="No aplica"); const score=scoreChecks.length?scoreChecks.filter((check)=>check.result==="Cumple").length/scoreChecks.length*100:0;
  return <article className="panelCard"><div className="sectionHead"><div><h2>{draft.processName}</h2><span>{draft.date} · {draft.branch} · responsable {collaborators.find((employee)=>employee.id===draft.responsibleId)?.name||draft.responsibleId}</span></div><span className={`statusPill ${draft.status==="Cerrada"?"ok":draft.status==="En corrección"?"danger":"warn"}`}>{draft.status} · {score.toFixed(0)}%</span></div><div className="auditChecklist">{draft.checks.map((check,index)=><div className="auditCheck" key={`${check.title}-${index}`}><strong>{index+1}. {check.title}</strong><select disabled={!canEdit} value={check.result} onChange={(event)=>updateCheck(index,{result:event.target.value as typeof check.result})}><option>Pendiente</option><option>Cumple</option><option>No cumple</option><option>No aplica</option></select><input disabled={!canEdit} value={check.finding} onChange={(event)=>updateCheck(index,{finding:event.target.value})} placeholder="Hallazgo o evidencia revisada"/><input disabled={!canEdit} value={check.correctiveAction} onChange={(event)=>updateCheck(index,{correctiveAction:event.target.value})} placeholder="Acción correctiva"/><input disabled={!canEdit} type="date" value={check.dueDate} onChange={(event)=>updateCheck(index,{dueDate:event.target.value})}/><label className="auditClose"><input disabled={!canEdit||check.result!=="No cumple"} type="checkbox" checked={check.closed} onChange={(event)=>updateCheck(index,{closed:event.target.checked})}/> Corregido</label></div>)}</div>{canEdit&&<div className="taskActions"><button className="primary compact" onClick={()=>onSave(draft)}>Guardar auditoría</button></div>}</article>;
}

function KpiDashboard({ user, collaborators, records, saveRecord }: {
  user: Employee; collaborators: Employee[]; records: KpiRecord[];
  saveRecord: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const currentMonth = todayKey().slice(0,7);
  const [month, setMonth] = useState(currentMonth); const [branch, setBranch] = useState("Todas"); const [role, setRole] = useState("TODOS");
  const visible = records.filter((item)=>item.month===month&&(branch==="Todas"||item.branch===branch)&&(role==="TODOS"||item.role===role));
  const compliance = (item: KpiRecord) => item.target <= 0 ? 0 : Math.max(0, Math.min(200, item.direction==="Mayor es mejor" ? item.actual/item.target*100 : item.actual<=0 ? 200 : item.target/item.actual*100));
  const average = visible.length ? visible.reduce((sum,item)=>sum+compliance(item),0)/visible.length : 0;
  const green = visible.filter((item)=>compliance(item)>=100).length; const yellow = visible.filter((item)=>compliance(item)>=85&&compliance(item)<100).length; const red = visible.filter((item)=>compliance(item)<85).length;
  const canManage = canGovern(user)||["GERENTE_TIENDA","ADMIN_TIENDA"].includes(user.role);
  const suggestions = ["Ventas","Margen bruto","Ticket promedio","Exactitud de inventario","Diferencias de inventario","Productos agotados","Rotación de inventario","Gastos sobre ventas","Cotizaciones convertidas","Clientes nuevos","Asistencia","Tareas cumplidas","SLA cumplido","Garantías resueltas","Cuentas vencidas","Conciliación bancaria"];
  return <section className="stack">
    <article className="panelCard"><div className="sectionHead"><div><h2>Tablero de cumplimiento</h2><span>Meta contra resultado real por responsable.</span></div></div><div className="reportFilters"><label>Mes<input type="month" value={month} onChange={(event)=>setMonth(event.target.value)}/></label><label>Sucursal<select value={branch} onChange={(event)=>setBranch(event.target.value)}><option>Todas</option><option>Corporativo</option><option>Matriz</option><option>Sucursal Centro</option></select></label><label>Puesto<select value={role} onChange={(event)=>setRole(event.target.value)}><option value="TODOS">Todos</option>{roleProfiles.map((profile)=><option key={profile.role} value={profile.role}>{roleLabel(profile.role)}</option>)}</select></label></div></article>
    <div className="grid"><Metric label="Cumplimiento promedio" value={`${average.toFixed(0)}%`} icon={<BarChart3/>}/><Metric label="En meta" value={String(green)} icon={<CheckCircle2/>}/><Metric label="En atención" value={String(yellow)} icon={<Clock/>}/><Metric label="En intervención" value={String(red)} icon={<AlertTriangle/>}/></div>
    {canManage&&<form className="panelCard form" onSubmit={saveRecord}><h2>Configurar meta y capturar resultado</h2><div className="kpiFormGrid"><label>Mes<input name="month" type="month" defaultValue={currentMonth} required/></label><label>Indicador<input name="name" list="kpi-suggestions" placeholder="Nombre del KPI" required/><datalist id="kpi-suggestions">{suggestions.map((item)=><option key={item} value={item}/>)}</datalist></label><label>Área<input name="area" placeholder="Ventas, Caja, Inventario..." required/></label><label>Puesto<select name="role" required><option value="TODOS">Todo el equipo</option>{roleProfiles.map((profile)=><option key={profile.role} value={profile.role}>{roleLabel(profile.role)}</option>)}</select></label><label>Responsable<select name="employeeId"><option value="">General del puesto/sucursal</option>{collaborators.map((employee)=><option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label><label>Sucursal<select name="branch" defaultValue={user.branch}><option>Corporativo</option><option>Matriz</option><option>Sucursal Centro</option></select></label><label>Meta<input name="target" type="number" step="0.01" required/></label><label>Resultado real<input name="actual" type="number" step="0.01" defaultValue="0" required/></label><label>Unidad<select name="unit"><option>$</option><option>%</option><option>unidades</option><option>días</option><option>eventos</option><option>puntos</option></select></label><label>Regla<select name="direction"><option>Mayor es mejor</option><option>Menor es mejor</option></select></label><label>Frecuencia<select name="frequency"><option>Mensual</option><option>Semanal</option><option>Diario</option></select></label></div><textarea name="notes" placeholder="Fuente del dato, criterio o explicación"/><button className="primary">Guardar KPI</button></form>}
    <article className="panelCard"><div className="sectionHead"><div><h2>Matriz de KPIs</h2><span>{month} · {branch} · {role==="TODOS"?"Todos los puestos":roleLabel(role as Role)}</span></div><strong>{visible.length} indicadores</strong></div><div className="operationTable kpiTable"><div className="operationRow head"><span>Indicador</span><span>Responsable</span><span>Meta</span><span>Real</span><span>Cumplimiento</span><span>Semáforo</span></div>{visible.map((item)=>{const percent=compliance(item);return <div className="operationRow" key={item.id}><span><strong>{item.name}</strong><small>{item.area} · {item.frequency}</small></span><span>{item.employeeId?collaborators.find((employee)=>employee.id===item.employeeId)?.name||item.employeeId:item.role==="TODOS"?item.branch:roleLabel(item.role)}</span><span>{item.unit==="$"?"$":""}{item.target.toLocaleString("es-MX")}{item.unit==="%"?"%":item.unit!=="$"?` ${item.unit}`:""}</span><span>{item.unit==="$"?"$":""}{item.actual.toLocaleString("es-MX")}{item.unit==="%"?"%":item.unit!=="$"?` ${item.unit}`:""}</span><strong>{percent.toFixed(0)}%</strong><span className={`statusPill ${percent>=100?"success":percent>=85?"warning":"danger"}`}>{percent>=100?"Correcto":percent>=85?"Atención":"Intervención"}</span></div>})}{visible.length===0&&<p className="muted">No hay indicadores capturados para estos filtros.</p>}</div></article>
  </section>;
}

function FinancialDashboard({ user, suppliers, payables, bankAccounts, bankTransactions, monthlyBudgets, addMonthlyBudget }: {
  user: Employee;
  suppliers: Supplier[];
  payables: Payable[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  monthlyBudgets: MonthlyBudget[];
  addMonthlyBudget: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const today = todayKey();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [branch, setBranch] = useState("Todas");
  const inBranch = (itemBranch: string) => branch === "Todas" || itemBranch === branch;
  const movements = bankTransactions.filter((item) => item.date.startsWith(month) && inBranch(item.branch));
  const visiblePayables = payables.filter((item) => inBranch(item.branch));
  const deposits = movements.filter((item) => item.type === "Deposito").reduce((sum, item) => sum + item.amount, 0);
  const payments = movements.filter((item) => item.type === "Pago a proveedor").reduce((sum, item) => sum + item.amount, 0);
  const expenses = movements.filter((item) => item.type === "Gasto operativo").reduce((sum, item) => sum + item.amount, 0);
  const netFlow = deposits - payments - expenses;
  const outstanding = visiblePayables.reduce((sum, item) => sum + Math.max(0, item.amount - item.paidAmount), 0);
  const overdue = visiblePayables.filter((item) => item.status !== "Pagada" && item.dueDate < today);
  const deductible = movements.filter((item) => item.deductible).reduce((sum, item) => sum + item.amount, 0);
  const noInvoice = movements.filter((item) => !item.hasInvoice && item.type !== "Deposito").reduce((sum, item) => sum + item.amount, 0);
  const selectedBudgets = monthlyBudgets.filter((item) => item.month === month && inBranch(item.branch));
  const budgetRows = Array.from(new Set([...selectedBudgets.map((item)=>item.category), ...movements.filter((item)=>item.type!=="Deposito").map((item)=>item.category||"Sin clasificar")])).map((category) => {
    const budget = selectedBudgets.filter((item)=>item.category===category).reduce((sum,item)=>sum+item.amount,0);
    const actual = movements.filter((item)=>item.type!=="Deposito" && (item.category||"Sin clasificar")===category).reduce((sum,item)=>sum+item.amount,0);
    return { category, budget, actual, variance: budget-actual, percentage: budget ? (actual/budget)*100 : actual ? 100 : 0 };
  });
  const totalBudget = selectedBudgets.reduce((sum,item)=>sum+item.amount,0);
  const accountBalance = (account: BankAccount) => account.openingBalance + bankTransactions.reduce((sum, item) => {
    if (!inBranch(item.branch)) return sum;
    if (item.type === "Deposito" && item.bankAccountId === account.id) return sum + item.amount;
    if (item.type === "Transferencia" && item.destinationBankAccountId === account.id) return sum + item.amount;
    if (item.bankAccountId === account.id && item.type !== "Deposito") return sum - item.amount;
    return sum;
  }, 0);
  const bankBalance = bankAccounts.filter((item) => inBranch(item.branch)).reduce((sum, item) => sum + accountBalance(item), 0);
  const aging = [
    { label: "Por vencer o vence hoy", min: -99999, max: 0 },
    { label: "Vencido 1-30 días", min: 1, max: 30 },
    { label: "Vencido 31-60 días", min: 31, max: 60 },
    { label: "Vencido 61-90 días", min: 61, max: 90 },
    { label: "Vencido más de 90 días", min: 91, max: 99999 },
  ].map((bucket) => ({ ...bucket, total: visiblePayables.filter((item) => {
    if (item.status === "Pagada") return false;
    const days = Math.floor((new Date(`${today}T12:00:00`).getTime() - new Date(`${item.dueDate}T12:00:00`).getTime()) / 86400000);
    return days >= bucket.min && days <= bucket.max;
  }).reduce((sum, item) => sum + Math.max(0, item.amount - item.paidAmount), 0) }));
  const projectionStart = new Date(`${today}T12:00:00`);
  const projection = Array.from({ length: 13 }, (_, index) => {
    const start = new Date(projectionStart); start.setDate(start.getDate() + index * 7);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const startKey = start.toISOString().slice(0, 10); const endKey = end.toISOString().slice(0, 10);
    const due = visiblePayables.filter((item) => item.status !== "Pagada" && item.dueDate >= startKey && item.dueDate <= endKey)
      .reduce((sum, item) => sum + Math.max(0, item.amount - item.paidAmount), 0);
    return { label: `Semana ${index + 1}`, range: `${startKey} a ${endKey}`, due };
  });
  return <section className="stack">
    <article className="panelCard noPrint">
      <div className="sectionHead"><div><h2>Vista de dirección</h2><span>Información registrada en bancos, gastos y cuentas por pagar.</span></div><strong>{user.name}</strong></div>
      <div className="reportFilters">
        <label>Mes<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
        <label>Sucursal<select value={branch} onChange={(event) => setBranch(event.target.value)}><option>Todas</option><option>Corporativo</option><option>Matriz</option><option>Sucursal Centro</option></select></label>
      </div>
    </article>
    {(canGovern(user) || ["GERENTE_TIENDA","ADMIN_TIENDA"].includes(user.role)) && <form className="panelCard form" onSubmit={addMonthlyBudget}>
      <div className="sectionHead"><div><h2>Definir presupuesto mensual</h2><span>Si la categoría ya existe para el mes y sucursal, se actualizará.</span></div></div>
      <div className="budgetFormGrid"><input name="month" type="month" defaultValue={month} required/><select name="category" required><option value="">Categoría</option><option>Compra de mercancía</option><option>Pago a proveedores</option><option>Nómina</option><option>Renta</option><option>Servicios</option><option>Impuestos</option><option>Mantenimiento</option><option>Publicidad</option><option>Flete</option><option>Viáticos</option><option>Comisiones bancarias</option><option>Otros gastos</option></select><input name="amount" type="number" min="0" step="0.01" placeholder="Presupuesto" required/><select name="branch" defaultValue={user.branch}><option>Corporativo</option><option>Matriz</option><option>Sucursal Centro</option></select><button className="primary">Guardar presupuesto</button></div>
    </form>}
    <div className="grid">
      <Metric label="Saldo en bancos" value={`$${bankBalance.toLocaleString("es-MX")}`} icon={<WalletCards />} />
      <Metric label="Flujo neto del mes" value={`$${netFlow.toLocaleString("es-MX")}`} icon={<BarChart3 />} />
      <Metric label="Cuentas por pagar" value={`$${outstanding.toLocaleString("es-MX")}`} icon={<BriefcaseBusiness />} />
      <Metric label="Saldo vencido" value={`$${overdue.reduce((sum,item)=>sum+Math.max(0,item.amount-item.paidAmount),0).toLocaleString("es-MX")}`} icon={<AlertTriangle />} />
      <Metric label="Gasto deducible" value={`$${deductible.toLocaleString("es-MX")}`} icon={<FileCheck2 />} />
      <Metric label="Egresos sin factura" value={`$${noInvoice.toLocaleString("es-MX")}`} icon={<FileText />} />
    </div>
    <section className="grid two">
      <article className="panelCard"><h2>Flujo del mes</h2><div className="taskList">
        <div className="taskRow"><span>Depósitos</span><strong className="ok">+${deposits.toLocaleString("es-MX")}</strong></div>
        <div className="taskRow"><span>Pagos a proveedores</span><strong>-${payments.toLocaleString("es-MX")}</strong></div>
        <div className="taskRow"><span>Gastos operativos</span><strong>-${expenses.toLocaleString("es-MX")}</strong></div>
        <div className="taskRow"><span>Resultado neto</span><strong className={netFlow < 0 ? "danger" : "ok"}>${netFlow.toLocaleString("es-MX")}</strong></div>
      </div></article>
      <article className="panelCard"><h2>Antigüedad de saldos</h2><div className="taskList">{aging.map((item)=><div className="taskRow" key={item.label}><span>{item.label}</span><strong>${item.total.toLocaleString("es-MX")}</strong></div>)}</div></article>
    </section>
    <article className="panelCard"><div className="sectionHead"><div><h2>Presupuesto contra gasto real</h2><span>{month} · {branch}</span></div><strong>Presupuesto ${totalBudget.toLocaleString("es-MX")}</strong></div><div className="operationTable budgetTable"><div className="operationRow head"><span>Categoría</span><span>Presupuesto</span><span>Real</span><span>Disponible</span><span>Uso</span></div>{budgetRows.map((item)=><div className="operationRow" key={item.category}><strong>{item.category}</strong><span>${item.budget.toLocaleString("es-MX")}</span><span>${item.actual.toLocaleString("es-MX")}</span><span className={item.variance<0?"danger":"ok"}>${item.variance.toLocaleString("es-MX")}</span><span className={item.percentage>100?"danger":item.percentage>=85?"warn":"ok"}>{item.percentage.toFixed(0)}%</span></div>)}{budgetRows.length===0&&<p className="muted">Aún no hay presupuesto ni gastos clasificados para este periodo.</p>}</div></article>
    <section className="grid two">
      <article className="panelCard"><h2>Saldos por banco</h2><div className="taskList">{bankAccounts.filter((item)=>inBranch(item.branch)).map((item)=><div className="taskRow" key={item.id}><span>{item.bank}<small>{item.accountName} · termina {item.lastFour}</small></span><strong>${accountBalance(item).toLocaleString("es-MX")}</strong></div>)}{bankAccounts.filter((item)=>inBranch(item.branch)).length===0&&<p className="muted">Primero registra las cuentas en Bancos.</p>}</div></article>
      <article className="panelCard"><h2>Alertas de pago</h2><div className="taskList">{overdue.slice(0,8).map((item)=><div className="taskRow" key={item.id}><span>{suppliers.find((supplier)=>supplier.id===item.supplierId)?.name||"Proveedor"}<small>{item.invoice} · venció {item.dueDate}</small></span><strong className="danger">${Math.max(0,item.amount-item.paidAmount).toLocaleString("es-MX")}</strong></div>)}{overdue.length===0&&<p className="muted">Sin facturas vencidas.</p>}</div></article>
    </section>
    <article className="panelCard"><div className="sectionHead"><div><h2>Compromisos de efectivo · 13 semanas</h2><span>Proyección basada en las fechas de vencimiento capturadas.</span></div><strong>Total ${projection.reduce((sum,item)=>sum+item.due,0).toLocaleString("es-MX")}</strong></div><div className="taskList">{projection.map((item)=><div className="taskRow" key={item.label}><span>{item.label}<small>{item.range}</small></span><strong>${item.due.toLocaleString("es-MX")}</strong></div>)}</div></article>
  </section>;
}

function FinanceView({ user, suppliers, payables, addSupplier, addPayable, requestPayablePayment, bankAccounts, bankTransactions, addBankAccount, addBankTransaction, importBankTransactions, toggleBankReconciliation }: {
  user: Employee;
  suppliers: Supplier[];
  payables: Payable[];
  addSupplier: (event: React.FormEvent<HTMLFormElement>) => void;
  addPayable: (event: React.FormEvent<HTMLFormElement>) => void;
  requestPayablePayment: (event: React.FormEvent<HTMLFormElement>) => void;
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  addBankAccount: (event: React.FormEvent<HTMLFormElement>) => void;
  addBankTransaction: (event: React.FormEvent<HTMLFormElement>) => void;
  importBankTransactions: (file: File) => Promise<void>;
  toggleBankReconciliation: (transactionId: string) => void;
}) {
  const canManage = canGovern(user) || ["GERENTE_TIENDA", "ADMIN_TIENDA"].includes(user.role);
  const today = todayKey();
  const [statementAccount, setStatementAccount] = useState("Todas");
  const [statementStatus, setStatementStatus] = useState("Todos");
  const open = payables.filter((item) => item.status !== "Pagada");
  const outstanding = open.reduce((sum, item) => sum + item.amount - item.paidAmount, 0);
  const overdue = open.filter((item) => item.dueDate < today && item.status !== "Pago pendiente");
  const dueSoon = open.filter((item) => {
    const days = (new Date(item.dueDate).getTime() - new Date(today).getTime()) / 86400000;
    return days >= 0 && days <= 7;
  });
  const totalDeposits = bankTransactions.filter((item) => item.type === "Deposito").reduce((sum, item) => sum + item.amount, 0);
  const operatingExpenses = bankTransactions.filter((item) => item.type === "Gasto operativo").reduce((sum, item) => sum + item.amount, 0);
  const deductibleExpenses = bankTransactions.filter((item) => item.deductible).reduce((sum, item) => sum + item.amount, 0);
  const withoutInvoice = bankTransactions.filter((item) => !item.hasInvoice && ["Gasto operativo","Pago a proveedor"].includes(item.type)).reduce((sum, item) => sum + item.amount, 0);
  const visibleTransactions = bankTransactions.filter((item) =>
    (statementAccount === "Todas" || item.bankAccountId === statementAccount || item.destinationBankAccountId === statementAccount) &&
    (statementStatus === "Todos" || (statementStatus === "Conciliados" ? item.reconciled : !item.reconciled))
  );
  const pendingReconciliation = bankTransactions.filter((item) => !item.reconciled).reduce((sum, item) => sum + item.amount, 0);
  const exportStatement = () => {
    const header = ["fecha","tipo","banco","monto","categoria","proveedor_contraparte","factura","tiene_factura","deducible","referencia","conciliado","sucursal"];
    const rows = visibleTransactions.map((item) => [item.date,item.type,bankAccounts.find((bank)=>bank.id===item.bankAccountId)?.bank||"",item.amount,item.category||"Sin clasificar",item.counterparty,item.invoice,item.hasInvoice?"Si":"No",item.deductible?"Si":"No",item.reference,item.reconciled?"Si":"No",item.branch]);
    const csv = [header,...rows].map((row)=>row.map((value)=>`"${String(value).replace(/"/g,'""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`],{type:"text/csv;charset=utf-8"})); link.download = `estado-cuenta-${today}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };
  const balanceFor = (accountId: string) => {
    const account = bankAccounts.find((item) => item.id === accountId);
    return (account?.openingBalance || 0) + bankTransactions.reduce((sum, item) => {
      if (item.type === "Deposito" && item.bankAccountId === accountId) return sum + item.amount;
      if (item.type === "Transferencia" && item.destinationBankAccountId === accountId) return sum + item.amount;
      if (item.bankAccountId === accountId && item.type !== "Deposito") return sum - item.amount;
      return sum;
    }, 0);
  };
  return <section className="stack">
    <div className="grid">
      <Metric label="Saldo por pagar" value={`$${outstanding.toLocaleString("es-MX")}`} icon={<WalletCards />} />
      <Metric label="Facturas abiertas" value={String(open.length)} icon={<FileText />} />
      <Metric label="Vencidas" value={String(overdue.length)} icon={<AlertTriangle />} />
      <Metric label="Vencen en 7 dias" value={String(dueSoon.length)} icon={<CalendarCheck />} />
    </div>
    <div className="grid">
      <Metric label="Depositos registrados" value={`$${totalDeposits.toLocaleString("es-MX")}`} icon={<WalletCards />} />
      <Metric label="Gasto operativo" value={`$${operatingExpenses.toLocaleString("es-MX")}`} icon={<BriefcaseBusiness />} />
      <Metric label="Deducible" value={`$${deductibleExpenses.toLocaleString("es-MX")}`} icon={<FileCheck2 />} />
      <Metric label="Sin factura" value={`$${withoutInvoice.toLocaleString("es-MX")}`} icon={<AlertTriangle />} />
      <Metric label="Pendiente de conciliar" value={`$${pendingReconciliation.toLocaleString("es-MX")}`} icon={<FileCheck2 />} />
    </div>
    {canManage && <section className="grid two" id="bancos">
      <form className="panelCard form" onSubmit={addSupplier}>
        <h2>Alta de proveedor</h2>
        <input name="name" placeholder="Razon social o nombre" required />
        <div className="moneyInputs"><input name="taxId" placeholder="RFC" /><input name="contact" placeholder="Contacto" /></div>
        <div className="moneyInputs"><input name="phone" placeholder="Telefono" /><input name="paymentTermsDays" type="number" min="0" defaultValue="0" placeholder="Dias de credito" /></div>
        <select name="branch" defaultValue={user.branch}><option>Corporativo</option><option>Matriz</option><option>Sucursal Centro</option></select>
        <button className="primary">Guardar proveedor</button>
      </form>
      <form className="panelCard form" onSubmit={addPayable}>
        <h2>Registrar cuenta por pagar</h2>
        <select name="supplierId" required><option value="">Selecciona proveedor</option>{suppliers.filter((s) => s.status === "Activo").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <div className="moneyInputs"><input name="invoice" placeholder="Factura / folio" required /><input name="amount" type="number" min="0.01" step="0.01" placeholder="Importe" required /></div>
        <input name="concept" placeholder="Concepto" required />
        <div className="moneyInputs"><label>Emision<input name="issueDate" type="date" defaultValue={today} required /></label><label>Dias de credito<input name="creditDays" type="number" min="0" defaultValue="30" required /></label></div>
        <label>Vencimiento manual (opcional)<input name="dueDate" type="date" /></label>
        <div className="checkRow"><label><input name="hasInvoice" type="checkbox" defaultChecked /> Tiene factura</label><label><input name="deductible" type="checkbox" /> Es deducible</label></div>
        <select name="branch" defaultValue={user.branch}><option>Corporativo</option><option>Matriz</option><option>Sucursal Centro</option></select>
        <textarea name="notes" placeholder="Orden de compra, recepcion o aclaraciones" />
        <button className="primary">Registrar obligación</button>
      </form>
    </section>}
    {canManage && <form className="panelCard form" onSubmit={requestPayablePayment}>
      <h2>Solicitar pago desde caja</h2>
      <div className="financePaymentGrid">
        <select name="payableId" required><option value="">Cuenta por pagar</option>{open.filter((p) => p.status !== "Pago pendiente").map((p) => <option key={p.id} value={p.id}>{suppliers.find((s) => s.id === p.supplierId)?.name} · {p.invoice} · ${Math.max(0,p.amount-p.paidAmount).toLocaleString("es-MX")}</option>)}</select>
        <input name="amount" type="number" min="0.01" step="0.01" placeholder="Monto" required />
        <select name="paymentMethod"><option>Transferencia</option><option>Efectivo</option><option>Tarjeta</option></select>
        <select name="bankAccountId" required><option value="">Banco de origen</option>{bankAccounts.filter((b) => b.status === "Activa").map((b) => <option key={b.id} value={b.id}>{b.bank} · {b.lastFour}</option>)}</select>
        <input name="folio" placeholder="Folio de autorización" required />
      </div>
      <textarea name="note" placeholder="Motivo y observaciones del pago" required />
      <button className="primary">Enviar a autorización de caja</button>
    </form>}
    <section className="grid two">
      <article className="panelCard"><h2>Proveedores</h2><div className="taskList">{suppliers.length === 0 && <p className="muted">Sin proveedores registrados.</p>}{suppliers.map((s) => <div className="taskRow" key={s.id}><span>{s.name}<small>{s.taxId || "Sin RFC"} · {s.paymentTermsDays} dias de credito · {s.branch}</small></span><strong>{s.status}</strong></div>)}</div></article>
      <article className="panelCard"><h2>Cuentas por pagar</h2><div className="taskList">{payables.length === 0 && <p className="muted">Sin cuentas por pagar.</p>}{payables.map((p) => <div className="taskRow" key={p.id}><span>{suppliers.find((s) => s.id === p.supplierId)?.name || "Proveedor"}<small>{p.invoice} · vence {p.dueDate} · pagado ${p.paidAmount.toLocaleString("es-MX")}</small></span><span><strong>${(p.amount-p.paidAmount).toLocaleString("es-MX")}</strong><small className={p.status === "Pagada" ? "ok" : p.dueDate < today ? "danger" : "warn"}>{p.status}</small></span></div>)}</div></article>
    </section>
    {canManage && <section className="grid two">
      <form className="panelCard form" onSubmit={addBankAccount}>
        <h2>Cuenta bancaria</h2>
        <div className="moneyInputs"><input name="bank" placeholder="Banco" required /><input name="accountName" placeholder="Nombre de la cuenta" required /></div>
        <div className="moneyInputs"><input name="lastFour" maxLength={4} placeholder="Ultimos 4 digitos" required /><input name="openingBalance" type="number" step="0.01" defaultValue="0" placeholder="Saldo inicial" required /></div>
        <select name="branch" defaultValue={user.branch}><option>Corporativo</option><option>Matriz</option><option>Sucursal Centro</option></select>
        <button className="primary">Guardar cuenta</button>
      </form>
      <form className="panelCard form" onSubmit={addBankTransaction}>
        <h2>Deposito o gasto bancario</h2>
        <div className="moneyInputs"><label>Fecha<input name="date" type="date" defaultValue={today} required /></label><select name="type"><option>Deposito</option><option>Gasto operativo</option><option>Transferencia</option></select></div>
        <select name="bankAccountId" required><option value="">Banco origen o receptor</option>{bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.bank} · {b.lastFour}</option>)}</select>
        <select name="destinationBankAccountId"><option value="">Banco destino, sólo transferencias</option>{bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.bank} · {b.lastFour}</option>)}</select>
        <div className="moneyInputs"><input name="amount" type="number" min="0.01" step="0.01" placeholder="Monto" required /><input name="reference" placeholder="Referencia bancaria" required /></div>
        <input name="counterparty" placeholder="Depositante, beneficiario o comercio" required />
        <input name="concept" placeholder="Concepto" required />
        <select name="category" required><option value="">Categoría contable</option><option>Compra de mercancía</option><option>Pago a proveedores</option><option>Nómina</option><option>Renta</option><option>Servicios</option><option>Impuestos</option><option>Mantenimiento</option><option>Publicidad</option><option>Flete</option><option>Viáticos</option><option>Comisiones bancarias</option><option>Otros gastos</option><option>Ingreso por venta</option><option>Aportación de capital</option></select>
        <input name="invoice" placeholder="Factura, si existe" />
        <select name="supplierId"><option value="">Sin proveedor relacionado</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <div className="checkRow"><label><input name="hasInvoice" type="checkbox" /> Tiene factura</label><label><input name="deductible" type="checkbox" /> Es deducible</label></div>
        <select name="branch" defaultValue={user.branch}><option>Corporativo</option><option>Matriz</option><option>Sucursal Centro</option></select>
        <button className="primary">Registrar movimiento</button>
      </form>
    </section>}
    {canManage && <article className="panelCard form">
      <h2>Carga masiva de movimientos</h2>
      <p className="muted">CSV: fecha,tipo,banco,monto,proveedor,factura,concepto,categoria,tiene_factura,deducible,referencia,conciliado,sucursal</p>
      <input type="file" accept=".csv,text/csv" onChange={(event) => { const file=event.target.files?.[0]; if(file) void importBankTransactions(file); }} />
    </article>}
    <section className="grid two">
      <article className="panelCard"><h2>Saldos bancarios</h2><div className="taskList">{bankAccounts.length===0&&<p className="muted">Sin cuentas bancarias.</p>}{bankAccounts.map((b)=><div className="taskRow" key={b.id}><span>{b.bank}<small>{b.accountName} · termina {b.lastFour} · {b.branch}</small></span><strong>${balanceFor(b.id).toLocaleString("es-MX")}</strong></div>)}</div></article>
      <article className="panelCard"><div className="sectionHead"><div><h2>Estado de cuenta</h2><span>Con conciliación bancaria</span></div><button type="button" className="ghost compact" onClick={exportStatement}>Exportar CSV</button></div><div className="statementFilters"><select value={statementAccount} onChange={(event)=>setStatementAccount(event.target.value)}><option>Todas</option>{bankAccounts.map((bank)=><option key={bank.id} value={bank.id}>{bank.bank} · {bank.lastFour}</option>)}</select><select value={statementStatus} onChange={(event)=>setStatementStatus(event.target.value)}><option>Todos</option><option>Conciliados</option><option>Pendientes</option></select></div><div className="taskList">{visibleTransactions.length===0&&<p className="muted">Sin movimientos con estos filtros.</p>}{visibleTransactions.map((t)=><div className="taskRow reconciliationRow" key={t.id}><span>{t.type} · {t.counterparty}<small>{t.date} · {bankAccounts.find((b)=>b.id===t.bankAccountId)?.bank || "Banco"} · {t.category||"Sin clasificar"} · {t.invoice||"Sin factura"} · {t.deductible?"Deducible":"No deducible"}</small></span><span><strong className={t.type==="Deposito"?"ok":""}>{t.type==="Deposito"?"+":"-"}${t.amount.toLocaleString("es-MX")}</strong>{canManage&&<button type="button" className={`ghost compact ${t.reconciled?"":"danger"}`} onClick={()=>toggleBankReconciliation(t.id)}>{t.reconciled?"Conciliado":"Conciliar"}</button>}</span></div>)}</div></article>
    </section>
  </section>;
}

function CashView({
  user,
  cashSessions,
  addCashOpening,
  addCashIncident,
  cashIncidents,
  addCashCut,
  cashCuts,
  reviewCashCut,
  reviewCashIncident,
  collaborators,
}: {
  user: Employee;
  cashSessions: CashSession[];
  addCashOpening: (event: React.FormEvent<HTMLFormElement>) => void;
  addCashIncident: (event: React.FormEvent<HTMLFormElement>) => void;
  cashIncidents: CashIncident[];
  addCashCut: (event: React.FormEvent<HTMLFormElement>) => void;
  cashCuts: CashCut[];
  reviewCashCut: (id: string, status: "Aprobado" | "Rechazado") => void;
  reviewCashIncident: (id: string, status: "Aprobado" | "Rechazado") => void;
  collaborators: Employee[];
}) {
  const todayCuts = cashCuts.filter((cut) => cut.date === todayKey());
  const totalSales = todayCuts.reduce((sum, cut) => sum + cut.erpSales, 0);
  const totalDifference = todayCuts.reduce((sum, cut) => sum + cut.difference, 0);
  const canReview = canGovern(user) || ["GERENTE_TIENDA", "ADMIN_TIENDA"].includes(user.role);
  return (
    <section className="stack">
      <div className="grid">
        <Metric label="Ventas ERP hoy" value={`$${totalSales.toLocaleString("es-MX")}`} icon={<WalletCards />} />
        <Metric label="Cortes capturados" value={String(todayCuts.length)} icon={<FileCheck2 />} />
        <Metric label="Diferencia total" value={`$${totalDifference.toLocaleString("es-MX")}`} icon={<AlertTriangle />} />
        <Metric label="Cortes correctos" value={String(todayCuts.filter((cut) => cut.matches).length)} icon={<CheckCircle2 />} />
      </div>

      <section className="grid two">
        <form className="panelCard form" onSubmit={addCashOpening}>
          <div className="sectionHead">
            <div>
              <h2>1. Apertura de caja</h2>
              <span>El fondo debe contarse y registrarse antes de la primera venta.</span>
            </div>
            <WalletCards className="greenIcon" />
          </div>
          <div className="moneyInputs">
            <label>Fecha<input name="date" type="date" defaultValue={todayKey()} required /></label>
            <label>Sucursal<select name="branch" defaultValue={user.branch}><option>Matriz</option><option>Sucursal Centro</option><option>Corporativo</option></select></label>
          </div>
          <label>Fondo inicial contado<input name="openingFund" type="number" min="0" step="0.01" required /></label>
          <textarea name="notes" placeholder="Billetes, monedas, folio de entrega y observaciones" required />
          <button className="primary">Abrir caja</button>
        </form>
        <article className="panelCard">
          <h2>Sesiones de caja</h2>
          <p className="muted">Una caja debe pasar por Abierta → Cerrada → Aprobada.</p>
          <div className="taskList">
            {cashSessions.length === 0 && <p className="muted">No hay sesiones registradas.</p>}
            {cashSessions.map((session) => (
              <div className="taskRow" key={session.id}>
                <span>{session.branch}<small>{session.date} · Fondo ${session.openingFund.toLocaleString("es-MX")} · {collaborators.find((e) => e.id === session.openedById)?.name}</small></span>
                <strong className={session.status === "Aprobada" ? "ok" : session.status === "Cerrada" ? "warn" : ""}>{session.status}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid two">
        <form className="panelCard form" onSubmit={addCashIncident}>
          <div className="sectionHead"><div><h2>2. Agregar dinero a la caja</h2><span>Ingreso extraordinario distinto del fondo inicial y de las ventas.</span></div><WalletCards className="greenIcon" /></div>
          <input type="hidden" name="type" value="Ingreso adicional de efectivo" />
          <input type="hidden" name="paymentMethod" value="Efectivo" />
          <input type="hidden" name="recipient" value="Caja" />
          <label>Fecha y hora oficial de registro<input value={oaxacaNow()} readOnly /></label>
          <label>Monto agregado<input name="amount" type="number" min="0.01" step="0.01" required /></label>
          <input name="purpose" placeholder="Origen del dinero: cambio, fondo extraordinario, devolución..." required />
          <input name="folio" placeholder="Folio de autorización o referencia" required />
          <textarea name="note" placeholder="Quién entrega, quién recibe, denominaciones y motivo" required />
          <button className="primary">Registrar ingreso a caja</button>
          <p className="muted">Zona horaria: Oaxaca de Juárez, México. Este monto se suma automáticamente al efectivo esperado del corte.</p>
        </form>
        <article className="panelCard"><h2>Ingresos adicionales de hoy</h2><div className="taskList">{cashIncidents.filter((item)=>item.type==="Ingreso adicional de efectivo"&&item.date===oaxacaDateKey()).map((item)=><div className="taskRow" key={item.id}><span>{item.purpose}<small>{new Date(item.createdAt).toLocaleString("es-MX",{timeZone:"America/Mexico_City"})} · {item.folio}</small></span><strong className="ok">+${item.amount.toLocaleString("es-MX")}</strong></div>)}{cashIncidents.filter((item)=>item.type==="Ingreso adicional de efectivo"&&item.date===oaxacaDateKey()).length===0&&<p className="muted">Sin ingresos adicionales hoy.</p>}</div></article>
      </section>

      <section className="grid two">
        <form className="panelCard form" onSubmit={addCashCut}>
          <div className="sectionHead">
            <div>
              <h2>3. Corte y conciliacion</h2>
              <span>Fondo inicial + efectivo de ventas - salidas documentadas</span>
            </div>
          </div>
          <div className="moneyInputs">
            <label>
              Fecha
              <input name="date" type="date" defaultValue={todayKey()} required />
            </label>
            <label>
              Sucursal
              <select name="branch" defaultValue={user.branch}>
                <option>Matriz</option>
                <option>Sucursal Centro</option>
                <option>Corporativo</option>
              </select>
            </label>
          </div>
          <div className="cashGrid">
            <label>
              Ventas segun ERP
              <input name="erpSales" type="number" min="0" step="0.01" required />
            </label>
            <label>
              Cobros con tarjeta
              <input name="cardTotal" type="number" min="0" step="0.01" defaultValue="0" required />
            </label>
            <label>
              Cobros por transferencia
              <input name="transferTotal" type="number" min="0" step="0.01" defaultValue="0" required />
            </label>
            <label>
              Retiros de efectivo
              <input name="withdrawals" type="number" min="0" step="0.01" defaultValue="0" required />
            </label>
            <label>
              Pagos a proveedores
              <input name="providerPayments" type="number" min="0" step="0.01" defaultValue="0" required />
            </label>
            <label>
              Gastos operativos
              <input name="operationalExpenses" type="number" min="0" step="0.01" defaultValue="0" required />
            </label>
            <label>
              Efectivo contado
              <input name="cashCounted" type="number" min="0" step="0.01" required />
            </label>
            <label>
              Incidencia
              <select name="incident">
                <option>No</option>
                <option>Si</option>
              </select>
            </label>
          </div>
          <textarea name="notes" placeholder="Folio de corte, quien revisa, billetes, motivo de diferencia o comentario" />
          <button className="primary">Guardar corte</button>
          <p className="muted">El sistema calcula si coincide. Si hay diferencia, se considera incidencia de caja.</p>
        </form>

        <form className="panelCard form" onSubmit={addCashIncident}>
          <h2>2. Movimientos durante el dia</h2>
          <select name="type">
            <option>Diferencia de caja</option>
            <option>Retiro preventivo caja mayor a $10,000</option>
            <option>Pago a proveedor</option>
            <option>Gasto operativo</option>
            <option>Cobro con tarjeta</option>
            <option>Cobro por transferencia</option>
            <option>Correccion de ticket</option>
          </select>
          <div className="moneyInputs">
            <label>
              Monto
              <input name="amount" type="number" min="0" step="0.01" required />
            </label>
            <label>
              Metodo
              <select name="paymentMethod">
                <option>Efectivo</option>
                <option>Tarjeta</option>
                <option>Transferencia</option>
                <option>Mixto</option>
              </select>
            </label>
          </div>
          <input name="recipient" placeholder="A quien se pago, retiro o cobro" />
          <input name="purpose" placeholder="Para que / concepto" />
          <input name="folio" placeholder="Folio de ticket, factura o autorizacion" required />
          <textarea name="note" placeholder="Motivo, folio, responsable y accion tomada" required />
          <button className="primary">Guardar movimiento</button>
          <p className="muted">Responsable: {user.name}. Las fallas se escalan al gerente general.</p>
        </form>
      </section>

      <section className="grid two">
        <article className="panelCard">
          <h2>Cortes guardados</h2>
          <div className="cashTable">
            <div className="cashRow head">
              <span>Fecha</span>
              <span>Sucursal</span>
              <span>ERP</span>
              <span>Efectivo esperado</span>
              <span>Contado</span>
              <span>Diferencia</span>
              <span>Estado</span>
              <span>Revision</span>
            </div>
            {cashCuts.map((cut) => (
              <div className="cashRow" key={cut.id}>
                <span>{cut.date}</span>
                <span>{cut.branch}</span>
                <strong>${cut.erpSales.toLocaleString("es-MX")}</strong>
                <span>${cut.expectedCash.toLocaleString("es-MX")}</span>
                <span>${cut.cashCounted.toLocaleString("es-MX")}</span>
                <strong className={cut.matches ? "ok" : "danger"}>${cut.difference.toLocaleString("es-MX")}</strong>
                <span className={cut.status === "Aprobado" ? "ok" : cut.status === "Rechazado" ? "danger" : "warn"}>{cut.status || "Pendiente"}</span>
                <span className="cashActions">
                  {canReview && (cut.status || "Pendiente") === "Pendiente" ? <>
                    <button className="ghost" onClick={() => reviewCashCut(cut.id, "Aprobado")}>Aprobar</button>
                    <button className="ghost danger" onClick={() => reviewCashCut(cut.id, "Rechazado")}>Rechazar</button>
                  </> : "--"}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="panelCard">
          <h2>Bitacora de movimientos</h2>
          <div className="taskList">
            {cashIncidents.map((item) => (
              <div className="taskRow" key={item.id}>
                <span>
                  {item.type}
                  <small>
                    {item.folio || "Sin folio"} · {item.paymentMethod || "Sin metodo"} · {item.recipient || "Sin destinatario"} ·{" "}
                    {collaborators.find((employee) => employee.id === item.ownerId)?.name ?? "Sin responsable"}
                  </small>
                </span>
                <span>
                  <strong>${item.amount.toLocaleString("es-MX")}</strong>
                  <small className={item.status === "Aprobado" ? "ok" : item.status === "Rechazado" ? "danger" : "warn"}>{item.status || "Pendiente"}</small>
                  {canReview && (item.status || "Pendiente") === "Pendiente" && <span className="cashActions">
                    <button className="ghost" onClick={() => reviewCashIncident(item.id, "Aprobado")}>Aprobar</button>
                    <button className="ghost danger" onClick={() => reviewCashIncident(item.id, "Rechazado")}>Rechazar</button>
                  </span>}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </section>
  );
}

function RequestsView({
  user,
  collaborators,
  internalRequests,
  addInternalRequest,
  setInternalRequests,
}: {
  user: Employee;
  collaborators: Employee[];
  internalRequests: InternalRequest[];
  addInternalRequest: (event: React.FormEvent<HTMLFormElement>) => void;
  setInternalRequests: (value: InternalRequest[]) => void;
}) {
  const recipients = collaborators.filter((employee) => ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL"].includes(employee.role));
  const visibleRequests = internalRequests.filter((request) => {
    if (request.requestedById === user.id || request.recipientId === user.id) return true;
    if (request.confidentiality === "Confidencial") return false;
    return canGovern(user);
  });
  const updateRequest = (id: string, patch: Partial<InternalRequest>) => {
    setInternalRequests(internalRequests.map((request) => (request.id === id ? { ...request, ...patch } : request)));
  };

  return (
    <section className="grid two">
      <form className="panelCard form" onSubmit={addInternalRequest}>
        <div className="sectionHead">
          <div>
            <h2>Nueva comunicacion directa</h2>
            <span>Para necesidades, quejas, peticiones, reportes o apoyo para trabajar mejor.</span>
          </div>
          <MessageSquare className="greenIcon" />
        </div>
        <div className="moneyInputs">
          <label>
            Tipo
            <select name="type">
              <option>Solicitud</option>
              <option>Queja</option>
              <option>Peticion</option>
              <option>Reporte</option>
            </select>
          </label>
          <label>
            Prioridad
            <select name="priority">
              <option>Media</option>
              <option>Baja</option>
              <option>Alta</option>
              <option>Critica</option>
            </select>
          </label>
        </div>
        <select name="recipientId" required>
          {recipients.map((recipient) => (
            <option key={recipient.id} value={recipient.id}>
              {recipient.name} - {recipient.roleLabel}
            </option>
          ))}
        </select>
        <input name="title" placeholder="Asunto" required />
        <textarea name="message" placeholder="Explica que necesitas, que falta, que ocurrio o que debe revisarse" required />
        <select name="confidentiality">
          <option>Normal</option>
          <option>Confidencial</option>
        </select>
        <button className="primary">Enviar comunicacion</button>
        <p className="muted">
          Queda registrado quien envia, a quien va dirigido y el seguimiento. Esto evita que cualquier puesto se vuelva intocable.
        </p>
      </form>

      <article className="panelCard">
        <div className="sectionHead">
          <div>
            <h2>Bandeja de seguimiento</h2>
            <span>{visibleRequests.length} registros visibles para tu usuario</span>
          </div>
        </div>
        <div className="requestList">
          {visibleRequests.map((request) => {
            const author = collaborators.find((employee) => employee.id === request.requestedById);
            const authorName = request.requestedById === "sistema" ? "Sistema (SLA automatico)" : author?.name ?? "Sin autor";
            const recipient = collaborators.find((employee) => employee.id === request.recipientId);
            const canAnswer = request.recipientId === user.id || canGovern(user);
            const isMine = request.requestedById === user.id;
            const hasResponse = request.response.trim().length > 0;
            const responder = collaborators.find((employee) => employee.id === request.respondedById);
            const answerResponse = (value: string) =>
              updateRequest(request.id, { response: value, respondedAt: new Date().toISOString(), respondedById: user.id });
            return (
              <div className="requestCard" key={request.id}>
                <div className="sectionHead">
                  <div>
                    <strong>
                      {request.type}: {request.title}
                    </strong>
                    <span>
                      De {authorName} para {recipient?.name ?? "Sin destinatario"} · {request.date}
                    </span>
                  </div>
                  <span className={`status ${request.priority === "Critica" ? "dangerText" : ""}`}>{request.priority}</span>
                </div>
                <p>{request.message}</p>
                <small>
                  Estado: {request.status} · {request.confidentiality}
                  {isMine && !canAnswer && (
                    <strong className={hasResponse ? "ok" : "warn"}> · {hasResponse ? "Respondida" : "Esperando respuesta"}</strong>
                  )}
                </small>
                <div className="requestControls">
                  <select
                    disabled={!canAnswer}
                    value={request.status}
                    onChange={(event) => updateRequest(request.id, { status: event.target.value as InternalRequest["status"] })}
                  >
                    <option>Abierta</option>
                    <option>En revision</option>
                    <option>Atendida</option>
                    <option>Cerrada</option>
                  </select>
                  {canAnswer ? (
                    <textarea
                      value={request.response}
                      onChange={(event) => answerResponse(event.target.value)}
                      placeholder="Respuesta para el solicitante: qué procede, cómo continuar o en qué terminó el asunto"
                    />
                  ) : (
                    <div className={`requestResponse ${hasResponse ? "ok" : "muted"}`}>
                      <strong>{hasResponse ? "Respuesta" : "Sin responder todavía"}</strong>
                      <p>{request.response || "El destinatario aún no contesta esta comunicación."}</p>
                      {hasResponse && request.respondedAt && (
                        <small>{responder?.name ?? "Destinatario"} · {new Date(request.respondedAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</small>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {visibleRequests.length === 0 && <p className="muted">Aun no hay comunicaciones registradas para tu usuario.</p>}
        </div>
      </article>
    </section>
  );
}

function ReportsView({
  user,
  collaborators,
  attendance,
  evaluations,
  cashIncidents,
  cashCuts,
  warranties,
  dailyTasks,
  processInstances,
  internalRequests,
  activityRuns,
  suppliers,
  payables,
  bankAccounts,
  bankTransactions,
  monthlyBudgets,
}: {
  user: Employee;
  collaborators: Employee[];
  attendance: Attendance[];
  evaluations: Evaluation[];
  cashIncidents: CashIncident[];
  cashCuts: CashCut[];
  warranties: Warranty[];
  dailyTasks: DailyTask[];
  processInstances: ProcessInstance[];
  internalRequests: InternalRequest[];
  activityRuns: ActivityRun[];
  suppliers: Supplier[];
  payables: Payable[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  monthlyBudgets: MonthlyBudget[];
}) {
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [baseDate, setBaseDate] = useState(todayKey());
  const { start, end, label } = periodRange(period, baseDate);
  const inRange = (date: string) => date >= start && date <= end;
  const filteredAttendance = attendance.filter((entry) => inRange(entry.date));
  const filteredEvaluations = evaluations.filter((entry) => inRange(entry.date));
  const filteredCuts = cashCuts.filter((entry) => inRange(entry.date));
  const filteredCash = cashIncidents.filter((entry) => inRange(entry.date));
  const filteredWarranties = warranties.filter((entry) => inRange(entry.date));
  const filteredTasks = dailyTasks.filter((entry) => inRange(entry.date));
  const filteredProcesses = processInstances.filter((entry) => inRange(entry.date));
  const filteredRequests = internalRequests.filter((entry) => inRange(entry.date));
  const filteredActivityRuns = activityRuns.filter((entry) => inRange(entry.date));
  const filteredBankTransactions = bankTransactions.filter((entry) => inRange(entry.date));
  const filteredBudgets = monthlyBudgets.filter((entry) => entry.month >= start.slice(0,7) && entry.month <= end.slice(0,7));
  const slaOnTime = filteredActivityRuns.filter((entry) => slaStatus(entry) === "Completada").length;
  const slaLate = filteredActivityRuns.filter((entry) => slaStatus(entry) === "Completada con retraso").length;
  const slaBreached = filteredActivityRuns.filter((entry) => !entry.completedAt && slaStatus(entry) === "Vencida").length;
  const sales = filteredCuts.reduce((sum, cut) => sum + cut.erpSales, 0);
  const difference = filteredCuts.reduce((sum, cut) => sum + cut.difference, 0);
  const deposits = filteredBankTransactions.filter((item)=>item.type==="Deposito").reduce((sum,item)=>sum+item.amount,0);
  const financialOutflow = filteredBankTransactions.filter((item)=>item.type!=="Deposito" && item.type!=="Transferencia").reduce((sum,item)=>sum+item.amount,0);
  const payableBalance = payables.reduce((sum,item)=>sum+Math.max(0,item.amount-item.paidAmount),0);
  const budgetTotal = filteredBudgets.reduce((sum,item)=>sum+item.amount,0);
  const avgEval =
    filteredEvaluations.length === 0
      ? 0
      : filteredEvaluations.reduce((sum, entry) => sum + entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length, 0) /
        filteredEvaluations.length;

  return (
    <section className="stack">
      <article className="panelCard noPrint">
        <div className="sectionHead">
          <div>
            <h2>Generar resumen</h2>
            <span>Se puede imprimir o guardar como PDF desde el dialogo de impresion.</span>
          </div>
          <button className="primary compact" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>
        <div className="reportFilters">
          <label>
            Periodo
            <select value={period} onChange={(event) => setPeriod(event.target.value as "day" | "week" | "month")}>
              <option value="day">Dia</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
          </label>
          <label>
            Fecha base
            <input type="date" value={baseDate} onChange={(event) => setBaseDate(event.target.value)} />
          </label>
        </div>
      </article>

      <article className="panelCard reportSheet">
        <div className="reportHeader">
          <div>
            <h2>XOXO Ferreton - Resumen operativo</h2>
            <span>{label}</span>
          </div>
          <strong>Generado por {user.name}</strong>
        </div>
        <div className="reportMetrics">
          <div>
            <span>Ventas ERP</span>
            <strong>${sales.toLocaleString("es-MX")}</strong>
          </div>
          <div>
            <span>Diferencia caja</span>
            <strong>${difference.toLocaleString("es-MX")}</strong>
          </div>
          <div>
            <span>Evaluacion promedio</span>
            <strong>{avgEval.toFixed(1)}</strong>
          </div>
          <div>
            <span>Procesos activos/cerrados</span>
            <strong>{filteredProcesses.length}</strong>
          </div>
          <div>
            <span>SLA a tiempo / con retraso / vencido</span>
            <strong>
              {slaOnTime} / {slaLate} / {slaBreached}
            </strong>
          </div>
          <div><span>Flujo financiero</span><strong>${(deposits-financialOutflow).toLocaleString("es-MX")}</strong></div>
          <div><span>Cuentas por pagar</span><strong>${payableBalance.toLocaleString("es-MX")}</strong></div>
          <div><span>Presupuesto del periodo</span><strong>${budgetTotal.toLocaleString("es-MX")}</strong></div>
        </div>

        <ReportSection title="Finanzas, bancos y comprobación fiscal">
          {bankAccounts.map((account)=><ReportLine key={account.id} left={`${account.bank} · ${account.accountName} · termina ${account.lastFour}`} right={`${account.branch} · saldo inicial $${account.openingBalance.toLocaleString("es-MX")}`} />)}
          {filteredBankTransactions.map((item)=><ReportLine key={item.id} left={`${item.date} · ${item.type} · ${item.counterparty}`} right={`$${item.amount.toLocaleString("es-MX")} · ${item.category||"Sin clasificar"} · ${item.invoice||"Sin factura"} · ${item.deductible?"Deducible":"No deducible"} · ${item.reconciled?"Conciliado":"Pendiente de conciliar"}`} />)}
          {payables.filter((item)=>item.status!=="Pagada").map((item)=><ReportLine key={item.id} left={`${suppliers.find((supplier)=>supplier.id===item.supplierId)?.name||"Proveedor"} · ${item.invoice}`} right={`Vence ${item.dueDate} · saldo $${Math.max(0,item.amount-item.paidAmount).toLocaleString("es-MX")} · ${item.hasInvoice?"Con factura":"Sin factura"}`} />)}
          {filteredBankTransactions.length===0&&payables.filter((item)=>item.status!=="Pagada").length===0&&<p>Sin información financiera en el periodo.</p>}
        </ReportSection>

        <ReportSection title="Presupuesto contra gasto real">
          {filteredBudgets.map((budget)=>{const actual=filteredBankTransactions.filter((item)=>item.type!=="Deposito"&&item.category===budget.category&&item.branch===budget.branch).reduce((sum,item)=>sum+item.amount,0);return <ReportLine key={budget.id} left={`${budget.month} · ${budget.branch} · ${budget.category}`} right={`Presupuesto $${budget.amount.toLocaleString("es-MX")} · real $${actual.toLocaleString("es-MX")} · diferencia $${(budget.amount-actual).toLocaleString("es-MX")}`} />;})}
          {filteredBudgets.length===0&&<p>Sin presupuestos registrados para el periodo.</p>}
        </ReportSection>

        <ReportSection title="Asistencia">
          {filteredAttendance.map((entry) => (
            <ReportLine
              key={`${entry.employeeId}-${entry.date}`}
              left={`${entry.date} · ${collaborators.find((employee) => employee.id === entry.employeeId)?.name ?? entry.employeeId}`}
              right={`Entrada ${entry.in ?? "--"} · Comida ${entry.lunchOut ?? "--"}/${entry.lunchIn ?? "--"} · Salida ${entry.out ?? "--"}`}
            />
          ))}
        </ReportSection>

        <ReportSection title="Caja">
          {filteredCuts.map((cut) => (
            <ReportLine
              key={cut.id}
              left={`${cut.date} · ${cut.branch} · ERP $${cut.erpSales.toLocaleString("es-MX")}`}
              right={`Esperado $${cut.expectedCash.toLocaleString("es-MX")} · Contado $${cut.cashCounted.toLocaleString("es-MX")} · Coincide ${
                cut.matches ? "Si" : "No"
              }`}
            />
          ))}
          {filteredCash.map((item) => (
            <ReportLine
              key={item.id}
              left={`${item.date} · ${item.type} · ${item.recipient || "Sin destinatario"}`}
              right={`$${item.amount.toLocaleString("es-MX")} · ${item.purpose || item.note}`}
            />
          ))}
        </ReportSection>

        <ReportSection title="Evaluaciones, tareas y procesos">
          {filteredEvaluations.map((entry) => (
            <ReportLine
              key={`${entry.employeeId}-${entry.evaluatorId}-${entry.date}`}
              left={`${entry.date} · ${collaborators.find((employee) => employee.id === entry.employeeId)?.name ?? entry.employeeId}`}
              right={`Promedio ${(entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length).toFixed(1)} · Venta $${entry.personalSales.toLocaleString(
                "es-MX",
              )}`}
            />
          ))}
          {filteredTasks.map((task) => (
            <ReportLine
              key={task.id}
              left={`${task.date} · ${task.title}`}
              right={`${collaborators.find((employee) => employee.id === task.employeeId)?.name ?? task.employeeId} · ${task.status} · ${
                task.currentStep || "Sin paso"
              }${task.incidentNote ? ` · Incidencia: ${task.incidentNote}` : ""}`}
            />
          ))}
          {filteredProcesses.map((process) => (
            <ReportLine
              key={process.id}
              left={`${process.date} · ${process.title}`}
              right={`${process.status} · ${process.stepStates.filter((step) => step.done).length}/${process.stepStates.length} pasos`}
            />
          ))}
        </ReportSection>

        <ReportSection title="Cumplimiento de actividades y aseo (SLA)">
          {filteredActivityRuns.map((item) => (
            <ReportLine
              key={item.id}
              left={`${item.date} · ${item.itemType} · ${item.title}`}
              right={`${collaborators.find((employee) => employee.id === item.employeeId)?.name ?? item.employeeId} · Programada ${
                item.scheduledStart
              }-${item.scheduledEnd} · SLA ${item.slaMinutes} min · ${slaStatus(item)}${
                item.escalated ? " · Escalado a supervisor" : ""
              }`}
            />
          ))}
        </ReportSection>

        <ReportSection title="Garantias">
          {filteredWarranties.map((item) => (
            <ReportLine key={item.id} left={`${item.date} · ${item.product} · ${item.provider}`} right={`${item.status} · ${item.reason}`} />
          ))}
        </ReportSection>

        <ReportSection title="Solicitudes, quejas, peticiones y reportes">
          {filteredRequests.map((item) => (
            <ReportLine
              key={item.id}
              left={`${item.date} · ${item.type} · ${item.title}`}
              right={`${collaborators.find((employee) => employee.id === item.requestedById)?.name ?? item.requestedById} -> ${
                collaborators.find((employee) => employee.id === item.recipientId)?.name ?? item.recipientId
              } · ${item.status}`}
            />
          ))}
        </ReportSection>
      </article>
    </section>
  );
}

type EvidenceGalleryItem = {
  id: string;
  employeeId: string;
  kind: "Tarea" | "Actividad" | "Aseo";
  title: string;
  scheduled: string;
  status: string;
  before?: EvidenceCapture;
  after?: EvidenceCapture;
  single?: EvidenceCapture;
};

function evidenceStatusClass(status: string) {
  if (status === "Completada" || status === "Completada con retraso") return "ok";
  if (status === "Vencida" || status === "Incidencia") return "danger";
  return "warn";
}

function EvidenceGalleryView({
  user,
  today,
  collaborators,
  dailyTasks,
  activityRuns,
}: {
  user: Employee;
  today: string;
  collaborators: Employee[];
  dailyTasks: DailyTask[];
  activityRuns: ActivityRun[];
}) {
  const [employeeFilter, setEmployeeFilter] = useState("Todos");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const visibleEmployees = canViewAll(user)
    ? collaborators
    : collaborators.filter((employee) => employee.branch === user.branch || employee.supervisorId === user.id || employee.id === user.id);
  const visibleIds = new Set(visibleEmployees.map((employee) => employee.id));

  const items: EvidenceGalleryItem[] = [
    ...dailyTasks
      .filter((task) => task.date === today && task.requiresPhoto && visibleIds.has(task.employeeId))
      .map((task) => ({
        id: task.id, employeeId: task.employeeId, kind: "Tarea" as const, title: task.title,
        scheduled: `${task.start}-${task.end}`, status: task.status,
        before: task.beforeEvidenceCapture, after: task.afterEvidenceCapture,
      })),
    ...activityRuns
      .filter((run) => run.date === today && run.evidence && run.evidence !== "none" && visibleIds.has(run.employeeId))
      .map((run) => ({
        id: run.id, employeeId: run.employeeId, kind: run.itemType, title: run.title,
        scheduled: `${run.scheduledStart}-${run.scheduledEnd}`, status: run.status,
        before: run.beforeEvidenceCapture, after: run.afterEvidenceCapture, single: run.evidenceCapture,
      })),
  ];

  const withPhotos = items.filter((item) => item.before || item.after || item.single);
  const missingPhotos = items.filter((item) => !item.before && !item.after && !item.single);
  const filteredByEmployee = (list: EvidenceGalleryItem[]) => list.filter((item) => employeeFilter === "Todos" || item.employeeId === employeeFilter);
  const shown = filteredByEmployee(onlyMissing ? missingPhotos : withPhotos);

  return (
    <section className="stack">
      <article className="panelCard">
        <div className="sectionHead">
          <div>
            <h2>Evidencia fotográfica del día</h2>
            <span>Tareas y actividades que requieren foto, con lo que cada colaborador subió hoy.</span>
          </div>
          <span className="inlineTimes">
            <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
              <option value="Todos">Todos los colaboradores</option>
              {visibleEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
            <select value={onlyMissing ? "faltantes" : "con-foto"} onChange={(event) => setOnlyMissing(event.target.value === "faltantes")}>
              <option value="con-foto">Con evidencia subida ({filteredByEmployee(withPhotos).length})</option>
              <option value="faltantes">Evidencia pendiente ({filteredByEmployee(missingPhotos).length})</option>
            </select>
          </span>
        </div>
        {shown.length === 0 && <p className="muted">{onlyMissing ? "No hay evidencia pendiente hoy." : "Aún no hay fotos subidas hoy."}</p>}
        <div className="evidenceGallery">
          {shown.map((item) => (
            <article className="evidenceGalleryCard" key={`${item.kind}-${item.id}`}>
              <div className="sectionHead">
                <div>
                  <strong>{collaborators.find((employee) => employee.id === item.employeeId)?.name ?? item.employeeId}</strong>
                  <small>{item.kind} · {item.title} · {item.scheduled}</small>
                </div>
                <span className={`statusPill ${evidenceStatusClass(item.status)}`}>{item.status}</span>
              </div>
              {(item.before || item.after) && (
                <div className="beforeAfterEvidence">
                  <div><strong>Antes</strong>{item.before ? <EvidenceCaptured value={item.before} label="Antes" onClear={() => {}} retakeLabel="" readOnly /> : <p className="muted">Pendiente</p>}</div>
                  <div><strong>Después</strong>{item.after ? <EvidenceCaptured value={item.after} label="Después" onClear={() => {}} retakeLabel="" readOnly /> : <p className="muted">Pendiente</p>}</div>
                </div>
              )}
              {item.single && <EvidenceCaptured value={item.single} label={item.title} onClear={() => {}} retakeLabel="" readOnly />}
              {!item.before && !item.after && !item.single && <p className="danger">Sin evidencia subida todavía.</p>}
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}

function GuideView() {
  const sections = [
    {
      title: "1. Entrada diaria",
      items: [
        "Selecciona tu numero de colaborador en la barra lateral.",
        "Entra a Registro diario y marca entrada, salida a comida, regreso de comida y salida.",
        "Revisa ahi mismo tu aseo asignado, actividades programadas y tareas especiales.",
      ],
    },
    {
      title: "2. Colaboradores y organigrama",
      items: [
        "Directivos agregan o editan colaboradores desde Colaboradores.",
        "Al agregar una persona, el sistema la integra al usuario, horarios, organigrama, evaluaciones y tareas.",
        "El organigrama se genera con el superior inmediato asignado a cada colaborador.",
      ],
    },
    {
      title: "3. Procesos",
      items: [
        "En Procesos se activan actividades como recepcion de mercancia, compras, garantias, devoluciones o caja.",
        "Cada proceso tiene pasos obligatorios y evidencia requerida.",
        "Si no se cumple, se marca incidencia y se notifica al gerente general.",
      ],
    },
    {
      title: "4. Caja",
      items: [
        "Captura ventas segun ERP, tarjeta, transferencia, retiros, pagos, gastos y efectivo contado.",
        "El sistema calcula efectivo esperado, diferencia y si coincide.",
        "Registra aparte retiros, pagos e incidencias con monto, destinatario, concepto y metodo.",
      ],
    },
    {
      title: "5. Evaluacion e incentivos",
      items: [
        "Los superiores evalúan a sus equipos con la escala diaria.",
        "El sistema calcula promedio e incentivo sugerido de 1% a 3% segun desempeño y venta.",
        "La evaluacion queda guardada por colaborador y por fecha.",
      ],
    },
    {
      title: "6. Solicitudes y reportes internos",
      items: [
        "Todo colaborador puede enviar solicitud, queja, peticion o reporte.",
        "Puede dirigirlo a Apoderada Legal, Director o Gerente General.",
        "El destinatario responde, cambia estado y deja seguimiento registrado.",
      ],
    },
    {
      title: "7. Reportes imprimibles",
      items: [
        "En Reportes selecciona dia, semana o mes.",
        "El sistema junta asistencia, caja, evaluaciones, procesos, tareas, garantias y solicitudes.",
        "Usa Imprimir / PDF para guardar o compartir el resumen.",
      ],
    },
  ];

  return (
    <section className="stack">
      <article className="panelCard guideHero">
        <BookOpen />
        <div>
          <h2>Instructivo rapido del sistema</h2>
          <p>
            El sistema funciona como control diario: cada registro alimenta reportes, evaluaciones, caja, procesos y comunicacion interna.
          </p>
        </div>
      </article>
      <div className="guideGrid">
        {sections.map((section) => (
          <article className="panelCard" key={section.title}>
            <h2>{section.title}</h2>
            <ul className="guideList">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="reportSection">
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function ReportLine({ left, right }: { left: string; right: string }) {
  return (
    <div className="reportLine">
      <span>{left}</span>
      <strong>{right}</strong>
    </div>
  );
}

function periodRange(period: "day" | "week" | "month", baseDate: string) {
  const base = new Date(`${baseDate}T00:00:00`);
  if (period === "day") return { start: baseDate, end: baseDate, label: `Dia ${baseDate}` };
  if (period === "week") {
    const startDate = new Date(base);
    const day = (base.getDay() + 6) % 7;
    startDate.setDate(base.getDate() - day);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    return { start: dateKey(startDate), end: dateKey(endDate), label: `Semana ${dateKey(startDate)} a ${dateKey(endDate)}` };
  }
  const startDate = new Date(base.getFullYear(), base.getMonth(), 1);
  const endDate = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { start: dateKey(startDate), end: dateKey(endDate), label: `Mes ${dateKey(startDate)} a ${dateKey(endDate)}` };
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function WarrantyView({
  user,
  collaborators,
  addWarranty,
  updateWarranty,
  warranties,
}: {
  user: Employee;
  collaborators: Employee[];
  addWarranty: (event: React.FormEvent<HTMLFormElement>) => void;
  updateWarranty: (warranty: Warranty, action: string, note: string) => void;
  warranties: Warranty[];
}) {
  const canResolve=canGovern(user)||["GERENTE_TIENDA","ADMIN_TIENDA"].includes(user.role); const visible=canViewAll(user)?warranties:warranties.filter((item)=>item.branch===user.branch||item.ownerId===user.id);
  return (
    <section className="stack">
      <div className="grid"><Metric label="Casos abiertos" value={String(visible.filter((item)=>!["Resuelta","Rechazada"].includes(item.status)).length)} icon={<ShieldCheck/>}/><Metric label="Esperando proveedor" value={String(visible.filter((item)=>item.status==="Esperando proveedor").length)} icon={<Clock/>}/><Metric label="Soluciones autorizadas" value={String(visible.filter((item)=>item.status==="Solución autorizada").length)} icon={<CheckCircle2/>}/><Metric label="Casos resueltos" value={String(visible.filter((item)=>item.status==="Resuelta").length)} icon={<FileCheck2/>}/></div>
      <section className="grid two">
      <form className="panelCard form" onSubmit={addWarranty}>
        <h2>Recibir garantía</h2>
        <div className="moneyInputs"><input name="customer" placeholder="Cliente" required/><input name="phone" placeholder="Teléfono" required/></div>
        <div className="moneyInputs"><input name="ticket" placeholder="Ticket de compra" required/><label>Fecha de compra<input name="purchaseDate" type="date" required/></label></div>
        <input name="provider" placeholder="Proveedor" required />
        <input name="product" placeholder="Producto / codigo" required />
        <select name="defectType" required><option value="">Tipo de defecto</option><option>Defecto de fábrica</option><option>Pieza faltante</option><option>Pieza rota o fragmentada</option><option>Deformación</option><option>Fragilidad anormal</option><option>Posible mal uso</option><option>Instalación incorrecta</option><option>Desgaste natural</option><option>Otro</option></select>
        <textarea name="reason" placeholder="Descripción completa del problema y condición física" required />
        <select name="branch" defaultValue={user.branch}><option>Corporativo</option><option>Matriz</option><option>Sucursal Centro</option></select>
        <button className="primary">Abrir garantia</button>
        <p className="muted">Jefe de área recibe e inspecciona. Gerencia autoriza la solución. Caja no autoriza garantías.</p>
      </form>
      <article className="panelCard">
        <h2>Ruta obligatoria</h2>
        <div className="taskList">
          {["1. Recibir sin discutir ni culpar","2. Inspeccionar y clasificar el defecto","3. Registrar antes de cualquier acción","4. Notificar internamente a gerencia","5. Dar respuesta inicial al cliente","6. Notificar al proveedor con evidencia","7. Resguardar y etiquetar el producto","8. Cerrar sólo con reposición, nota de crédito, reparación, cambio, devolución o rechazo documentado"].map((item)=><div className="taskRow" key={item}><span>{item}</span></div>)}
        </div>
      </article>
      </section>
      <div className="stack">{visible.map((item)=><WarrantyEditor key={item.id} warranty={item} collaborators={collaborators} canResolve={canResolve} canWork={canResolve||item.ownerId===user.id||user.id==="010"} onSave={updateWarranty}/>)}{visible.length===0&&<article className="panelCard"><p className="muted">Sin garantías registradas.</p></article>}</div>
    </section>
  );
}

function WarrantyEditor({warranty,collaborators,canResolve,canWork,onSave}:{warranty:Warranty;collaborators:Employee[];canResolve:boolean;canWork:boolean;onSave:(warranty:Warranty,action:string,note:string)=>void}) {
  const [draft,setDraft]=useState(warranty);const [note,setNote]=useState("");useEffect(()=>setDraft(warranty),[warranty]);const terminal=["Resuelta","Rechazada"].includes(draft.status);
  return <article className="panelCard"><div className="sectionHead"><div><h2>{draft.product} · {draft.customer}</h2><span>{draft.ticket} · {draft.provider} · {draft.branch} · abierto por {collaborators.find((person)=>person.id===draft.ownerId)?.name||draft.ownerId}</span></div><span className={`statusPill ${terminal?"ok":draft.status==="Esperando proveedor"?"warn":"muted"}`}>{draft.status}</span></div><div className="warrantyGrid"><label>Procede<select disabled={!canResolve||terminal} value={draft.eligible} onChange={(event)=>setDraft({...draft,eligible:event.target.value as Warranty["eligible"]})}><option>Pendiente</option><option>Sí</option><option>No</option></select></label><label>Estado<select disabled={!canWork||terminal} value={draft.status} onChange={(event)=>setDraft({...draft,status:event.target.value as Warranty["status"]})}><option>Recibida</option><option>En inspección</option><option>Esperando proveedor</option><option>Solución autorizada</option>{canResolve&&<option>Resuelta</option>}{canResolve&&<option>Rechazada</option>}</select></label><label>Folio proveedor<input disabled={!canWork||terminal} value={draft.supplierFolio} onChange={(event)=>setDraft({...draft,supplierFolio:event.target.value})}/></label><label>Solución<select disabled={!canResolve||terminal} value={draft.solution} onChange={(event)=>setDraft({...draft,solution:event.target.value as Warranty["solution"]})}><option>Pendiente</option><option>Reposición</option><option>Nota de crédito</option><option>Reparación</option><option>Cambio equivalente</option><option>Devolución</option><option>Rechazo</option></select></label><label>Referencia de solución<input disabled={!canResolve||terminal} value={draft.resolutionReference} onChange={(event)=>setDraft({...draft,resolutionReference:event.target.value})} placeholder="Folio nota/crédito/reposición"/></label><label>Monto<input disabled={!canResolve||terminal} type="number" min="0" step="0.01" value={draft.resolutionAmount} onChange={(event)=>setDraft({...draft,resolutionAmount:Number(event.target.value)})}/></label><label>Producto de reemplazo<input disabled={!canResolve||terminal} value={draft.replacementProduct} onChange={(event)=>setDraft({...draft,replacementProduct:event.target.value})}/></label></div><p><strong>Defecto:</strong> {draft.defectType} · {draft.reason}</p>{canWork&&!terminal&&<div className="warrantyAction"><textarea value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Seguimiento, respuesta del proveedor o explicación de la solución"/><button className="primary compact" disabled={!note.trim()||(["Resuelta","Rechazada"].includes(draft.status)&&draft.solution==="Pendiente")} onClick={()=>{onSave(draft,"Actualización de garantía",note);setNote("");}}>Guardar seguimiento</button></div>}<div className="taskList warrantyTimeline">{(draft.timeline||[]).slice().reverse().map((event,index)=><div className="taskRow" key={`${event.at}-${index}`}><span>{event.action}<small>{new Date(event.at).toLocaleString("es-MX")} · {collaborators.find((person)=>person.id===event.byId)?.name||event.byId}</small></span><strong>{event.note}</strong></div>)}</div></article>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <article className="metric">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

function SequenceCard({ sequence, location }: { sequence: ReturnType<typeof workSequenceFor>; location: string }) {
  const item = (label: string, entry: ReturnType<typeof workSequenceFor>["current"]) => <div className="taskRow"><span>{label}<small>{entry ? `${entry.start}-${entry.end} · ${entry.kind}` : "Sin actividad"}</small></span><strong>{entry?.title ?? "--"}</strong></div>;
  return <article className="wide panelCard"><div className="sectionHead"><div><h2>Mi secuencia de trabajo</h2><span>{location} · actividad anterior, actual y siguiente según horario</span></div></div><div className="taskList">{item("Anterior",sequence.previous)}{item("Ahora",sequence.current)}{item("Siguiente",sequence.next)}</div></article>;
}

function DailyContinuityCard({ sequence }: { sequence: ReturnType<typeof workSequenceFor> }) {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const gaps = sequence.entries.slice(1).flatMap((entry, index) => {
    const prior = sequence.entries[index];
    const gap = timeToMinutes(entry.start) - timeToMinutes(prior.end);
    return gap > 0 ? [{ start: prior.end, end: entry.start, minutes: gap }] : [];
  });
  return <article className="wide panelCard"><div className="sectionHead"><div><h2>Agenda completa y continuidad</h2><span>Al terminar una actividad continúa inmediatamente con la siguiente.</span></div><strong className={gaps.length ? "warn" : "ok"}>{gaps.length ? `${gaps.length} espacio(s) por cubrir` : "Agenda continua"}</strong></div><div className="taskList">{sequence.entries.map((entry)=>{const start=timeToMinutes(entry.start);const end=timeToMinutes(entry.end);const state=minutes>=end?"Horario concluido":minutes>=start&&minutes<end?"Ahora":sequence.next?.id===entry.id?"Siguiente":"Programada";return <div className={`taskRow continuityRow ${state==="Ahora"?"currentActivity":""}`} key={`${entry.kind}-${entry.id}`}><span><strong>{entry.start}-{entry.end}</strong><small>{entry.kind} · {entry.status}</small></span><span>{entry.title}</span><strong>{state}</strong></div>;})}{sequence.entries.length===0&&<p className="muted">Aún no existe una agenda para este lugar. Reporta a tu jefe antes de iniciar para evitar tiempo muerto.</p>}</div>{gaps.length>0&&<div className="gapWarnings"><strong>Espacios sin actividad programada:</strong>{gaps.map((gap)=><span key={`${gap.start}-${gap.end}`}>{gap.start}-{gap.end} ({gap.minutes} min)</span>)}</div>}</article>;
}

function StoreOpeningBoard({user,today,cashSessions,cashCuts,checks,attendance,collaborators,onUpdate,onOpenCash}:{user:Employee;today:string;cashSessions:CashSession[];cashCuts:CashCut[];checks:StoreOpeningCheck[];attendance:Attendance[];collaborators:Employee[];onUpdate:(branch:StoreOpeningCheck["branch"],patch:Partial<StoreOpeningCheck>)=>void;onOpenCash:()=>void}) {
  const branches: StoreOpeningCheck["branch"][] = ["Matriz", "Sucursal Centro"];

  // Autorreparación: si una caja se abrió antes de que existiera cashOpenConfirmedAt (o el
  // reflejo se perdió), quien SÍ tiene permiso de Supabase para leer cash_session_records
  // (gerencia/dirección) lo vuelve a guardar en el checklist apenas lo detecta, para que el
  // resto del personal (que no tiene ese permiso) deje de ver "tienda cerrada" por error.
  const backfilled = useRef<Set<string>>(new Set());
  useEffect(() => {
    branches.forEach((branch) => {
      const id = `${today}-${branch}`;
      const check = checks.find((item) => item.id === id);
      const realOpenSession = cashSessions.find((session) => session.branch === branch && session.date === today && ["Abierta", "Cerrada", "Aprobada"].includes(session.status));
      if (realOpenSession && !check?.cashOpenConfirmedAt && !backfilled.current.has(id)) {
        backfilled.current.add(id);
        onUpdate(branch, { cashOpenConfirmedAt: realOpenSession.openedAt, cashOpenConfirmedById: realOpenSession.openedById });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashSessions, checks, today]);

  return (
    <article className="wide panelCard storeOpeningBoard">
      <div className="sectionHead">
        <div>
          <h2>Estado de apertura y cierre de tiendas</h2>
          <span>Gerente de tienda autoriza → cajero autoriza → con ambas, indicación para todo el personal de abrir/cerrar cortinas y puertas. Apertura puntual sólo entre 8:00 y 8:15.</span>
        </div>
      </div>
      <div className="openingCards">
        {branches.map((branch) => {
          const check = checks.find((item) => item.id === `${today}-${branch}`) ?? { id: `${today}-${branch}`, branch, date: today, minimumStaff: false, systemsReady: false, processComplete: false };
          const canManage = canAuthorizeAsManager(user, branch);
          const canCashier = canAuthorizeAsCashier(user, branch);
          // cashSessions viene de una tabla con permisos por sucursal/dueño: un auxiliar o
          // una cajera de la otra caja puede no tener acceso a esa fila aunque la tienda ya
          // haya abierto. cashOpenConfirmedAt (guardado en el checklist) es visible para
          // todos y sirve de respaldo para que a nadie le aparezca "tienda cerrada" por error.
          const cashOpen = cashSessions.some((session) => session.branch === branch && session.date === today && ["Abierta", "Cerrada", "Aprobada"].includes(session.status)) || Boolean(check.cashOpenConfirmedAt);
          const branchStaff = collaborators.filter((employee) => employee.branch === branch);
          const branchAttendance = attendance.filter((entry) => entry.date === today && entry.in && branchStaff.some((employee) => employee.id === entry.employeeId));
          const staffPresent = branchAttendance.length;

          // ---- Apertura ----
          // "opened" se confía directamente a openedAt (el momento ya confirmado), sin
          // volver a exigir los pasos del checklist: si se agregan pasos nuevos más adelante,
          // una tienda que ya quedó abierta hoy no debe "recerrarse" sola en las pantallas de
          // quienes no vuelvan a pasar por ese paso. readyToOpenDoors sólo gatea el botón
          // mientras la tienda sigue sin abrir.
          const managerAuthorized = Boolean(check.managerAuthorizedAt);
          const cashierAuthorized = cashOpen && Boolean(check.erpReady);
          const readyToOpenDoors = managerAuthorized && cashierAuthorized && check.minimumStaff && check.systemsReady && check.processComplete;
          const doorsOpen = Boolean(check.doorsOpenedAt);
          const opened = Boolean(check.openedAt);
          const onTime = opened ? (() => { const minutes = minutesOfDayMx(check.openedAt!); return minutes >= OPENING_WINDOW_START && minutes <= OPENING_WINDOW_END; })() : false;

          // ---- Cierre ----
          const managerClosingAuthorized = Boolean(check.managerClosingAuthorizedAt);
          const cashCutSubmitted = cashCuts.some((cut) => cut.branch === branch && cut.date === today);
          const cashierClosingAuthorized = cashCutSubmitted && Boolean(check.cashierClosingAuthorizedAt);
          const readyToClose = managerClosingAuthorized && cashierClosingAuthorized;
          const closed = Boolean(check.closedAt);

          const resetOpening = { managerAuthorizedAt: undefined, managerAuthorizedById: undefined, openedAt: undefined, openedById: undefined, doorsOpenedAt: undefined, doorsOpenedById: undefined };

          return (
            <div className={`openingCard ${opened ? "opened" : ""} ${closed ? "closedCard" : ""}`} key={branch}>
              <div className="sectionHead">
                <div>
                  <h3>{branch}</h3>
                  <span>{closed ? `Cerrada ${new Date(check.closedAt!).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" })}` : opened ? `Abierta ${new Date(check.openedAt!).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" })}` : "Pendiente de validación"}</span>
                </div>
                <strong className={`statusPill ${closed ? "muted" : opened ? "ok" : "warn"}`}>{closed ? "TIENDA CERRADA · FIN DEL DÍA" : opened ? "TIENDA ABIERTA" : "TIENDA CERRADA"}</strong>
              </div>

              <strong className="openingSectionLabel">Apertura</strong>
              <div className="openingStep">
                <label><input type="checkbox" checked={managerAuthorized} readOnly /> 1. Gerente de tienda autoriza apertura {managerAuthorized && <small>{new Date(check.managerAuthorizedAt!).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" })} · {collaborators.find((employee) => employee.id === check.managerAuthorizedById)?.name ?? check.managerAuthorizedById}</small>}</label>
                {!managerAuthorized && canManage && !opened && <button className="ghost compact" onClick={() => onUpdate(branch, { managerAuthorizedAt: new Date().toISOString(), managerAuthorizedById: user.id })}>Autorizar apertura</button>}
              </div>

              <div className="openingStep">
                <label><input type="checkbox" checked={check.minimumStaff} disabled={!canManage || opened} onChange={(event) => onUpdate(branch, { minimumStaff: event.target.checked, ...resetOpening })} /> Colaboradores registrados en el sistema <small>({staffPresent}/{branchStaff.length} entradas registradas)</small></label>
                <div className="openingStaffList">
                  {branchStaff.map((employee) => {
                    const entry = branchAttendance.find((item) => item.employeeId === employee.id);
                    return <span key={employee.id} className={entry ? "ok" : "muted"}>{employee.name}: {entry?.in ?? "pendiente"}</span>;
                  })}
                </div>
              </div>

              <div className="openingStep">
                <label><input type="checkbox" checked={cashOpen} readOnly /> Caja abierta por cajero/encargado</label>
                {!cashOpen && canCashier && <button className="ghost compact" onClick={onOpenCash}>Ir a abrir caja</button>}
                <label><input type="checkbox" checked={Boolean(check.erpReady)} disabled={!canCashier || !cashOpen || !managerAuthorized || opened} onChange={(event) => onUpdate(branch, { erpReady: event.target.checked, cashierAuthorizedAt: event.target.checked ? new Date().toISOString() : undefined, cashierAuthorizedById: event.target.checked ? user.id : undefined, openedAt: undefined, openedById: undefined, doorsOpenedAt: undefined, doorsOpenedById: undefined })} /> 2. Cajero autoriza apertura (caja + sistema ERP Visorus) {check.erpReady && check.cashierAuthorizedAt && <small>{new Date(check.cashierAuthorizedAt).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" })} · {collaborators.find((employee) => employee.id === check.cashierAuthorizedById)?.name ?? check.cashierAuthorizedById}</small>}</label>
              </div>

              <div className="openingStep">
                <label><input type="checkbox" checked={check.systemsReady} disabled={!canManage || opened} onChange={(event) => onUpdate(branch, { systemsReady: event.target.checked, ...resetOpening })} /> Sistema, POS, impresora e internet funcionales</label>
                <label><input type="checkbox" checked={check.processComplete} disabled={!canManage || opened} onChange={(event) => onUpdate(branch, { processComplete: event.target.checked, ...resetOpening })} /> Proceso completo de seguridad y apertura</label>
              </div>

              {managerAuthorized && cashierAuthorized && !doorsOpen && (
                <p className="ok">🔓 Indicación para todo el personal: abrir cortinas y puertas.</p>
              )}
              {!opened && canManage && <button className="primary" disabled={!readyToOpenDoors} onClick={() => onUpdate(branch, { doorsOpenedAt: new Date().toISOString(), doorsOpenedById: user.id, openedAt: new Date().toISOString(), openedById: user.id })}>3. Confirmar cortinas y puertas abiertas</button>}
              {opened && (
                <p className={onTime ? "ok" : "warn"}>
                  Abrió {collaborators.find((employee) => employee.id === check.doorsOpenedById)?.name ?? check.doorsOpenedById}
                  {onTime ? " · Apertura puntual (8:00-8:15): se reconoció con +1 punto a quien participó y al personal ya registrado." : " · Apertura fuera de la ventana 8:00-8:15: no aplica reconocimiento."}
                </p>
              )}

              {opened && !closed && (
                <>
                  <strong className="openingSectionLabel">Cierre</strong>
                  <div className="openingStep">
                    <label><input type="checkbox" checked={managerClosingAuthorized} readOnly /> 1. Gerente de tienda autoriza cierre {managerClosingAuthorized && <small>{new Date(check.managerClosingAuthorizedAt!).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" })} · {collaborators.find((employee) => employee.id === check.managerClosingAuthorizedById)?.name ?? check.managerClosingAuthorizedById}</small>}</label>
                    {!managerClosingAuthorized && canManage && <button className="ghost compact" onClick={() => onUpdate(branch, { managerClosingAuthorizedAt: new Date().toISOString(), managerClosingAuthorizedById: user.id })}>Autorizar cierre</button>}
                  </div>
                  <div className="openingStep">
                    <label><input type="checkbox" checked={cashCutSubmitted} readOnly /> Corte de caja del día capturado</label>
                    {!cashCutSubmitted && canCashier && <button className="ghost compact" onClick={onOpenCash}>Ir a hacer corte de caja</button>}
                    <label><input type="checkbox" checked={Boolean(check.cashierClosingAuthorizedAt)} disabled={!canCashier || !cashCutSubmitted || !managerClosingAuthorized} onChange={(event) => onUpdate(branch, { cashierClosingAuthorizedAt: event.target.checked ? new Date().toISOString() : undefined, cashierClosingAuthorizedById: event.target.checked ? user.id : undefined, closedAt: undefined, closedById: undefined })} /> 2. Cajero autoriza cierre (corte entregado) {check.cashierClosingAuthorizedAt && <small>{new Date(check.cashierClosingAuthorizedAt).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" })} · {collaborators.find((employee) => employee.id === check.cashierClosingAuthorizedById)?.name ?? check.cashierClosingAuthorizedById}</small>}</label>
                  </div>
                  {readyToClose && (
                    <p className="warn">🔒 Indicación para todo el personal: cerrar cortinas y puertas.</p>
                  )}
                  {canManage && <button className="primary" disabled={!readyToClose} onClick={() => onUpdate(branch, { closedAt: new Date().toISOString(), closedById: user.id })}>3. Confirmar cortinas y puertas cerradas</button>}
                </>
              )}
              {closed && <p className="muted">Cerró {collaborators.find((employee) => employee.id === check.closedById)?.name ?? check.closedById} · {new Date(check.closedAt!).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" })}</p>}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function SlaReviewPanel({ user, collaborators, tasks, runs, reviews, onReview }: { user: Employee; collaborators: Employee[]; tasks: DailyTask[]; runs: ActivityRun[]; reviews: SlaReview[]; onReview: (sourceType:SlaReview["sourceType"],sourceId:string,employeeId:string,decision:SlaReview["decision"],note:string)=>void }) {
  const canDecide = canGovern(user) || ["GERENTE_TIENDA","ADMIN_TIENDA","JEFE_AREA"].includes(user.role);
  const incidents = [...tasks.map((task)=>({sourceType:"Tarea" as const,id:task.id,employeeId:task.employeeId,title:task.title,scheduled:`${task.start}-${task.end}`,startedAt:task.startedAt!,limit:task.slaMinutes??60,instructions:task.notes})),...runs.map((run)=>({sourceType:"Actividad" as const,id:run.id,employeeId:run.employeeId,title:run.title,scheduled:`${run.scheduledStart}-${run.scheduledEnd}`,startedAt:run.startedAt!,limit:run.slaMinutes,instructions:run.evidence?`Evidencia requerida: ${run.evidence}`:"Sin evidencia indicada"}))];
  return <article className="wide panelCard slaReviewPanel"><div className="sectionHead"><div><h2>Revisión de SLA vencidos</h2><span>Ningún vencimiento afecta la calificación hasta que un responsable lo revise.</span></div><strong>{incidents.length} pendiente(s)</strong></div><div className="stack">{incidents.map((incident)=><SlaReviewItem key={`${incident.sourceType}-${incident.id}`} incident={incident} employeeName={collaborators.find((employee)=>employee.id===incident.employeeId)?.name??incident.employeeId} canDecide={canDecide} onReview={onReview}/>)}</div>{incidents.length===0&&<p className="muted">No existen SLA pendientes de revisión.</p>}{reviews.length>0&&<div className="taskList"><h3>Decisiones de hoy</h3>{reviews.slice().reverse().map((review)=><div className="taskRow" key={review.id}><span>{collaborators.find((employee)=>employee.id===review.employeeId)?.name??review.employeeId}<small>{review.sourceType} · revisó {collaborators.find((employee)=>employee.id===review.reviewedById)?.name??review.reviewedById}</small></span><span>{review.note}</span><strong className={review.scoreImpact<0?"danger":"ok"}>{review.decision} · {review.scoreImpact} punto</strong></div>)}</div>}</article>;
}

function SlaReviewItem({incident,employeeName,canDecide,onReview}:{incident:{sourceType:SlaReview["sourceType"];id:string;employeeId:string;title:string;scheduled:string;startedAt:string;limit:number;instructions:string};employeeName:string;canDecide:boolean;onReview:(sourceType:SlaReview["sourceType"],sourceId:string,employeeId:string,decision:SlaReview["decision"],note:string)=>void}) {
  const [expanded,setExpanded]=useState(false);const [note,setNote]=useState("");
  return <div className="slaIncident"><button type="button" className="slaIncidentHead" onClick={()=>setExpanded((value)=>!value)}><span><strong>{employeeName}</strong><small>{incident.sourceType} · {incident.scheduled}</small></span><span>{incident.title}</span><strong className="danger">Vencida · {formatElapsed(incident.startedAt)}</strong></button>{expanded&&<div className="slaIncidentBody"><p><strong>Instrucciones:</strong> {incident.instructions}</p><p><strong>Límite autorizado:</strong> {incident.limit} minutos.</p>{canDecide&&<><textarea value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Motivo obligatorio de la decisión"/><div className="taskActions"><button type="button" className="ghost" disabled={note.trim().length<10} onClick={()=>onReview(incident.sourceType,incident.id,incident.employeeId,"Justificada",note)}>Justificar · sin afectar</button><button type="button" className="ghost danger" disabled={note.trim().length<10} onClick={()=>onReview(incident.sourceType,incident.id,incident.employeeId,"Incumplimiento",note)}>Cerrar con -1 punto</button></div></>}</div>}</div>;
}

export default App;
