// Local-only fixture: no authentication, saves or production data.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { EvidenceCaptured, RequestsView, TasksView, MyWorkFocus } from "../src/App";
import { defaultEmployees, defaultActivitySchedules, defaultShiftConfigs, type DailyTask } from "../src/data";
import "../src/styles.css";

const manager = defaultEmployees.find((employee) => employee.id === "003")!;
const colleague = defaultEmployees.find((employee) => employee.role === "AUXILIAR")!;
const picture = { dataUrl: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#14694e"/><text x="80" y="400" font-size="70" fill="white">Evidencia de prueba 1200 × 800</text></svg>')}`, capturedAt: "2026-08-30T16:00:00Z" };
const initial: DailyTask[] = ["2026-08-30", "2026-08-31"].map((date, index) => ({
  id: `test-${index}`, title: `Tarea de prueba ${date}`, employeeId: colleague.id,
  assignedById: "001", date, start: "10:00", end: "11:00", status: "Pendiente",
  priority: "Media", notes: "1. Revisar los productos del estante asignado.\n2. Separar y reportar los productos dañados.\n3. Ordenar por medida y dejar las etiquetas visibles.\nResultado esperado: estante limpio, ordenado y con evidencia del antes y después.", requiresPhoto: true,
}));
function Fixture() {
  const [tasks, setTasks] = useState(initial);
  const [requests, setRequests] = useState([{
    id: "request-test", type: "Solicitud" as const, title: "Solicitud de prueba", message: "Registro de prueba local",
    requestedById: colleague.id, recipientId: manager.id, date: "2026-08-30", priority: "Media" as const,
    status: "Abierta" as const, confidentiality: "Normal" as const, response: "",
  }]);
  return <main style={{ padding: 24 }}><h1>Pruebas locales · no se guardan datos</h1>
    <MyWorkFocus user={colleague} date="2026-08-30" location={colleague.branch} schedules={defaultActivitySchedules} tasks={tasks} runs={[]} shift={defaultShiftConfigs.find(shift => shift.key === colleague.shift)} onNavigate={() => {}} />
    <EvidenceCaptured value={picture} label="Evidencia de prueba" readOnly onClear={() => {}} retakeLabel="" />
    <TasksView user={manager} collaborators={defaultEmployees} dailyTasks={tasks} setDailyTasks={setTasks} onRemoveTask={task => setTasks(current => current.filter(item => item.id !== task.id))} workLocations={[]} assignWorkLocation={() => {}} />
    <RequestsView user={manager} collaborators={defaultEmployees} internalRequests={requests} setInternalRequests={(next) => setRequests(next as typeof requests)} addInternalRequest={(event) => event.preventDefault()} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
