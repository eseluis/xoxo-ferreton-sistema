import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ClipboardList,
  FileCheck2,
  FileText,
  LogOut,
  MessageSquare,
  Network,
  Printer,
  BookOpen,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { cloudLoad, cloudSave, isCloudReady } from "./cloudStore";

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
};

type Warranty = {
  id: string;
  provider: string;
  product: string;
  reason: string;
  status: string;
  ownerId: string;
  date: string;
};

type ProcessInstance = {
  id: string;
  processId: string;
  title: string;
  startedById: string;
  ownerId: string;
  date: string;
  status: "Activo" | "Completado" | "Incidencia";
  notes: string;
  stepStates: {
    title: string;
    owner: string;
    evidence: string;
    done: boolean;
    note: string;
    completedAt?: string;
  }[];
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
};

type ActivityCompletion = {
  id: string;
  employeeId: string;
  date: string;
  itemType: "Actividad" | "Aseo";
  itemId: string;
  title: string;
  start: string;
  end: string;
  status: "Completada";
  completedAt: string;
};

type ShiftConfig = (typeof defaultShiftConfigs)[number];
type ActivitySchedule = (typeof defaultActivitySchedules)[number];
type CleaningRole = (typeof defaultCleaningRole)[number];
type Branch = Employee["branch"];

const load = <T,>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
};

const save = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
  void cloudSave(key, value);
};

const passwordFor = (employee: Employee) => employee.password || `xoxo${employee.id}`;

const normalizeEmployees = (employees: Employee[]) =>
  employees.map((employee) => ({
    ...employee,
    password: employee.password || `xoxo${employee.id}`,
  }));

const timeNow = () =>
  new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

