import type { Employee, Role } from "./data";

export const CENTRO_PRIORITY = "Cliente → Seguridad → Actividad programada";
export type CentroPerson = Pick<Employee, "id" | "name" | "role" | "roleLabel"> & {
  start: string; end: string; present: boolean; arrived: boolean;
};
export type CentroStatus = "Pendiente" | "En curso" | "Pausada" | "Por validar" | "Validada" | "Corrección";
export type InventoryItem = { code: string; description: string; physical: number; system: number; price: number; location: string; label: boolean; registered: boolean; result: string; correction: string; evidence: string };
export type CentroRecord = {
  day: string; task_id: string; owner_id: string; status: CentroStatus; version: number;
  data: Record<string, string | number | boolean | InventoryItem[]>;
  history: { at: string; actor: string; action: string; note: string }[];
  updated_at: string;
};
export type CentroField = { key: string; label: string; type?: "number" | "check" | "text" | "photo"; required?: boolean };
export type CentroTask = { id: string; title: string; start: string; end: string; category: string; instructions: string; fields: CentroField[]; control?: boolean; outdoor?: boolean; inventory?: boolean; evidence?: boolean };
const n = (key: string, label: string): CentroField => ({ key, label, type: "number" });
const t = (key: string, label: string, required = false): CentroField => ({ key, label, required });
const check = (key: string, label: string): CentroField => ({ key, label, type: "check", required: true });
export const CENTRO_PROJECTS = ["Instalar cerradura inteligente en puerta de madera", "Asignar mínimo 20 códigos a la cerradura", "Colocar puerta en entrada de escaleras", "Colocar flyer/vinil en puerta", "Instalar iluminación inteligente en escalera", "Instalar iluminación inteligente en pasillo", "Colocar repisas en nuevas zonas", "Colocar ganchos en nuevas zonas", "Acomodar mercancía nueva", "Ordenar mercancía por marca"];
export const CENTRO_TASKS: CentroTask[] = [
  { id: "apertura", title: "Apertura oficial", start: "08:45", end: "09:00", category: "Apertura", control: true, instructions: "La apertura se confirma en el control existente: venta lista para cobrar, sesión Xoxo, checklist completo y puerta abierta. Ventana correcta: 8:45–9:00. Sin descuentos económicos automáticos.", fields: [t("incidencias", "Incidencias de apertura")] },
  ...[1, 2].map(i => ({ id: `aseo-${i}`, title: `Aseo · parte ${i}`, start: "09:00", end: "09:30", category: "Aseo", instructions: "Alternar piso y baños cada día. Intercambiar barrer/trapear o baño 1/baño 2. Registrar fotos de antes y después en esta misma actividad; no repetir el aseo en otro módulo.", fields: [{ key: "fotoAntes", label: "Foto antes del aseo", type: "photo" as const, required: true }, { key: "fotoDespues", label: "Foto después del aseo", type: "photo" as const, required: true }, check("realizado", "Aseo realizado"), t("incidencias", "Incidencias encontradas")] })),
  { id: "presentacion", title: "Mostradores y entrada", start: "09:30", end: "10:00", category: "Exhibición", instructions: "Limpiar mostradores y exhibición, retirar objetos ajenos, regresar productos a su ubicación y cuidar la primera impresión.", fields: [check("mostradores", "Mostradores listos"), check("entrada", "Entrada lista"), t("precios", "Precios faltantes"), t("fuera", "Productos fuera de lugar"), t("vacios", "Espacios vacíos detectados")] },
  ...[1, 2].map(i => ({ id: `inventario-${i}`, title: `Inventario · revisión en Alegra POS · bloque ${i}/2`, start: "10:00", end: "11:00", category: "Inventario", inventory: true, instructions: "Revisa el inventario en Alegra POS. Para terminar este bloque, agrega el enlace de evidencia de Alegra POS o comenta las correcciones realizadas. Si no encontraste incidencias, escribe Sin incidencias. No es necesario volver a capturar productos ni cantidades.", fields: [t("pendientes", "Resultado de la revisión: correcciones realizadas o Sin incidencias")] })),
  ...[1, 2].map(i => ({ id: `trafico-${i}`, title: `Generación de tráfico · turno ${i}`, start: i === 1 ? "11:00" : "12:00", end: i === 1 ? "12:00" : "13:00", category: "Tráfico", outdoor: true, instructions: "Preparar propuesta antes de salir. Solo una persona afuera y otra disponible en tienda. En modo reducido: seguimientos digitales e invitaciones desde tienda.", fields: [t("propuesta", "¿Qué harás, dónde, a quién y qué ofrecerás?", true), n("metaContactos", "Meta de contactos"), t("herramientas", "Herramientas necesarias", true), n("contactados", "Personas contactadas"), n("negocios", "Negocios visitados"), n("contactos", "Contactos obtenidos"), n("interesados", "Interesados"), n("cotizaciones", "Cotizaciones generadas"), n("visitas", "Posibles visitas"), t("aprendizaje", "¿Qué aprendiste?", true)] })),
  { id: "exhibicion", title: "Adaptación Sucursal Centro", start: "13:00", end: "14:00", category: "Exhibición", evidence: true, instructions: "Elegir una actividad del proyecto. Registrar avance diario y acumulado; al terminar, continuar con la siguiente mejora.", fields: [t("proyecto", "Actividad del proyecto", true), t("material", "Material y herramientas"), t("inicio", "Fecha de inicio"), t("terminacion", "Fecha de terminación"), n("avance", "Avance acumulado (%)"), t("antes", "Antes: descripción o enlace", true), t("despues", "Después: descripción o enlace", true), t("problemas", "Problemas y material faltante")] },
  { id: "seguimiento", title: "Comidas escalonadas y seguimiento", start: "14:00", end: "15:00", category: "Atención", instructions: "Coordinar las comidas sin dejar la tienda sola. Registrar salida/regreso de comida en Registro diario. Atender WhatsApp, cotizaciones, visitantes y prospectos. Con una persona, solicitar cobertura al supervisor para el descanso.", fields: [n("seguimientos", "Seguimientos realizados"), t("pendientes", "Clientes y cotizaciones pendientes"), t("cobertura", "Organización de comidas / cobertura", true)] },
  { id: "experiencia", title: "Experiencia Xoxo y redes", start: "15:00", end: "16:00", category: "Experiencia", instructions: "Mejorar señalización, iluminación, etiquetas, precios, lonas, viniles y recorrido. No dejar espacios vacíos si existe mercancía disponible. Registrar resultados concretos de redes.", fields: [t("mejora", "Mejora realizada", true), t("solucion", "Problema solucionado", true), n("interacciones", "Interacciones realizadas"), n("mensajes", "Mensajes respondidos"), n("invitados", "Personas invitadas"), n("prospectos", "Posibles clientes detectados")] },
  { id: "preparacion", title: "Preparar Hora Xoxo", start: "16:00", end: "16:15", category: "Demostración", instructions: "Elegir producto, limpiar y preparar espacio y herramientas. Revisar características, existencia, precio y explicación. Auxiliares pueden apoyar; un jefe puede orientar y capacitar.", fields: [t("producto", "Producto y código", true), check("listo", "Espacio, producto y herramientas listos"), t("capacitacion", "Capacitación o apoyo requerido")] },
  { id: "demostracion", title: "Demostración / producto del día", start: "16:15", end: "17:00", category: "Demostración", evidence: true, instructions: "Una persona presenta y otra apoya, graba y atiende. Con una persona: demostración breve dentro de tienda, interrumpible por clientes y solo dentro de sus competencias.", fields: [t("producto", "Producto presentado", true), t("explicacion", "Qué es, para qué y quién sirve, uso, problema que resuelve, precio y por qué lo tenemos", true), n("interesados", "Interesados registrados"), t("apoyo", "Apoyo técnico / capacitación")] },
  { id: "contenido", title: "Contenido de la demostración", start: "17:00", end: "17:15", category: "Contenido", instructions: "Generar cuando sea posible video corto, foto, historia, WhatsApp Status, Reel/TikTok o material para YouTube.", fields: [t("contenido", "Contenido generado o impedimento", true), t("publicacion", "Dónde se publicó / pendiente"), t("enlace", "Enlace de publicación"), n("interacciones", "Interacciones iniciales")] },
  { id: "manana", title: "Tres productos para mañana", start: "17:15", end: "17:30", category: "Demostración", instructions: "Proponer 3 productos: código, existencia, precio, interés para el cliente y demostración posible. El supervisor valida la selección.", fields: [t("producto1", "Propuesta 1 (producto, código, existencia, precio, motivo y demostración)", true), t("producto2", "Propuesta 2 (producto, código, existencia, precio, motivo y demostración)", true), t("producto3", "Propuesta 3 (producto, código, existencia, precio, motivo y demostración)", true)] },
  { id: "cierre", title: "Cierre operativo y reporte", start: "17:30", end: "18:00", category: "Cierre", control: true, instructions: "Cerrar seguimientos, cotizaciones, solicitudes y orden básico. Confirmar cierre con el proceso autorizado de la tienda. El reporte resume los registros del día.", fields: [check("orden", "Orden y revisión final realizados"), t("pendientes", "Pendientes para mañana"), t("necesidades", "Productos solicitados no disponibles / más solicitados"), t("comentarios", "Comentarios de clientes e incidencias")] },
  { id: "atencion", title: "Atención y resultados del día", start: "08:45", end: "18:00", category: "Atención", control: true, instructions: "Consolidar los totales de sucursal sin duplicar visitantes. La atención tiene prioridad durante toda la jornada; registrar procedencia, contactos, cotizaciones y necesidades.", fields: [n("visitantes", "Visitantes (meta 50)"), n("nuevos", "Nuevos"), n("recurrentes", "Recurrentes"), n("compradores", "Compradores"), n("ventas", "Ventas ($)"), n("tickets", "Tickets"), n("cotizaciones", "Cotizaciones ($)"), t("procedencia", "Procedencia, contactos y productos solicitados")] },
];
export function isCentroSupervisor(user: Pick<Employee, "id" | "role"> & Partial<Pick<Employee, "branch">>) {
  return (user.branch === "Sucursal Centro" && ["GERENTE_TIENDA", "ADMIN_TIENDA"].includes(user.role)) || ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL"].includes(user.role);
}
export function canShowCentroOperation(user: Parameters<typeof isCentroSupervisor>[0], location: string) {
  return location !== "Matriz" && (location === "Sucursal Centro" || isCentroSupervisor(user));
}
export const isControlRole = (role: Role) => ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL", "GERENTE_TIENDA", "ADMIN_TIENDA"].includes(role);
export function cleaningFor(day: string, part: number) {
  const dayIndex = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000);
  return dayIndex % 2 === 0 ? ((Math.floor(dayIndex / 2) + part) % 2 ? "Barrer piso" : "Trapear piso") : `Lavar baño ${part}`;
}
export type CentroAgendaItem = CentroTask & { ownerId?: string; record?: CentroRecord; reason: string; digital: boolean; blocked?: string };
export function buildCentroAgenda(day: string, roster: CentroPerson[], records: CentroRecord[], now: string): CentroAgendaItem[] {
  const present = roster.filter(p => p.present && p.start <= now && p.end > now);
  const preview = present.length === 0 && roster.every(p => !p.arrived) && roster.some(p => now < p.start);
  const pool = preview ? roster : present;
  const load: Record<string, number> = {};
  const pairedOwners: Record<string, string> = {};
  return CENTRO_TASKS.map((task): CentroAgendaItem => {
    const record = records.find(r => r.day === day && r.task_id === task.id);
    const completed = record && ["Por validar", "Validada"].includes(record.status);
    const existing = pool.find(p => p.id === record?.owner_id);
    const group = task.id.replace(/-[12]$/, "");
    const candidates = pool.filter(p => (p.start < task.end && p.end > task.start) || (p.present && now >= task.end)).sort((a, b) => {
      const score = (p: CentroPerson) => (pairedOwners[group] === p.id ? 100 : 0) + (load[p.id] ?? 0) + (task.control ? (isControlRole(p.role) ? -8 : p.role === "JEFE_AREA" ? -3 : 0) : isControlRole(p.role) ? 8 : task.category === "Demostración" && p.role === "JEFE_AREA" ? -3 : 0);
      return score(a) - score(b) || a.id.localeCompare(b.id);
    });
    // Preserve work in progress; a missing worker's progress is retained on transfer.
    const ownerId = completed ? record.owner_id : existing ? existing.id : candidates[0]?.id;
    if (ownerId) load[ownerId] = (load[ownerId] ?? 0) + 2;
    if (ownerId && /-[12]$/.test(task.id)) pairedOwners[group] = ownerId;
    const digital = !!task.outdoor && present.length < 2;
    const otherOutside = records.some(r => r.day === day && r.task_id.startsWith("trafico-") && r.task_id !== task.id && r.status === "En curso" && r.data.mode === "Exterior");
    return { ...task, title: task.id.startsWith("aseo-") ? cleaningFor(day, Number(task.id.slice(-1))) : task.title,
      ownerId, record, digital,
      blocked: !ownerId ? "Sin personal disponible en este horario; requiere cobertura" : task.outdoor && !digital && otherOutside ? "Hay otra persona en prospección exterior; esperar su regreso" : undefined,
      reason: !ownerId ? "La obligación permanece pendiente" : record?.owner_id && ownerId !== record.owner_id ? "Reasignada por cambio de disponibilidad; conserva el avance" : preview ? "Asignación prevista; se confirma al registrar llegada" : "Asignada por puesto, horario y personal disponible",
    };
  });
}
// Server assignments keep ownership consistent while other people's records stay private.
export type CentroAssignment = { taskId: string; ownerId: string | null };
export function visibleCentroAgenda(user: Employee, agenda: CentroAgendaItem[], assignments?: CentroAssignment[]): CentroAgendaItem[] {
  const supervisor = isCentroSupervisor(user);
  return agenda.flatMap(item => {
    const assigned = assignments?.find(a => a.taskId === item.id);
    if (assignments && !assigned) return [];
    const scoped = assigned ? { ...item, ownerId: assigned.ownerId ?? undefined } : item;
    return supervisor || scoped.ownerId === user.id ? [scoped] : [];
  });
}
export function centroCompletionError(task: CentroTask, data: CentroRecord["data"], records: CentroRecord[] = []): string | undefined {
  for (const f of task.fields) {
    const value = data[f.key];
    if (f.required && (f.type === "check" ? value !== true : !String(value ?? "").trim())) return `Falta: ${f.label}.`;
    if (f.type === "number" && value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)) return `${f.label}: usa un número mayor o igual a cero.`;
  }
  if (task.evidence && !String(data.evidence ?? "").trim()) return "Agrega evidencia (enlace de fotografía o video).";
  if (task.inventory) {
    const link = String(data.evidence ?? "").trim();
    if (link && !/^https?:\/\/\S+$/i.test(link)) return "Agrega un enlace válido de Alegra POS (https://…).";
    if (!link && !String(data.pendientes ?? "").trim()) return "Agrega el enlace de Alegra POS o comenta las correcciones realizadas; si no hubo incidencias, escribe Sin incidencias.";
  }
  if (task.id === "exhibicion" && Number(data.avance ?? 0) > 100) return "El avance no puede exceder 100%.";
  if (task.id === "atencion" && Number(data.compradores ?? 0) > Number(data.visitantes ?? 0)) return "Los compradores no pueden superar a los visitantes.";
  return undefined;
}
export function centroSummary(records: CentroRecord[]) {
  const data = (id: string) => records.find(r => r.task_id === id)?.data ?? {};
  const attention = data("atencion");
  const inventory = records.filter(r => r.task_id.startsWith("inventario-") && (
    /^https?:\/\/\S+$/i.test(String(r.data.evidence ?? "").trim()) || String(r.data.pendientes ?? "").trim() ||
    String(r.data.fotoInventario ?? "").startsWith("data:image/") || (Array.isArray(r.data.items) && r.data.items.length > 0)
  ));
  const measured = (key: string) => attention[key] === undefined || attention[key] === "" || !Number.isFinite(Number(attention[key])) ? null : Number(attention[key]);
  const visitors = measured("visitantes"), buyers = measured("compradores"), tickets = measured("tickets"), sales = measured("ventas");
  return { visitors, buyers, tickets, sales, conversion: visitors && buyers !== null ? buyers / visitors * 100 : null, averageTicket: tickets && sales !== null ? sales / tickets : null,
    inventory: inventory.length,
    validated: records.filter(r => r.status === "Validada").length,
    tomorrow: ["producto1", "producto2", "producto3"].filter(key => String(data("manana")[key] ?? "").trim()).length,
  };
}
