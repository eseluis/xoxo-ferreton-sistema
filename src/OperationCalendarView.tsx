import { useEffect, useMemo, useState } from "react";
import { canGovern, type ActivitySchedule, type CleaningRole, type Employee } from "./data";
import { buildRoutine } from "./operationalAgenda";
import { dayItems, FIRST_FIFTEEN, PROJECT_PHASES, projectDay, summarizeDay, type CalendarRun, type CalendarTask, type DayPlan } from "./dayCalendar";
import { readCalendar, saveDayPlan, saveProjectStart } from "./calendarStore";
import { workTimeAt } from "./workFocus";
import { CENTRO_TASKS } from "./centroOperation";

export function DailyPlanCapture({ user, day, branch, schedules, cleaning, enabled }: { user: Employee; day: string; branch: string; schedules: ActivitySchedule[]; cleaning: CleaningRole[]; enabled: boolean }) {
  const [error, setError] = useState("");
  const slots = JSON.stringify(buildRoutine(user, schedules, cleaning, branch, day));
  useEffect(() => {
    if (!enabled || branch === "Sucursal Centro") return;
    let alive = true;
    let confirmed = false;
    const persist = async () => {
      if (confirmed) return;
      try { await saveDayPlan({ employee_number: user.id, day, branch, slots: JSON.parse(slots) }); confirmed = true; if (alive) { setError(""); window.dispatchEvent(new Event("calendar-refresh")); } }
      catch (e) { if (alive) setError(e instanceof Error ? e.message : "No se pudo guardar el plan diario."); }
    };
    void persist(); const retry = window.setInterval(() => void persist(), 60000);
    return () => { alive = false; clearInterval(retry); };
  }, [enabled, user.id, day, branch, slots]);
  return error ? <p role="alert" className="calendarWarning">Calendario: {error}</p> : null;
}

