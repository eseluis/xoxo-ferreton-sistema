import { useEffect, useRef, useState } from "react";
import type { Employee } from "./data";
import { workTimeAt } from "./workFocus";
import { buildCentroAgenda, CENTRO_PRIORITY, CENTRO_PROJECTS, CENTRO_TASKS, centroCompletionError, centroSummary, isCentroSupervisor, type CentroAgendaItem, type CentroRecord, type InventoryItem } from "./centroOperation";
import { assignCentroDay, fetchCentroContext, saveCentroRecord, type CentroAction, type CentroContext } from "./centroStore";

type Opening = { date: string; branch: string; erpReady?: boolean; processComplete: boolean; systemsReady: boolean; doorsOpenedAt?: string; openedAt?: string; cashOpenConfirmedAt?: string; closedAt?: string };
const defaultApi = { fetchCentroContext, saveCentroRecord, assignCentroDay };
type Props = { user: Employee; collaborators: Employee[]; today: string; openingChecks: Opening[]; onNavigate: (view: string) => void; onAssignmentsChanged: () => void; onPriorityPause: (reason: string) => void; api?: typeof defaultApi };
const empty: CentroContext = { roster: [], records: [], previous: [] };

export function CentroOperationView({ user, collaborators, today, openingChecks, onNavigate, onAssignmentsChanged, onPriorityPause, api = defaultApi }: Props) {
  const supervisor = isCentroSupervisor(user);
  const [day, setDay] = useState(today);
  const [context, setContext] = useState<CentroContext>(empty);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState(supervisor ? "all" : "mine");
  const [now, setNow] = useState(workTimeAt());
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  useEffect(() => { setReady(false); setContext(empty); setError(""); }, [day]);
  useEffect(() => {
    let alive = true;
    const token = ++generation.current;
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      const requestGeneration = generation.current;
      try {
        const next = await api.fetchCentroContext(day);
        if (alive && token === generation.current && requestGeneration === generation.current) { setContext(next); setReady(true); setError(""); }
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : "No se pudo cargar la operación."); }
      if (alive) setNow(workTimeAt());
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("centro-refresh", refresh);
    return () => { alive = false; clearInterval(interval); window.removeEventListener("focus", refresh); window.removeEventListener("centro-refresh", refresh); };
  }, [day, revision, api]);
  const agenda = buildCentroAgenda(day, context.roster, context.records, now);
  const me = context.roster.find(p => p.id === user.id);
  const present = context.roster.filter(p => p.present);
  const summary = centroSummary(context.records);
  const mine = agenda.filter(item => item.ownerId === user.id);
  const pending = agenda.filter(item => !["Validada", "Por validar"].includes(item.record?.status ?? ""));
  const current = mine.find(item => item.record?.status === "En curso") ?? mine.find(item => !["Validada", "Por validar", "Pausada"].includes(item.record?.status ?? "") && item.start <= now && item.end > now);
  const next = mine.find(item => item.start > now && !["Validada", "Por validar"].includes(item.record?.status ?? ""));
  const opening = openingChecks.find(o => o.date === day && o.branch === "Sucursal Centro");
  const opened = Boolean(opening?.erpReady && opening.processComplete && opening.systemsReady && opening.cashOpenConfirmedAt && opening.doorsOpenedAt && opening.openedAt);
  const openingTime = opening?.openedAt ? (opening.openedAt.includes("T") ? workTimeAt(new Date(opening.openedAt)) : opening.openedAt.slice(0, 5)) : "";
  const openingCorrect = opened && openingTime >= "08:50" && openingTime <= "09:10";
  const weekStart = new Date(`${day}T12:00:00Z`); weekStart.setUTCDate(weekStart.getUTCDate() - (weekStart.getUTCDay() + 6) % 7);
  const openingFailures = openingChecks.filter(o => o.branch === "Sucursal Centro" && o.date >= weekStart.toISOString().slice(0, 10) && o.date <= day && (o.date < today || now > "09:10") && (!o.openedAt || (o.openedAt.includes("T") ? workTimeAt(new Date(o.openedAt)) : o.openedAt.slice(0, 5)) > "09:10" || !o.erpReady || !o.systemsReady || !o.processComplete || !o.cashOpenConfirmedAt || !o.doorsOpenedAt)).length;
  async function mutate(item: CentroAgendaItem, action: CentroAction, data: CentroRecord["data"], note = "") {
    if (busy) return false;
    if (item.outdoor && ["start", "resume"].includes(action) && (!String(data.propuesta ?? "").trim() || !String(data.herramientas ?? "").trim() || !(Number(data.metaContactos) > 0))) {
      setError("Antes de iniciar prospección, registra propuesta, herramientas y una meta de contactos mayor a cero."); return false;
    }
    if (action === "submit") {
      const validation = centroCompletionError(item, data, context.records);
      if (validation) { setError(validation); return false; }
      if (item.id === "apertura" && !opened) { setError("Primero completa el control de apertura de la tienda."); return false; }
      if (item.id === "cierre" && !opening?.closedAt) { setError("Primero confirma el cierre en el control de la tienda."); return false; }
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await api.saveCentroRecord(day, item.id, item.record?.version ?? 0, action, data, note);
      setContext(prev => ({ ...prev, records: [...prev.records.filter(r => r.task_id !== item.id), saved] }));
      // A full authoritative refresh also includes tasks paused by the server.
      setRevision(v => v + 1);
      setNotice(action === "submit" ? "Actividad enviada a validación." : action === "approve" ? "Actividad validada." : "Cambio guardado en el servidor.");
      if (action === "pause" && ["Cliente", "Seguridad"].includes(note)) onPriorityPause(note);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar. Conserva tu captura e intenta nuevamente."); return false; }
    finally { setBusy(false); }
  }
  async function priorityPause(reason: string) {
    setBusy(true); setError("");
    try {
      for (const item of mine.filter(i => i.record?.status === "En curso")) await api.saveCentroRecord(day, item.id, item.record!.version, "pause", item.record!.data, reason);
      onPriorityPause(reason); setRevision(v => v + 1); setNotice(`Prioridad: ${reason}. Los avances se conservan; retoma las actividades al terminar.`);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo confirmar la pausa."); }
    finally { setBusy(false); }
  }
  const visible = filter === "all" ? agenda : filter === "review" ? agenda.filter(i => i.record?.status === "Por validar" || i.record?.status === "Corrección") : mine;
  const printReport = () => {
    const sections = Array.from(document.querySelectorAll<HTMLDetailsElement>(".centroReport details"));
    const previous = sections.map(section => section.open);
    sections.forEach(section => { section.open = true; });
    window.addEventListener("afterprint", () => sections.forEach((section, index) => { section.open = previous[index]; }), { once: true });
    window.print();
  };
  return <section className="centroOperation">
    <div className="centroHero panelCard">
      <div><small>OPERACIÓN DIARIA</small><h2>Sucursal Centro</h2><p className="centroPriority">{CENTRO_PRIORITY}</p></div>
      <div><strong>{day !== today ? "CONSULTA HISTÓRICA" : present.length === 1 ? "MODO PERSONAL REDUCIDO" : present.length === 0 ? "SIN PERSONAL PRESENTE" : "OPERACIÓN CON EQUIPO"}</strong><p>{day === today ? `${present.length} persona(s) disponibles · ` : ""}{day}</p><small>Actualización automática cada 15 segundos</small></div>
    </div>
    <div className="centroToolbar"><label>Consultar día <input aria-label="Consultar día" type="date" value={day} max={today} onChange={e => setDay(e.target.value || today)} /></label><button className="ghost" onClick={() => setRevision(v => v + 1)} disabled={busy}>Actualizar</button><button className="ghost" onClick={printReport}>Imprimir reporte</button></div>
    {error && <div className="centroAlert" role="alert">{error}</div>}
    {notice && <p role="status">{notice}</p>}
    {!ready && !error && <p>Cargando agenda y presencia…</p>}
    {ready && <>
      {me && <article className="panelCard"><h3>Hoy estás asignado a Sucursal Centro</h3><p>{me.roleLabel} · Horario: {me.start}–{me.end} · {me.present ? "Presente" : "Registra tu llegada o revisa tu horario"}</p><p>Rol de hoy: {[...new Set(mine.map(i => i.category))].join(" / ") || "Pendiente de asignación"}</p><p>Meta sucursal: 50 visitantes · 50 códigos de inventario.</p><div className="centroActions"><button className="primary" disabled={busy || day !== today || !me.present} onClick={() => void priorityPause("Cliente")}>Atender cliente</button><button className="ghost" disabled={busy || day !== today || !me.present} onClick={() => void priorityPause("Seguridad")}>Pausar por seguridad</button><button className="ghost" onClick={() => onNavigate("asistencia")}>Registrar llegada / comida / salida</button></div><p>Ahora: <strong>{current?.title ?? "Atención y revisión de pendientes"}</strong> · Después: {next?.title ?? "Retomar pendientes"}</p></article>}
      <div className="centroMetrics" aria-label="Resultados de Centro"><div><small>Apertura</small><strong>{openingCorrect ? "Correcta · +1 punto" : opened ? "Fuera de ventana" : "Incompleta"}</strong></div><div><small>Visitantes</small><strong>{summary.visitors} / 50</strong></div><div><small>Inventario</small><strong>{summary.inventory} / 50</strong></div><div><small>Validadas</small><strong>{summary.validated} / {CENTRO_TASKS.length}</strong></div><div><small>Productos mañana</small><strong>{summary.tomorrow} / 3</strong></div></div>
      {present.length === 1 && <p className="centroAlert">Prospección adaptada a seguimiento digital dentro de tienda. No salir ni dejar la tienda sola. Coordinar cobertura para comida y cualquier ausencia.</p>}
      {openingFailures >= 3 && <p className="centroAlert" role="alert">ALERTA DE APERTURA RECURRENTE: {openingFailures} incumplimientos registrados esta semana. Revisión del gerente; sin descuento económico automático.</p>}
      {agenda.some(i => i.blocked) && <details className="panelCard"><summary>Alertas de cobertura y actividades pendientes</summary>{agenda.filter(i => i.blocked).map(i => <p key={i.id}>{i.title}: {i.blocked}</p>)}</details>}
      <details className="panelCard"><summary>Personal asignado ({context.roster.length})</summary>{context.roster.map(p => <p key={p.id}><strong>{p.name}</strong> · {p.roleLabel} · {p.start}–{p.end} · {p.present ? "Disponible" : p.arrived ? "En descanso / fuera de turno / salió" : "Sin llegada"}</p>)}</details>
      {supervisor && <AssignmentForm collaborators={collaborators} today={today} assign={api.assignCentroDay} onSaved={() => { onAssignmentsChanged(); setRevision(v => v + 1); }} />}
      <div className="centroToolbar"><h3>Agenda {day === today ? "de hoy" : day}</h3><label>Mostrar <select value={filter} onChange={e => setFilter(e.target.value)}><option value="mine">Mis actividades</option><option value="all">Operación de sucursal</option>{supervisor && <option value="review">Validaciones y correcciones</option>}</select></label></div>
      {!visible.length && <p>No hay actividades en este filtro. Consulta la operación de sucursal.</p>}
      <div className="centroAgenda">{visible.map(item => <TaskCard key={`${day}-${item.id}`} item={item} user={user} ownerName={collaborators.find(p => p.id === item.ownerId)?.name ?? item.ownerId ?? "Sin responsable disponible"} supervisor={supervisor} editable={ready && day === today && !!me?.present && item.ownerId === user.id && !item.blocked} busy={busy} onAction={mutate} onOpening={() => onNavigate("panel")} projects={CENTRO_PROJECTS.filter(project => ![...context.previous, ...context.records].some(r => r.task_id === "exhibicion" && r.status === "Validada" && r.data.proyecto === project && Number(r.data.avance) === 100))} />)}</div>
      <article className="panelCard centroReport"><h3>Reporte diario Centro</h3><p>Resultados capturados; las actividades solo cuentan como validadas después de revisión.</p><div className="centroMetrics"><div><small>Conversión</small><strong>{summary.conversion.toFixed(1)}%</strong></div><div><small>Ventas</small><strong>${summary.sales.toFixed(2)}</strong></div><div><small>Tickets</small><strong>{summary.tickets}</strong></div><div><small>Ticket promedio</small><strong>${summary.averageTicket.toFixed(2)}</strong></div></div>{agenda.map(item => <details key={item.id}><summary>{item.title} · {item.record?.status ?? "Pendiente"}</summary>{item.fields.map(f => <p key={f.key}><strong>{f.label}:</strong> {String(item.record?.data[f.key] ?? "Sin registro")}</p>)}</details>)}<h4>Pendientes y continuidad</h4>{pending.map(item => <p key={item.id}>{item.title} · {item.record?.status ?? "Pendiente"} · {item.reason}</p>)}<h4>Seguimiento de días anteriores</h4>{context.previous.filter(r => r.status !== "Validada").map(r => <p key={`${r.day}-${r.task_id}`}>{r.day}: {CENTRO_TASKS.find(t => t.id === r.task_id)?.title} · {r.status} · {String(r.data.pendientes ?? r.data.problemas ?? "Revisar seguimiento")}</p>)}<p>Los pendientes anteriores conservan su fecha y resultado; no se declaran cumplidos al iniciar un día nuevo.</p></article>
    </>}
  </section>;
}

function AssignmentForm({ collaborators, today, onSaved, assign }: { collaborators: Employee[]; today: string; onSaved: () => void; assign: typeof assignCentroDay }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return <details className="panelCard"><summary>Asignar sucursal y horario por día</summary><form className="centroFields" onSubmit={async e => {
    e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); setError("");
    try { await assign(String(form.get("employee")), String(form.get("date")), String(form.get("location")), String(form.get("start")), String(form.get("end"))); onSaved(); setError("Asignación guardada."); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); } finally { setBusy(false); }
  }}><label>Colaborador<select name="employee">{collaborators.filter(p => p.name !== "Vacante").map(p => <option key={p.id} value={p.id}>{p.name} · {p.roleLabel}</option>)}</select></label><label>Día<input name="date" type="date" min={today} defaultValue={today} required /></label><label>Sucursal<select name="location"><option>Sucursal Centro</option><option>Matriz</option></select></label><label>Entrada<input name="start" type="time" defaultValue="08:50" required /></label><label>Salida<input name="end" type="time" defaultValue="18:00" required /></label><button className="primary" disabled={busy}>Guardar asignación</button><p role="status">{error}</p></form></details>;
}

