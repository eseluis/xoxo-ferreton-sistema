import { canGovern, type Employee } from "./data";

export type InternalRequest = {
  id: string; type: "Solicitud" | "Queja" | "Peticion" | "Reporte";
  title: string; message: string; requestedById: string; recipientId: string; date: string;
  priority: "Baja" | "Media" | "Alta" | "Critica";
  status: "Abierta" | "En revision" | "Atendida" | "Cerrada";
  confidentiality: "Normal" | "Confidencial"; response: string;
  respondedAt?: string; respondedById?: string;
};
export function requestVisible(request: InternalRequest, user: Employee) {
  if (request.requestedById === user.id || request.recipientId === user.id) return true;
  return request.confidentiality !== "Confidencial" && canGovern(user);
}
export const requestPending = (request: InternalRequest) => request.status === "Abierta" || request.status === "En revision";
export function requestsInSection(requests: InternalRequest[], user: Employee, reports: boolean) {
  return requests.filter(request => requestVisible(request, user) && (request.type === "Reporte") === reports);
}