type Props = { user: Employee; collaborators: Employee[]; today: string; runs: CalendarRun[]; tasks: CalendarTask[]; schedules?: ActivitySchedule[]; cleaning?: CleaningRole[]; locations?: { employeeId: string; date: string; location: string }[]; onNavigate: (view: string) => void; api?: { readCalendar: typeof readCalendar; saveProjectStart: typeof saveProjectStart } };
const defaultApi = { readCalendar, saveProjectStart };
export function OperationCalendarView({ user, collaborators, today, runs, tasks, schedules = [], cleaning = [], locations = [], onNavigate, api = defaultApi }: Props) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [employeeId, setEmployeeId] = useState(user.id);
  const [data, setData] = useState<Awaited<ReturnType<typeof readCalendar>>>({ plans: [], centro: [], start: "2026-10-01" });
  const [error, setError] = useState(""); const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0); const [busy, setBusy] = useState(false);
  const [time, setTime] = useState(workTimeAt());
  const managers = canGovern(user) || user.id === "005";
  const team = managers ? collaborators : ["GERENTE_TIENDA", "ADMIN_TIENDA"].includes(user.role) ? collaborators.filter(e => e.branch === user.branch || e.id === user.id) : [user];
  const days = useMemo(() => {
    const count = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
    return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  }, [month]);
  useEffect(() => {
    let alive = true; setReady(false); setError("");
    const refresh = async () => {
      try { const next = await api.readCalendar(days[0], days[days.length - 1], employeeId); if (alive) { setData(next); setReady(true); setError(""); } }
      catch (e) { if (alive) { setReady(false); setError(e instanceof Error ? e.message : "No se pudo cargar el calendario."); } }
    };
    void refresh(); const timer = window.setInterval(() => { setTime(workTimeAt()); if (document.visibilityState !== "hidden") void refresh(); }, 30000);
    window.addEventListener("calendar-refresh", refresh);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("calendar-refresh", refresh); };
  }, [days, employeeId, revision, api]);
  const forDay = (day: string) => {
    const plan = data.plans.find(p => p.day === day && p.employee_number === employeeId);
    const employee = collaborators.find(e => e.id === employeeId) ?? user;
    const branch = locations.find(l => l.employeeId === employeeId && l.date === day)?.location ?? employee.branch;
    const preview: DayPlan | undefined = !plan && day >= today ? { employee_number: employeeId, day, branch, slots: branch === "Sucursal Centro" ? CENTRO_TASKS.map(t => ({ key: `Centro-${t.id}`, kind: "Centro", itemId: t.id, title: t.title, start: t.start, end: t.end, instructions: `${t.instructions} Responsable por confirmar según presencia y horario.`, evidence: t.evidence ? "link" : "none", slaMinutes: 0 })) : buildRoutine(employee, schedules, cleaning, branch, day) } : undefined;
    const items = dayItems(day, employeeId, plan ?? preview, runs, tasks, data.centro);
    return { plan, preview, items, result: summarizeDay(day, today, time, items, Boolean(plan)) };
  };
  const detail = forDay(selected);
  const projectNumber = projectDay(data.start, selected);
  const offset = (new Date(`${days[0]}T12:00:00Z`).getUTCDay() + 6) % 7;
  return <section className="operationCalendar stack">
    <article className="panelCard calendarIntro"><small>PLAN · DÍA · HORA</small><h2>Calendario de cumplimiento</h2><p>Consulta qué correspondía hacer, qué se terminó y qué necesita seguimiento. El color mide cumplimiento operativo; los resultados económicos se revisan en KPIs y Finanzas.</p>
      <div className="calendarControls"><label>Mes<input aria-label="Mes del calendario" type="month" value={month} onChange={e => { if (e.target.value) { setMonth(e.target.value); setSelected(`${e.target.value}-01`); } }} /></label><label>Colaborador<select aria-label="Colaborador del calendario" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>{team.filter(e => e.name !== "Vacante").map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label><button className="ghost" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }}>Hoy</button><button className="ghost" onClick={() => setRevision(r => r + 1)}>Actualizar</button></div>
      <div className="calendarLegend"><span className="day-green">Verde · cumplido</span><span className="day-yellow">Amarillo · seguimiento</span><span className="day-red">Rojo · atención</span><span className="day-gray">Gris · sin datos / futuro</span></div>
    </article>
    {error && <p role="alert" className="calendarWarning">{error}</p>}
    {!ready && !error && <p role="status">Cargando historial confirmado…</p>}
    {ready && <>
      <article className="panelCard"><div className="calendarGrid" aria-label="Calendario mensual">{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => <strong className="calendarWeekday" key={d}>{d}</strong>)}{Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}{days.map(day => {
        const { result } = forDay(day);
        return <button key={day} aria-label={`${day}: ${result.label}, ${result.done} de ${result.total}`} aria-pressed={day === selected} className={`calendarDay day-${result.color} ${day === selected ? "selected" : ""}`} onClick={() => setSelected(day)}><strong>{Number(day.slice(-2))}</strong><span>{result.label}</span><small>{result.total ? `${result.done}/${result.total}` : "—"}</small></button>;
      })}</div></article>
      <article className="panelCard"><div className="sectionHead"><div><h2>{selected} · {collaborators.find(e => e.id === employeeId)?.name ?? user.name}</h2><p>{detail.plan?.branch ?? "Sin plan diario guardado"}</p></div><strong className={`calendarBadge day-${detail.result.color}`}>{detail.result.label}</strong></div><p>{detail.result.explanation}</p><p className="muted">El día de hoy es provisional. El historial conserva la agenda guardada al iniciar la jornada; las tareas adicionales conservan su propia fecha. Los apoyos que no afectan evaluación se muestran, pero no cambian el color.</p>
        {detail.preview && <p className="calendarWarning">Programación prevista con el horario vigente; todavía no es un plan histórico confirmado. Puede cambiar por asignaciones o disponibilidad.</p>}
        <div className="calendarTimeline">{detail.items.map(item => <div className="calendarActivity" key={item.key}><div><strong>{item.start}–{item.end}</strong><small>{item.optional ? "Apoyo sin evaluación" : "Actividad del día"}</small></div><div><h3>{item.title}</h3><p>{item.instructions}</p><span>{item.reason}</span></div>{selected === today && employeeId === user.id && <button className="ghost" onClick={() => onNavigate(item.destination)}>Abrir actividad</button>}</div>)}{!detail.items.length && <p>No hay actividades registradas para este día. No se supone que se cumplieron ni que se incumplieron.</p>}</div>
      </article>
      <article className="panelCard"><small>ESTABILIZACIÓN ECONÓMICA · 5 MESES</small><h2>El plan y el trabajo diario</h2><p>Inicio: {data.start}. La agenda por hora mantiene las responsabilidades de cada puesto. Estos hitos orientan a dirección; conviértelos en tareas con responsable y horario en Tareas asignadas.</p>
        <ol className="projectPhases">{PROJECT_PHASES.map((phase, i) => <li key={phase}><strong>Mes {i + 1}</strong><span>{phase}</span></li>)}</ol>
        <h3>{projectNumber < 1 ? "Antes del inicio del proyecto" : `Día ${projectNumber} del proyecto`}</h3><p>{FIRST_FIFTEEN[projectNumber - 1] ?? (projectNumber < 1 ? "Preparar fuentes, responsables y accesos." : "Continuar el plan mensual y revisar resultados cada 15 días.")}</p>
        <details><summary>Primeros 15 días: entregables de dirección</summary><ol>{FIRST_FIFTEEN.map((goal, i) => <li key={goal}><strong>Día {i + 1}:</strong> {goal}</li>)}</ol></details>
        <div className="calendarControls"><button className="primary" onClick={() => onNavigate("tareas")}>Ver / asignar tareas del plan</button>{managers && <button className="ghost" onClick={() => onNavigate("kpis")}>Revisar resultados medidos</button>}</div>
        {managers && <form className="calendarControls" onSubmit={async e => { e.preventDefault(); const start = String(new FormData(e.currentTarget).get("start")); setBusy(true); try { await api.saveProjectStart(start); setRevision(r => r + 1); } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar."); } finally { setBusy(false); } }}><label>Inicio acordado del proyecto<input key={data.start} name="start" type="date" defaultValue={data.start} required /></label><button className="ghost" disabled={busy}>Guardar fecha</button></form>}
      </article>
    </>}
  </section>;
}