function App() {
  const [activeId, setActiveId] = useState(localStorage.getItem("xoxo.activeId") ?? "003");
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem("xoxo.authenticated") === "true");
  const [loginId, setLoginId] = useState(localStorage.getItem("xoxo.activeId") ?? "003");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [view, setView] = useState("panel");
  const [collaborators, setCollaborators] = useState<Employee[]>(() =>
    normalizeEmployees(load("xoxo.collaborators", defaultEmployees)),
  );
  const [attendance, setAttendance] = useState<Attendance[]>(() => load("xoxo.attendance", []));
  const [evaluations, setEvaluations] = useState<Evaluation[]>(() => load("xoxo.evaluations", []));
  const [cashIncidents, setCashIncidents] = useState<CashIncident[]>(() => load("xoxo.cash", []));
  const [cashCuts, setCashCuts] = useState<CashCut[]>(() => load("xoxo.cashCuts", []));
  const [warranties, setWarranties] = useState<Warranty[]>(() => load("xoxo.warranties", []));
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>(() => load("xoxo.dailyTasks", []));
  const [processInstances, setProcessInstances] = useState<ProcessInstance[]>(() => load("xoxo.processInstances", []));
  const [internalRequests, setInternalRequests] = useState<InternalRequest[]>(() => load("xoxo.internalRequests", []));
  const [activityCompletions, setActivityCompletions] = useState<ActivityCompletion[]>(() => load("xoxo.activityCompletions", []));
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
    if (!isCloudReady) return;
    const hydrate = async () => {
      const [
        cloudCollaborators,
        cloudAttendance,
        cloudEvaluations,
        cloudCashIncidents,
        cloudCashCuts,
        cloudWarranties,
        cloudDailyTasks,
        cloudProcessInstances,
        cloudInternalRequests,
        cloudActivityCompletions,
        cloudShiftConfigs,
        cloudActivitySchedules,
        cloudCleaningRole,
      ] = await Promise.all([
        cloudLoad("xoxo.collaborators", collaborators),
        cloudLoad("xoxo.attendance", attendance),
        cloudLoad("xoxo.evaluations", evaluations),
        cloudLoad("xoxo.cash", cashIncidents),
        cloudLoad("xoxo.cashCuts", cashCuts),
        cloudLoad("xoxo.warranties", warranties),
        cloudLoad("xoxo.dailyTasks", dailyTasks),
        cloudLoad("xoxo.processInstances", processInstances),
        cloudLoad("xoxo.internalRequests", internalRequests),
        cloudLoad("xoxo.activityCompletions", activityCompletions),
        cloudLoad("xoxo.shiftConfigs", shiftConfigs),
        cloudLoad("xoxo.activitySchedules", activitySchedules),
        cloudLoad("xoxo.cleaningRole", cleaningRole),
      ]);
      setCollaborators(normalizeEmployees(cloudCollaborators));
      setAttendance(cloudAttendance);
      setEvaluations(cloudEvaluations);
      setCashIncidents(cloudCashIncidents);
      setCashCuts(cloudCashCuts);
      setWarranties(cloudWarranties);
      setDailyTasks(cloudDailyTasks);
      setProcessInstances(cloudProcessInstances);
      setInternalRequests(cloudInternalRequests);
      setActivityCompletions(cloudActivityCompletions);
      setShiftConfigs(cloudShiftConfigs);
      setActivitySchedules(cloudActivitySchedules);
      setCleaningRole(cloudCleaningRole);
    };
    void hydrate();
  }, []);

  const user = collaborators.find((employee) => employee.id === activeId) ?? collaborators[0] ?? defaultEmployees[2];
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
  const currentCleaningAssignment = getEditableCleaningAssignment(user, cleaningRole);
  const currentCleaningRow = getEditableCleaningRow(user, cleaningRole);
  const userTasks = dailyTasks.filter((task) => task.employeeId === user.id && task.date === today);

  const persistCollaborators = (next: Employee[]) => {
    const normalized = normalizeEmployees(next);
    setCollaborators(normalized);
    save("xoxo.collaborators", normalized);
  };

  const submitLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = collaborators.find((employee) => employee.id === loginId);
    if (!found || passwordFor(found) !== loginPassword) {
      setLoginError("Numero de colaborador o contrasena incorrecta.");
      return;
    }
    setActiveId(found.id);
    setIsAuthenticated(true);
    setLoginError("");
    setLoginPassword("");
    localStorage.setItem("xoxo.activeId", found.id);
    localStorage.setItem("xoxo.authenticated", "true");
  };

  const logout = () => {
    setIsAuthenticated(false);
    setLoginPassword("");
    setLoginId(activeId);
    localStorage.removeItem("xoxo.authenticated");
  };

  const persistDailyTasks = (next: DailyTask[]) => {
    setDailyTasks(next);
    save("xoxo.dailyTasks", next);
  };

  const persistProcessInstances = (next: ProcessInstance[]) => {
    setProcessInstances(next);
    save("xoxo.processInstances", next);
  };

  const updateAttendance = (field: keyof Attendance) => {
    const next = attendance.filter((entry) => !(entry.employeeId === user.id && entry.date === today));
    next.push({ ...(myAttendance ?? { employeeId: user.id, date: today }), [field]: timeNow() });
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
        date: today,
      },
    ];
    setCashIncidents(next);
    save("xoxo.cash", next);
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
    const expectedCash = erpSales - cardTotal - transferTotal - withdrawals - providerPayments - operationalExpenses;
    const difference = cashCounted - expectedCash;
    const next = [
      {
        id: crypto.randomUUID(),
        branch: String(form.get("branch") || user.branch),
        date: String(form.get("date") || today),
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
      },
      ...cashCuts,
    ];
    setCashCuts(next);
    save("xoxo.cashCuts", next);
    event.currentTarget.reset();
  };

  const addWarranty = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = [
      ...warranties,
      {
        id: crypto.randomUUID(),
        provider: String(form.get("provider")),
        product: String(form.get("product")),
        reason: String(form.get("reason")),
        status: "Abierta",
        ownerId: user.id,
        date: today,
      },
    ];
    setWarranties(next);
    save("xoxo.warranties", next);
    event.currentTarget.reset();
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

  const persistActivityCompletions = (next: ActivityCompletion[]) => {
    setActivityCompletions(next);
    save("xoxo.activityCompletions", next);
  };

  if (!isAuthenticated) {
    return (
      <LoginView
        collaborators={collaborators}
        loginId={loginId}
        setLoginId={setLoginId}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        loginError={loginError}
        submitLogin={submitLogin}
      />
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandMark">XF</span>
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
          <button className={view === "panel" ? "active" : ""} onClick={() => setView("panel")}>
            <BarChart3 size={18} /> Panel
          </button>
          <button className={view === "asistencia" ? "active" : ""} onClick={() => setView("asistencia")}>
            <Clock size={18} /> Registro diario
          </button>
          <button className={view === "equipo" ? "active" : ""} onClick={() => setView("equipo")}>
            <UserRound size={18} /> Colaboradores
          </button>
          <button className={view === "organigrama" ? "active" : ""} onClick={() => setView("organigrama")}>
            <Network size={18} /> Organigrama
          </button>
          <button className={view === "procesos" ? "active" : ""} onClick={() => setView("procesos")}>
            <FileCheck2 size={18} /> Procesos
          </button>
          <button className={view === "evaluacion" ? "active" : ""} onClick={() => setView("evaluacion")}>
            <CalendarCheck size={18} /> Evaluacion
          </button>
          <button className={view === "caja" ? "active" : ""} onClick={() => setView("caja")}>
            <WalletCards size={18} /> Caja
          </button>
          <button className={view === "garantias" ? "active" : ""} onClick={() => setView("garantias")}>
            <ShieldCheck size={18} /> Garantias
          </button>
          <button className={view === "tareas" ? "active" : ""} onClick={() => setView("tareas")}>
            <ClipboardList size={18} /> Tareas
          </button>
          <button className={view === "solicitudes" ? "active" : ""} onClick={() => setView("solicitudes")}>
            <MessageSquare size={18} /> Solicitudes
          </button>
          <button className={view === "reportes" ? "active" : ""} onClick={() => setView("reportes")}>
            <FileText size={18} /> Reportes
          </button>
          <button className={view === "instructivo" ? "active" : ""} onClick={() => setView("instructivo")}>
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
            <small>{today}</small>
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
          />
        )}
        {view === "asistencia" && (
          <AttendanceView
            user={user}
            myAttendance={myAttendance}
            updateAttendance={updateAttendance}
            myEval={myEval}
            shift={shiftMap[user.shift]}
            activitySchedules={activitySchedules}
            cleaningAssignment={currentCleaningAssignment}
            cleaningRow={currentCleaningRow}
            dailyTasks={userTasks}
            activityCompletions={activityCompletions}
            setActivityCompletions={persistActivityCompletions}
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
        {view === "procesos" && (
          <ProcessesView
            user={user}
            collaborators={collaborators}
            processInstances={processInstances}
            setProcessInstances={persistProcessInstances}
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
          />
        )}
        {view === "caja" && (
          <CashView
            user={user}
            addCashIncident={addCashIncident}
            cashIncidents={cashIncidents}
            addCashCut={addCashCut}
            cashCuts={cashCuts}
            collaborators={collaborators}
          />
        )}
        {view === "garantias" && <WarrantyView user={user} addWarranty={addWarranty} warranties={warranties} />}
        {view === "tareas" && (
          <TasksView
            user={user}
            collaborators={collaborators}
            dailyTasks={dailyTasks}
            setDailyTasks={persistDailyTasks}
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
            activityCompletions={activityCompletions}
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
      asistencia: "Registro diario",
      equipo: "Colaboradores y directorio",
      organigrama: "Organigrama",
      procesos: "Procesos y protocolos",
      evaluacion: "Evaluacion diaria",
      caja: "Caja e incidencias",
      garantias: "Garantias a proveedores",
      tareas: "Tareas asignadas",
      solicitudes: "Solicitudes y reportes internos",
      reportes: "Reportes imprimibles",
      instructivo: "Instructivo de uso",
      configuracion: "Configuracion directiva",
    }[view] ?? "Panel"
  );
}

function LoginView({
  collaborators,
  loginId,
  setLoginId,
  loginPassword,
  setLoginPassword,
  loginError,
  submitLogin,
}: {
  collaborators: Employee[];
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
          <span className="brandMark">XF</span>
          <div>
            <strong>XOXO Ferreton</strong>
            <small>Acceso al sistema</small>
          </div>
        </div>
        <label>
          Numero de colaborador
          <select value={loginId} onChange={(event) => setLoginId(event.target.value)}>
            {collaborators.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.id} - {employee.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Contrasena
          <input
            type="password"
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
            required
          />
        </label>
        {loginError && <p className="loginError">{loginError}</p>}
        <button className="primary">Entrar</button>
      </form>
    </main>
  );
}

function getEditableCleaningAssignment(employee: Employee, cleaningRole: CleaningRole[]) {
  const assignment = getEditableCleaningRow(employee, cleaningRole);
  if (!assignment) return "Sin aseo asignado en el rol editable";
  return `${assignment.activity} (${assignment.start} - ${assignment.end})`;
}

function getEditableCleaningRow(employee: Employee, cleaningRole: CleaningRole[]) {
  const dayName = weekDays[(new Date().getDay() + 6) % 7];
  return cleaningRole.find((row) =>
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
}) {
  const today = todayKey();
  const todaysAttendance = attendance.filter((entry) => entry.date === today);
  const todaysEvaluations = evaluations.filter((entry) => entry.date === today);
  const average =
    todaysEvaluations.length === 0
      ? 0
      : todaysEvaluations.reduce((sum, entry) => sum + entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length, 0) /
        todaysEvaluations.length;
  return (
    <section className="grid">
      <Metric label="Colaboradores activos" value={collaborators.length.toString()} icon={<UserRound />} />
      <Metric label="Entradas registradas hoy" value={todaysAttendance.length.toString()} icon={<Clock />} />
      <Metric label="Evaluacion promedio" value={average ? average.toFixed(1) : "0.0"} icon={<BarChart3 />} />
      <Metric label="Garantias abiertas" value={warranties.filter((item) => item.status === "Abierta").length.toString()} icon={<ShieldCheck />} />

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

function AttendanceView({
  user,
  myAttendance,
  updateAttendance,
  myEval,
  shift,
  activitySchedules,
  cleaningAssignment,
  cleaningRow,
  dailyTasks,
  activityCompletions,
  setActivityCompletions,
}: {
  user: Employee;
  myAttendance?: Attendance;
  updateAttendance: (field: keyof Attendance) => void;
  myEval?: Evaluation & { average: number; rate: number };
  shift?: ShiftConfig;
  activitySchedules: ActivitySchedule[];
  cleaningAssignment: string;
  cleaningRow?: CleaningRole;
  dailyTasks: DailyTask[];
  activityCompletions: ActivityCompletion[];
  setActivityCompletions: (value: ActivityCompletion[]) => void;
}) {
  const userActivities = activitySchedules.filter((activity) => activity.ownerRoles.includes(user.role));
  const today = todayKey();
  const completeItem = (item: {
    itemType: ActivityCompletion["itemType"];
    itemId: string;
    title: string;
    start: string;
    end: string;
  }) => {
    const id = `${user.id}-${today}-${item.itemType}-${item.itemId}`;
    if (activityCompletions.some((completion) => completion.id === id) || isPastEnd(item.end)) return;
    setActivityCompletions([
      ...activityCompletions,
      {
        id,
        employeeId: user.id,
        date: today,
        itemType: item.itemType,
        itemId: item.itemId,
        title: item.title,
        start: item.start,
        end: item.end,
        status: "Completada",
        completedAt: timeNow(),
      },
    ]);
  };
  const statusFor = (itemType: ActivityCompletion["itemType"], itemId: string, end: string) => {
    const id = `${user.id}-${today}-${itemType}-${itemId}`;
    const completed = activityCompletions.find((completion) => completion.id === id);
    if (completed) return { label: `Completada ${completed.completedAt}`, locked: true, className: "ok" };
    if (isPastEnd(end)) return { label: "Vencida / bloqueada", locked: true, className: "danger" };
    return { label: "Pendiente", locked: false, className: "warn" };
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
        <div className="cleaningHero">
          <Sparkles />
          <div>
            <small>Aseo asignado automaticamente</small>
            <strong>{cleaningAssignment}</strong>
          </div>
        </div>
        {cleaningRow && (
          <TimeBoundRow
            title={cleaningRow.activity}
            start={cleaningRow.start}
            end={cleaningRow.end}
            status={statusFor("Aseo", cleaningRow.activity, cleaningRow.end)}
            onComplete={() =>
              completeItem({
                itemType: "Aseo",
                itemId: cleaningRow.activity,
                title: cleaningRow.activity,
                start: cleaningRow.start,
                end: cleaningRow.end,
              })
            }
          />
        )}
        <div className="punchGrid">
          <button onClick={() => updateAttendance("in")}>Entrada {myAttendance?.in && <span>{myAttendance.in}</span>}</button>
          <button onClick={() => updateAttendance("lunchOut")}>Salida comida {myAttendance?.lunchOut && <span>{myAttendance.lunchOut}</span>}</button>
          <button onClick={() => updateAttendance("lunchIn")}>Entrada comida {myAttendance?.lunchIn && <span>{myAttendance.lunchIn}</span>}</button>
          <button onClick={() => updateAttendance("out")}>Salida {myAttendance?.out && <span>{myAttendance.out}</span>}</button>
        </div>
      </article>

      <article className="panelCard">
        <h2>Actividades programadas</h2>
        <div className="taskList">
          {userActivities.map((activity) => (
            <TimeBoundRow
              key={activity.id}
              title={activity.name}
              start={activity.start}
              end={activity.end}
              status={statusFor("Actividad", activity.id, activity.end)}
              onComplete={() =>
                completeItem({
                  itemType: "Actividad",
                  itemId: activity.id,
                  title: activity.name,
                  start: activity.start,
                  end: activity.end,
                })
              }
            />
          ))}
        </div>
      </article>

      <article className="panelCard">
        <h2>Tareas asignadas por superior</h2>
        <div className="taskList">
          {dailyTasks.length ? (
            dailyTasks.map((task) => (
              <div className="taskRow" key={task.id}>
                <span>
                  {task.title}
                  <small>
                    {task.start}-{task.end} · {task.priority}
                  </small>
                </span>
                <strong>{task.status}</strong>
              </div>
            ))
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
    </section>
  );
}

function TimeBoundRow({
  title,
  start,
  end,
  status,
  onComplete,
}: {
  title: string;
  start: string;
  end: string;
  status: { label: string; locked: boolean; className: string };
  onComplete: () => void;
}) {
  return (
    <div className="taskRow timeBoundRow">
      <span>
        {title}
        <small>
          {start}-{end} · <b className={status.className}>{status.label}</b>
        </small>
      </span>
      <button className="ghost compact" disabled={status.locked} onClick={onComplete}>
        Marcar hecho
      </button>
    </div>
  );
}

function isPastEnd(end: string) {
  if (!/^\d{2}:\d{2}$/.test(end)) return false;
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() > timeToMinutes(end);
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
          <h2>Rol de limpieza semanal</h2>
          <span>Basado en la tabla anterior; editable por directivos</span>
        </div>
        <div className="editableTable cleaningTable">
          <div className="editableRow head">
            <span>Actividad</span>
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          {cleaningRole.map((row, index) => (
            <div className="editableRow" key={row.activity}>
              <div>
                <strong>{row.activity}</strong>
                <small>
                  {row.start}-{row.end}
                </small>
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
      password: `xoxo${nextId}`,
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
          <span>Contrasena</span>
          <span></span>
        </div>
        {visibleEmployees.map((employee, index) => (
          <div className="tr peopleRow" key={employee.id}>
            <input disabled={!canGovern(user)} value={employee.id} onChange={(event) => updateEmployee(index, "id", event.target.value)} />
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
            <input
              disabled={!canGovern(user)}
              value={passwordFor(employee)}
              onChange={(event) => updateEmployee(index, "password", event.target.value)}
            />
            <button className="ghost danger" disabled={!canGovern(user)} onClick={() => removeEmployee(employee.id)}>
              Borrar
            </button>
          </div>
        ))}
      </div>
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
}: {
  user: Employee;
  collaborators: Employee[];
  processInstances: ProcessInstance[];
  setProcessInstances: (value: ProcessInstance[]) => void;
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
    : processInstances.filter((instance) => instance.ownerId === user.id || instance.startedById === user.id);
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
                  {instance.stepStates.map((step, index) => (
                    <label className="checkStep" key={`${instance.id}-${step.title}`}>
                      <input
                        type="checkbox"
                        checked={step.done}
                        onChange={(event) => {
                          const stepStates = instance.stepStates.map((current, currentIndex) =>
                            currentIndex === index
                              ? { ...current, done: event.target.checked, completedAt: event.target.checked ? timeNow() : undefined }
                              : current,
                          );
                          updateInstance({ ...instance, stepStates });
                        }}
                      />
                      <span>
                        <strong>{step.title}</strong>
                        <small>
                          {step.owner} · Evidencia: {step.evidence}
                          {step.completedAt ? ` · ${step.completedAt}` : ""}
                        </small>
                      </span>
                    </label>
                  ))}
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
}) {
  const average = props.scores.reduce((sum, value) => sum + value, 0) / props.scores.length;
  const rate = commissionRate(average, props.salesGoal, props.personalSales);
  return (
    <section className="grid two">
      <article className="panelCard">
        <div className="sectionHead">
          <h2>Evaluar colaborador</h2>
          <span>Escala 10 / 8 / 6 / 4</span>
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

function TasksView({
  user,
  collaborators,
  dailyTasks,
  setDailyTasks,
}: {
  user: Employee;
  collaborators: Employee[];
  dailyTasks: DailyTask[];
  setDailyTasks: (value: DailyTask[]) => void;
}) {
  const today = todayKey();
  const assignable = collaborators.filter((employee) => canAssign(user, employee));
  const addTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: DailyTask[] = [
      ...dailyTasks,
      {
        id: crypto.randomUUID(),
        title: String(form.get("title")),
        employeeId: String(form.get("employeeId")),
        assignedById: user.id,
        date: today,
        start: String(form.get("start")),
        end: String(form.get("end")),
        status: "Pendiente",
        priority: String(form.get("priority")) as DailyTask["priority"],
        notes: String(form.get("notes")),
      },
    ];
    setDailyTasks(next);
    event.currentTarget.reset();
  };

  const updateTaskStatus = (id: string, status: DailyTask["status"]) => {
    setDailyTasks(dailyTasks.map((task) => (task.id === id ? { ...task, status } : task)));
  };

  const deleteTask = (id: string) => {
    setDailyTasks(dailyTasks.filter((task) => task.id !== id));
  };

  const visibleTasks = canViewAll(user)
    ? dailyTasks
    : dailyTasks.filter((task) => task.employeeId === user.id || task.assignedById === user.id);

  return (
    <section className="grid two">
      <form className="panelCard form" onSubmit={addTask}>
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
            <input name="start" defaultValue="10:00" required />
          </label>
          <label>
            Fin
            <input name="end" defaultValue="11:00" required />
          </label>
        </div>
        <select name="priority">
          <option>Media</option>
          <option>Alta</option>
          <option>Baja</option>
        </select>
        <textarea name="notes" placeholder="Indicaciones, evidencia requerida o comentario" />
        <button className="primary">Asignar</button>
      </form>

      <article className="panelCard">
        <h2>Tabla de tareas</h2>
        <div className="taskList">
          {visibleTasks.map((task) => (
            <div className="taskRow taskEditable" key={task.id}>
              <span>
                <strong>{task.title}</strong>
                <small>
                  {collaborators.find((employee) => employee.id === task.employeeId)?.name} · {task.start}-{task.end} · {task.priority}
                </small>
              </span>
              <div className="taskActions">
                <select value={task.status} onChange={(event) => updateTaskStatus(task.id, event.target.value as DailyTask["status"])}>
                  {["Pendiente", "En proceso", "Completada", "Incidencia"].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
                <button className="ghost danger" onClick={() => deleteTask(task.id)}>
                  Borrar
                </button>
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

function CashView({
  user,
  addCashIncident,
  cashIncidents,
  addCashCut,
  cashCuts,
  collaborators,
}: {
  user: Employee;
  addCashIncident: (event: React.FormEvent<HTMLFormElement>) => void;
  cashIncidents: CashIncident[];
  addCashCut: (event: React.FormEvent<HTMLFormElement>) => void;
  cashCuts: CashCut[];
  collaborators: Employee[];
}) {
  const todayCuts = cashCuts.filter((cut) => cut.date === todayKey());
  const totalSales = todayCuts.reduce((sum, cut) => sum + cut.erpSales, 0);
  const totalDifference = todayCuts.reduce((sum, cut) => sum + cut.difference, 0);
  return (
    <section className="stack">
      <div className="grid">
        <Metric label="Ventas ERP hoy" value={`$${totalSales.toLocaleString("es-MX")}`} icon={<WalletCards />} />
        <Metric label="Cortes capturados" value={String(todayCuts.length)} icon={<FileCheck2 />} />
        <Metric label="Diferencia total" value={`$${totalDifference.toLocaleString("es-MX")}`} icon={<AlertTriangle />} />
        <Metric label="Cortes correctos" value={String(todayCuts.filter((cut) => cut.matches).length)} icon={<CheckCircle2 />} />
      </div>

      <section className="grid two">
        <form className="panelCard form" onSubmit={addCashCut}>
          <div className="sectionHead">
            <div>
              <h2>Corte de caja</h2>
              <span>Ventas ERP menos tarjeta, transferencia, retiros y pagos</span>
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
          <h2>Retiros, pagos e incidencias</h2>
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
              <span>Coincide</span>
            </div>
            {cashCuts.map((cut) => (
              <div className="cashRow" key={cut.id}>
                <span>{cut.date}</span>
                <span>{cut.branch}</span>
                <strong>${cut.erpSales.toLocaleString("es-MX")}</strong>
                <span>${cut.expectedCash.toLocaleString("es-MX")}</span>
                <span>${cut.cashCounted.toLocaleString("es-MX")}</span>
                <strong className={cut.matches ? "ok" : "danger"}>${cut.difference.toLocaleString("es-MX")}</strong>
                <span>{cut.matches ? "Si" : "No"}</span>
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
                    {item.paymentMethod || "Sin metodo"} · {item.recipient || "Sin destinatario"} ·{" "}
                    {collaborators.find((employee) => employee.id === item.ownerId)?.name ?? "Sin responsable"}
                  </small>
                </span>
                <strong>${item.amount.toLocaleString("es-MX")}</strong>
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
            const recipient = collaborators.find((employee) => employee.id === request.recipientId);
            const canAnswer = request.recipientId === user.id || canGovern(user);
            return (
              <div className="requestCard" key={request.id}>
                <div className="sectionHead">
                  <div>
                    <strong>
                      {request.type}: {request.title}
                    </strong>
                    <span>
                      De {author?.name ?? "Sin autor"} para {recipient?.name ?? "Sin destinatario"} · {request.date}
                    </span>
                  </div>
                  <span className={`status ${request.priority === "Critica" ? "dangerText" : ""}`}>{request.priority}</span>
                </div>
                <p>{request.message}</p>
                <small>
                  Estado: {request.status} · {request.confidentiality}
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
                  <textarea
                    disabled={!canAnswer}
                    value={request.response}
                    onChange={(event) => updateRequest(request.id, { response: event.target.value })}
                    placeholder="Respuesta, acuerdo, accion tomada o seguimiento"
                  />
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
  activityCompletions,
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
  activityCompletions: ActivityCompletion[];
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
  const filteredActivityCompletions = activityCompletions.filter((entry) => inRange(entry.date));
  const sales = filteredCuts.reduce((sum, cut) => sum + cut.erpSales, 0);
  const difference = filteredCuts.reduce((sum, cut) => sum + cut.difference, 0);
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
        </div>

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
              right={`${collaborators.find((employee) => employee.id === task.employeeId)?.name ?? task.employeeId} · ${task.status}`}
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

        <ReportSection title="Cumplimiento de actividades y aseo">
          {filteredActivityCompletions.map((item) => (
            <ReportLine
              key={item.id}
              left={`${item.date} · ${item.itemType} · ${item.title}`}
              right={`${collaborators.find((employee) => employee.id === item.employeeId)?.name ?? item.employeeId} · ${item.start}-${item.end} · ${
                item.status
              } ${item.completedAt}`}
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
  addWarranty,
  warranties,
}: {
  user: Employee;
  addWarranty: (event: React.FormEvent<HTMLFormElement>) => void;
  warranties: Warranty[];
}) {
  return (
    <section className="grid two">
      <form className="panelCard form" onSubmit={addWarranty}>
        <h2>Control de garantia</h2>
        <input name="provider" placeholder="Proveedor" required />
        <input name="product" placeholder="Producto / codigo" required />
        <textarea name="reason" placeholder="Que salio mal y que se debe devolver" required />
        <button className="primary">Abrir garantia</button>
        <p className="muted">Este modulo queda separado para Celina y gerencia.</p>
      </form>
      <article className="panelCard">
        <h2>Garantias abiertas</h2>
        <div className="taskList">
          {warranties.map((item) => (
            <div className="taskRow" key={item.id}>
              <span>
                {item.product} · {item.provider}
              </span>
              <strong>{item.status}</strong>
            </div>
          ))}
        </div>
        <p className="muted">Registrado por: {user.name}</p>
      </article>
    </section>
  );
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

export default App;