function TaskCard({ item, user, ownerName, supervisor, editable, busy, onAction, onOpening, projects }: { item: CentroAgendaItem; user: Employee; ownerName: string; supervisor: boolean; editable: boolean; busy: boolean; onAction: (item: CentroAgendaItem, action: CentroAction, data: CentroRecord["data"], note?: string) => Promise<boolean>; onOpening: () => void; projects: string[] }) {
  const [draft, setDraft] = useState<CentroRecord["data"]>(item.record?.data ?? {});
  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState("");
  const baseVersion = useRef(item.record?.version ?? 0);
  useEffect(() => { if (!dirty) { setDraft(item.record?.data ?? {}); baseVersion.current = item.record?.version ?? 0; } }, [item.record?.version, dirty]);
  const setValue = (key: string, value: CentroRecord["data"][string]) => { setDraft(prev => ({ ...prev, [key]: value })); setDirty(true); };
  const stale = dirty && baseVersion.current !== (item.record?.version ?? 0);
  const status = item.record?.status ?? "Pendiente";
  const canEdit = editable && !["Por validar", "Validada"].includes(status) && !busy && !stale;
  const submitAction = async (action: CentroAction, reason = "") => { if (await onAction(item, action, draft, reason)) setDirty(false); };
  const items = Array.isArray(draft.items) ? draft.items : [];
  return <article className={`panelCard centroTask ${status === "Validada" ? "centroValidated" : ""}`}>
    <div className="sectionHead"><div><small>{item.start}–{item.end} · {item.category}</small><h3>{item.title}</h3><span>{ownerName}</span></div><span className="statusPill">{status}</span></div>
    <p>{item.reason}</p><p>{item.instructions}</p>{item.outdoor && <p><strong>{item.digital ? "Modo digital dentro de tienda" : "Prospección exterior permitida solo con cobertura"}</strong></p>}
    {item.blocked && <p className="centroAlert">{item.blocked}</p>}
    {stale && <div className="centroAlert">Hay una versión más reciente. Tu borrador sigue aquí; copia lo necesario antes de cargarla. <button className="ghost" onClick={() => { setDirty(false); setDraft(item.record?.data ?? {}); baseVersion.current = item.record?.version ?? 0; }}>Cargar versión guardada</button></div>}
    <details open={status === "En curso" || status === "Corrección"}>
      <summary>Captura, evidencia e historial</summary>
      <fieldset disabled={!canEdit} className="centroFields">
        {item.fields.map(f => <label key={f.key}>{f.label}{f.required ? " *" : ""}{f.type === "check" ? <input type="checkbox" checked={draft[f.key] === true} onChange={e => setValue(f.key, e.target.checked)} /> : f.type === "number" ? <input type="number" min="0" step="any" value={String(draft[f.key] ?? "")} onChange={e => setValue(f.key, e.target.value === "" ? "" : Number(e.target.value))} /> : <textarea value={String(draft[f.key] ?? "")} onChange={e => setValue(f.key, e.target.value)} rows={2} />}</label>)}
        {item.id === "exhibicion" && <label>Mejoras pendientes (o escribe una nueva arriba)<select value="" onChange={e => setValue("proyecto", e.target.value)}><option value="">Seleccionar actividad</option>{projects.map(p => <option key={p}>{p}</option>)}</select></label>}
        <label>Evidencia: enlace de fotografía / video {item.evidence ? "*" : "(si aplica)"}<input type="url" value={String(draft.evidence ?? "")} onChange={e => setValue("evidence", e.target.value)} placeholder="https://…" /></label>
      </fieldset>
      {item.inventory && <InventoryEditor items={items} disabled={!canEdit} onChange={rows => setValue("items", rows)} />}
      {typeof item.record?.data.evidence === "string" && /^https?:\/\//i.test(item.record.data.evidence) && <a href={item.record.data.evidence} target="_blank" rel="noreferrer">Abrir evidencia guardada</a>}
      <details><summary>Historial ({item.record?.history.length ?? 0})</summary>{item.record?.history.map((h, index) => <p key={index}>{new Date(h.at).toLocaleString("es-MX")} · {h.actor} · {h.action} {h.note && `· ${h.note}`}</p>)}</details>
    </details>
    {item.id === "apertura" || item.id === "cierre" ? <button className="ghost" onClick={onOpening}>Ir al control de apertura / cierre</button> : null}
    <div className="centroActions">
      {canEdit && <><button className="ghost" onClick={() => void submitAction("save")}>Guardar avance</button>{status === "En curso" ? <><button className="ghost" onClick={() => void submitAction("pause", "Cliente")}>Atender cliente</button><button className="ghost" onClick={() => void submitAction("pause", "Seguridad")}>Pausar por seguridad</button></> : <button className="primary" onClick={() => void submitAction(status === "Pausada" ? "resume" : "start")}>{status === "Pausada" ? "Retomar" : "Iniciar"}</button>}<button className="primary" onClick={() => void submitAction("submit")}>Terminar y enviar a validación</button></>}
      {supervisor && status === "Por validar" && <><label>Motivo de corrección<input value={note} onChange={e => setNote(e.target.value)} /></label><button className="primary" disabled={busy || item.record?.owner_id === user.id} onClick={() => void onAction(item, "approve", item.record!.data)}>Validar</button><button className="ghost" disabled={busy || !note.trim()} onClick={() => void onAction(item, "reject", item.record!.data, note)}>Rechazar evidencia / corregir</button>{item.record?.owner_id === user.id && <small>Otro supervisor debe validar tu actividad.</small>}</>}
    </div>
    {dirty && !stale && <small>Borrador local: guarda el avance antes de cambiar de pantalla.</small>}
  </article>;
}

function InventoryEditor({ items, disabled, onChange }: { items: InventoryItem[]; disabled: boolean; onChange: (rows: InventoryItem[]) => void }) {
  const update = (index: number, key: keyof InventoryItem, value: string | number | boolean) => onChange(items.map((row, i) => i === index ? { ...row, [key]: value } : row));
  return <fieldset disabled={disabled} className="centroInventory"><legend>Productos revisados: {items.length} / 25</legend>{items.map((row, index) => <details key={index}><summary>{index + 1}. {row.code || "Nuevo código"} · {row.description || "Sin descripción"} · {row.result}</summary><div className="centroFields">{([ ["code", "Código"], ["description", "Descripción"], ["physical", "Existencia física"], ["system", "Existencia sistema"], ["price", "Precio"], ["location", "Ubicación"], ["correction", "Corrección / seguimiento"], ["evidence", "Enlace de evidencia"] ] as const).map(([key, label]) => <label key={key}>{label}<input type={["physical", "system", "price"].includes(key) ? "number" : "text"} min="0" step="any" value={row[key]} onChange={e => update(index, key, ["physical", "system", "price"].includes(key) ? Number(e.target.value) : e.target.value)} /></label>)}<label><input type="checkbox" checked={row.label} onChange={e => update(index, "label", e.target.checked)} />Etiqueta correcta</label><label><input type="checkbox" checked={row.registered} onChange={e => update(index, "registered", e.target.checked)} />Dado de alta</label><label>Resultado<select value={row.result} onChange={e => update(index, "result", e.target.value)}>{["Correcto", "Requiere corrección", "No dado de alta", "Diferencia inventario", "Precio incorrecto", "Etiqueta faltante"].map(result => <option key={result}>{result}</option>)}</select></label><button className="ghost" onClick={() => onChange(items.filter((_, i) => i !== index))}>Quitar código</button></div></details>)}<button className="ghost" onClick={() => onChange([...items, { code: "", description: "", physical: 0, system: 0, price: 0, location: "", label: false, registered: false, result: "Requiere corrección", correction: "", evidence: "" }])}>Agregar código</button></fieldset>;
}
