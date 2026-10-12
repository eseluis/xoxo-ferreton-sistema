import { useState } from "react";
import { canGovern, type Employee } from "./data";
import { requestPending, requestsInSection, type InternalRequest } from "./requestOverview";

export function RequestsPanel({ user, collaborators, requests, onNavigate }: { user: Employee; collaborators: Employee[]; requests: InternalRequest[]; onNavigate: (view: string) => void }) {
  const [scope, setScope] = useState("recibidas");
  const [author, setAuthor] = useState("");
  const visible = requestsInSection(requests, user, false);
  const pending = visible.filter(requestPending);
  const rows = pending.filter(request => scope === "todas" || (scope === "enviadas" ? request.requestedById === user.id : request.recipientId === user.id))
    .filter(request => !author || request.requestedById === author)
    .sort((a, b) => ({ Critica: 0, Alta: 1, Media: 2, Baja: 3 }[a.priority] - { Critica: 0, Alta: 1, Media: 2, Baja: 3 }[b.priority]) || a.date.localeCompare(b.date));
  const person = (id: string) => collaborators.find(employee => employee.id === id)?.name ?? id;
  return <article className="wide panelCard">
    <div className="sectionHead"><div><h2>Solicitudes pendientes</h2><span>{pending.filter(request => request.recipientId === user.id).length} recibidas por atender · incluye fechas anteriores</span></div><button className="primary compact" onClick={() => onNavigate("solicitudes")}>Ver y responder solicitudes</button></div>
    <div className="todayActivitiesFilters"><label>Mostrar solicitudes<select value={scope} onChange={event => setScope(event.target.value)}><option value="recibidas">Recibidas por mí</option><option value="enviadas">Enviadas por mí</option>{canGovern(user) && <option value="todas">Todas las visibles</option>}</select></label>
      <label>Remitente de solicitud<select value={author} onChange={event => setAuthor(event.target.value)}><option value="">Todos los remitentes</option>{collaborators.filter(employee => pending.some(request => request.requestedById === employee.id)).map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
    </div>
    <div className="requestList">{rows.map(request => <div className="requestCard" key={request.id}><strong>{request.type}: {request.title}</strong><p>De {person(request.requestedById)} para {person(request.recipientId)} · {request.date}</p><p>{request.message}</p><small>{request.status} · {request.priority}{request.confidentiality === "Confidencial" ? " · Confidencial" : ""}</small>{request.response && <p><strong>Respuesta:</strong> {request.response}</p>}</div>)}</div>
    {!rows.length && <p className="muted">No hay solicitudes pendientes con estos filtros.</p>}
  </article>;
}
