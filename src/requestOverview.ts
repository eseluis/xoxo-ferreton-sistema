import { canGovern, canManageStore, type Employee } from "./data";

export type InternalRequest = {
  branch?: string;
  receivedAt?: string;
  recipientIds?: string[];
  id: string; type: "Solicitud" | "Queja" | "Peticion" | "Reporte";
  title: string; message: string; requestedById: string; recipientId: string; date: string;
  priority: "Baja" | "Media" | "Alta" | "Critica";
  status: "Abierta" | "En revision" | "Atendida" | "Cerrada";
  confidentiality: "Normal" | "Confidencial"; response: string;
  respondedAt?: string; respondedById?: string;
};
export const isReportDirector=(user:Pick<Employee,"id">)=>["001","002","003"].includes(user.id);
export function requestVisible(request: InternalRequest, user: Employee) {
  if(request.type==="Reporte") return request.requestedById===user.id||isReportDirector(user);
  if (request.requestedById === user.id || request.recipientId === user.id) return true;
  return request.confidentiality !== "Confidencial" && (canGovern(user) || (canManageStore(user) && request.branch === user.branch));
}
export const requestPending = (request: InternalRequest) => request.status === "Abierta" || request.status === "En revision";
export function requestsInSection(requests: InternalRequest[], user: Employee, reports: boolean) {
  return requests.filter(request => requestVisible(request, user) && (request.type === "Reporte") === reports);
}
