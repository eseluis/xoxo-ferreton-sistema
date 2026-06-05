export type Role =
  | "APODERADA_LEGAL"
  | "DIRECTOR"
  | "GERENTE_GENERAL"
  | "ADMIN_GENERAL"
  | "GERENTE_TIENDA"
  | "ADMIN_TIENDA"
  | "JEFE_AREA"
  | "CAJERO"
  | "AUXILIAR";

export type Employee = {
  id: string;
  name: string;
  role: Role;
  roleLabel: string;
  branch: "Corporativo" | "Matriz" | "Sucursal Centro";
  area: string;
  supervisorId?: string;
  shift: "A" | "B" | "Completo" | "Directivo";
  salaryMin?: number;
  salaryMax?: number;
  commissionBase: string;
  phone?: string;
  password?: string;
};

export type RoleProfile = {
  role: Role;
  reportTo: string;
  objective: string;
  baseActivities: string[];
  kpis: string[];
  limits: string[];
};

export type ProcessStep = {
  title: string;
  owner: string;
  time: string;
  evidence: "none" | "photo" | "signature" | "ticket";
};

export type Process = {
  id: string;
  name: string;
  area: string;
  allowedRoles: Role[];
  risk: string;
  notifyOnFailure: string;
  steps: ProcessStep[];
};

export type InternalRule = {
  id: string;
  title: string;
  appliesTo: string;
  policy: string;
  escalation: string;
};

export type ShiftKey = "A" | "B" | "Completo" | "Directivo";

export type ShiftConfig = {
  key: ShiftKey;
  name: string;
  start: string;
  end: string;
  lunchStart: string;
  lunchEnd: string;
  rotation: string;
  assignedBy: string;
};

export type ActivitySchedule = {
  id: string;
  name: string;
  area: string;
  start: string;
  end: string;
  durationMinutes: number;
  ownerRoles: Role[];
  evidence: "none" | "photo" | "signature" | "ticket";
  assignedBy: string;
  editableBy: Role[];
};

export type CleaningRole = {
  activity: string;
  start: string;
  end: string;
  details: string;
  assignments: Record<string, string>;
};

export type DailyTask = {
  id: string;
  title: string;
  employeeId: string;
  assignedById: string;
  date: string;
  start: string;
  end: string;
  status: "Pendiente" | "En proceso" | "Completada" | "Incidencia" | "Pausada";
  priority: "Baja" | "Media" | "Alta";
  notes: string;
  currentStep?: string;
  employeeComment?: string;
  supervisorComment?: string;
  incidentNote?: string;
  paused?: boolean;
  approvalStatus?: "No requerida" | "Pendiente" | "Aprobada";
};

export const roleRank: Record<Role, number> = {
  APODERADA_LEGAL: 1,
  DIRECTOR: 2,
  GERENTE_GENERAL: 3,
  ADMIN_GENERAL: 3,
  GERENTE_TIENDA: 4,
  ADMIN_TIENDA: 4,
  JEFE_AREA: 5,
  CAJERO: 5,
  AUXILIAR: 6,
};

export const defaultEmployees: Employee[] = [
  {
    id: "001",
    name: "Concepcion Barrera Ramirez",
    role: "APODERADA_LEGAL",
    roleLabel: "Apoderada legal",
    branch: "Corporativo",
    area: "Legal",
    shift: "Directivo",
    commissionBase: "Autorizaciones y estructura legal",
  },
  {
    id: "002",
    name: "Serafin Perez Llevenes",
    role: "DIRECTOR",
    roleLabel: "Director / Fundador",
    branch: "Corporativo",
    area: "Direccion",
    supervisorId: "001",
    shift: "Directivo",
    commissionBase: "Direccion general",
  },
  {
    id: "003",
    name: "Luis Angel Perez",
    role: "GERENTE_GENERAL",
    roleLabel: "Gerente general",
    branch: "Matriz",
    area: "Direccion operativa",
    supervisorId: "002",
    shift: "Directivo",
    salaryMin: 4800,
    salaryMax: 5100,
    commissionBase: "Ventas personales y metas globales 1% a 3%",
    phone: "9511251386",
  },
  {
    id: "004",
    name: "Vacante",
    role: "ADMIN_GENERAL",
    roleLabel: "Administrador general",
    branch: "Corporativo",
    area: "Administracion",
    supervisorId: "002",
    shift: "Directivo",
    salaryMin: 4800,
    salaryMax: 5100,
    commissionBase: "Control financiero y ventas personales autorizadas",
  },
  {
    id: "005",
    name: "Daniel",
    role: "GERENTE_TIENDA",
    roleLabel: "Gerente y administrador de tienda",
    branch: "Sucursal Centro",
    area: "Administracion tienda",
    supervisorId: "003",
    shift: "A",
    salaryMin: 4800,
    salaryMax: 5100,
    commissionBase: "Ventas personales de tienda 1% a 3%",
  },
  {
    id: "006",
    name: "Jan Leobec",
    role: "JEFE_AREA",
    roleLabel: "Jefe de area",
    branch: "Matriz",
    area: "Plomeria",
    supervisorId: "003",
    shift: "A",
    salaryMin: 4200,
    salaryMax: 4500,
    commissionBase: "Ventas personales del area 1% a 3%",
  },
  {
    id: "007",
    name: "Anubis",
    role: "CAJERO",
    roleLabel: "Cajera",
    branch: "Matriz",
    area: "Caja",
    supervisorId: "003",
    shift: "B",
    commissionBase: "Evaluacion, caja sin diferencias y ventas personales",
  },
  {
    id: "008",
    name: "Sabina",
    role: "JEFE_AREA",
    roleLabel: "Jefa de area",
    branch: "Matriz",
    area: "Electricidad",
    supervisorId: "003",
    shift: "B",
    salaryMin: 4200,
    salaryMax: 4500,
    commissionBase: "Ventas personales del area 1% a 3%",
  },
  {
    id: "009",
    name: "Julio",
    role: "JEFE_AREA",
    roleLabel: "Jefe de area",
    branch: "Matriz",
    area: "Tornilleria y miscelaneos",
    supervisorId: "003",
    shift: "A",
    salaryMin: 4200,
    salaryMax: 4500,
    commissionBase: "Ventas personales del area 1% a 3%",
  },
  {
    id: "010",
    name: "Celina",
    role: "JEFE_AREA",
    roleLabel: "Jefa de area / Garantias",
    branch: "Matriz",
    area: "Refacciones para electrodomesticos",
    supervisorId: "003",
    shift: "B",
    salaryMin: 4200,
    salaryMax: 4500,
    commissionBase: "Ventas personales y control de garantias",
  },
  {
    id: "011",
    name: "Ruben",
    role: "JEFE_AREA",
    roleLabel: "Jefe de area",
    branch: "Matriz",
    area: "Herramientas",
    supervisorId: "003",
    shift: "A",
    salaryMin: 4200,
    salaryMax: 4500,
    commissionBase: "Ventas personales del area 1% a 3%",
  },
  {
    id: "012",
    name: "Itzai",
    role: "JEFE_AREA",
    roleLabel: "Jefe de area",
    branch: "Matriz",
    area: "Electronica",
    supervisorId: "003",
    shift: "B",
    salaryMin: 4200,
    salaryMax: 4500,
    commissionBase: "Ventas personales del area 1% a 3%",
  },
  {
    id: "013",
    name: "Diego",
    role: "AUXILIAR",
    roleLabel: "Auxiliar",
    branch: "Matriz",
    area: "Apoyo operativo",
    supervisorId: "006",
    shift: "Completo",
    salaryMin: 4000,
    salaryMax: 4200,
    commissionBase: "Disponible al alcanzar etapa 3",
  },
  {
    id: "014",
    name: "Salma",
    role: "AUXILIAR",
    roleLabel: "Auxiliar",
    branch: "Matriz",
    area: "Apoyo operativo",
    supervisorId: "008",
    shift: "Completo",
    salaryMin: 4000,
    salaryMax: 4200,
    commissionBase: "Disponible al alcanzar etapa 3",
  },
  {
    id: "015",
    name: "Monse",
    role: "JEFE_AREA",
    roleLabel: "Plomeria / Caja",
    branch: "Sucursal Centro",
    area: "Plomeria y caja",
    supervisorId: "005",
    shift: "A",
    salaryMin: 4200,
    salaryMax: 4500,
    commissionBase: "Ventas personales del area 1% a 3%",
  },
];

export const employees = defaultEmployees;

export const roleProfiles: RoleProfile[] = [
  {
    role: "GERENTE_GENERAL",
    reportTo: "Director General",
    objective:
      "Asegurar el cumplimiento de la vision estrategica, supervisando sucursales, disciplina organizacional y crecimiento sostenido.",
    baseActivities: [
      "Supervisar desempeno de sucursales",
      "Validar y autorizar pedidos de compra",
      "Tomar decisiones de personal",
      "Evaluar a gerentes y administradores",
      "Resolver conflictos escalados",
      "Asegurar cumplimiento del manual corporativo",
    ],
    kpis: [
      "Punto de equilibrio por sucursal al 100%",
      "Evaluaciones realizadas en fecha",
      "Incidencias criticas resueltas maximo 48 horas",
      "Crecimiento de ventas vs mes anterior",
    ],
    limits: ["No reemplaza el trabajo operativo de tienda como rutina", "No salta la estructura salvo incidencia critica"],
  },
  {
    role: "ADMIN_GENERAL",
    reportTo: "Director General",
    objective: "Garantizar control financiero, administrativo y documental de toda la empresa.",
    baseActivities: [
      "Supervisar administradores de tienda",
      "Validar nomina",
      "Controlar proveedores y cuentas por pagar",
      "Revisar reportes de caja",
      "Preparar reportes financieros para direccion",
    ],
    kpis: ["Reportes exactos", "Nomina validada", "Cuentas y proveedores controlados"],
    limits: ["No toma decisiones comerciales de piso", "No vende como funcion principal"],
  },
  {
    role: "GERENTE_TIENDA",
    reportTo: "Gerente General",
    objective:
      "Asegurar punto de equilibrio y crecimiento de ventas mediante liderazgo del equipo, ejecucion operativa y mejora continua.",
    baseActivities: [
      "Supervisar ventas, KPIs y desempeno del equipo",
      "Autorizar pedidos propuestos por jefes de area",
      "Verificar inventario y recepcion",
      "Detectar fallas operativas",
      "Evaluar diariamente jefes y auxiliares",
      "Custodiar caja de herramientas comun",
    ],
    kpis: [
      "Punto de equilibrio mensual 100%",
      "Caja de herramientas completa al cierre",
      "Evaluaciones diarias realizadas",
      "Clientes nuevos registrados",
    ],
    limits: ["Dirige e interviene cuando falla el proceso, no opera en exceso como rutina"],
  },
  {
    role: "ADMIN_TIENDA",
    reportTo: "Administrador General",
    objective: "Garantizar control administrativo, financiero y documental de la tienda.",
    baseActivities: [
      "Control de caja, cortes y arqueos",
      "Supervision de ingresos y egresos",
      "Ingreso de facturas al sistema",
      "Asignacion de precios segun formulas internas",
      "Generacion de tickets de retiro",
      "Resolucion de incidencias de caja",
    ],
    kpis: ["Diferencias en caja $0", "Retiros documentados 100%", "Facturas ingresadas el mismo dia"],
    limits: ["No vende ni toma decisiones comerciales como funcion principal"],
  },
  {
    role: "JEFE_AREA",
    reportTo: "Gerente de Tienda",
    objective:
      "Generar ventas rentables en su area, controlar inventario, exhibicion, recepcion de mercancia y desarrollo del auxiliar.",
    baseActivities: [
      "Atencion directa e inmediata al cliente",
      "Diagnostico y propuesta de solucion correcta",
      "Venta complementaria obligatoria",
      "Anotar folio y monto del ticket",
      "Control diario de productos clave",
      "Solicitud de pedidos al gerente",
      "Recepcion de mercancia a detalle",
      "Capacitacion de auxiliar",
    ],
    kpis: [
      "Ventas del area vs punto de equilibrio",
      "Inventario, exhibicion y almacen en buen estado",
      "Ticket promedio del area en crecimiento",
      "Equipo personal completo al cierre",
    ],
    limits: ["No autoriza compras finales", "No entrega mercancia sin ticket", "No abandona su area sin canalizar"],
  },
  {
    role: "CAJERO",
    reportTo: "Administrador de Tienda",
    objective: "Garantizar cobros correctos, control de efectivo e incidencias documentadas.",
    baseActivities: [
      "Cobro en efectivo, tarjeta y transferencia",
      "Emitir tickets con monto, tipo de pago y vendedor",
      "Registrar incidencias de caja",
      "Retirar efectivo solo contra ticket de administrador",
      "Corte de caja con administrador",
    ],
    kpis: ["Diferencias en caja $0", "Tickets completos 100%", "Incidencias documentadas 100%"],
    limits: ["No modifica ni cancela tickets por su cuenta", "No autoriza devoluciones o garantias", "Su prioridad es caja"],
  },
  {
    role: "AUXILIAR",
    reportTo: "Jefe de Area",
    objective: "Apoyar la operacion del area, mantener orden, aprender productos y atender clientes.",
    baseActivities: [
      "Mantener area ordenada y limpia",
      "Apoyar al jefe de area",
      "Atender clientes sin ignorarlos",
      "Aprender productos, ubicacion y usos",
      "Apoyar en acomodo y etiquetado",
      "Detectar faltantes y reportarlos al jefe",
    ],
    kpis: ["Aprendizaje constante", "Atencion al cliente sin omisiones", "Orden y limpieza diaria", "Equipo personal completo"],
    limits: ["No decide compras", "No reporta saltando niveles", "No autoriza procesos fuera de su puesto"],
  },
  {
    role: "DIRECTOR",
    reportTo: "Apoderada legal / Consejo",
    objective: "Define vision, expansion y decisiones estrategicas.",
    baseActivities: ["Definir estructura", "Autorizar cambios criticos", "Dirigir crecimiento"],
    kpis: ["Estructura replicable", "Crecimiento controlado", "Delegacion clara"],
    limits: ["No opera la tienda como rutina"],
  },
  {
    role: "APODERADA_LEGAL",
    reportTo: "Marco legal de la empresa",
    objective: "Representacion legal y autorizacion corporativa.",
    baseActivities: ["Resguardar representacion legal", "Validar temas corporativos"],
    kpis: ["Cumplimiento legal", "Documentacion vigente"],
    limits: ["No participa en operacion diaria salvo autorizacion"],
  },
];

export const shifts = {
  A: "8:00 am - 5:30 pm / comida 1:00 pm - 2:30 pm",
  B: "9:30 am - 7:00 pm / comida 2:30 pm - 4:00 pm",
  Completo: "8:00 am - 7:00 pm / comida 2:00 pm - 3:00 pm",
  Directivo: "Horario directivo segun operacion",
};

export const defaultShiftConfigs: ShiftConfig[] = [
  {
    key: "A",
    name: "Turno A",
    start: "08:00",
    end: "17:30",
    lunchStart: "13:00",
    lunchEnd: "14:30",
    rotation: "Rota cada 15 dias con Turno B",
    assignedBy: "Directivos y gerentes",
  },
  {
    key: "B",
    name: "Turno B",
    start: "09:30",
    end: "19:00",
    lunchStart: "14:30",
    lunchEnd: "16:00",
    rotation: "Rota cada 15 dias con Turno A",
    assignedBy: "Directivos y gerentes",
  },
  {
    key: "Completo",
    name: "Auxiliares completo",
    start: "08:00",
    end: "19:00",
    lunchStart: "14:00",
    lunchEnd: "15:00",
    rotation: "Asignacion fija mientras direccion lo autorice",
    assignedBy: "Directivos",
  },
  {
    key: "Directivo",
    name: "Directivo",
    start: "08:00",
    end: "19:00",
    lunchStart: "Segun operacion",
    lunchEnd: "Segun operacion",
    rotation: "No rota automaticamente",
    assignedBy: "Dueno / Director",
  },
];

export const cleaningTasks = [
  "Lavar bano 1",
  "Lavar bano 2",
  "Barrer mostrador y exhibicion",
  "Barrer entrada",
  "Trapear entrada",
  "Barrer banqueta y cajon de estacionamiento",
  "Lavar franelas",
  "Acomodar mercancia",
  "Limpieza mostrador herramientas",
  "Limpieza mostrador electrodomesticos",
  "Limpieza mostrador tornillos",
  "Limpieza mostrador plomeria",
  "Tirar basura sabado",
];

export const weekDays = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

export const defaultCleaningRole: CleaningRole[] = [
  {
    activity: "Barrer en frente",
    start: "08:30",
    end: "09:00",
    details:
      "Barrido del estacionamiento y banqueta, barrido y trapeado del area de electrodomesticos, limpieza del mostrador y exhibicion central.",
    assignments: {
      Lunes: "Itzai",
      Martes: "Celina",
      Miercoles: "Sabina",
      Jueves: "Ruben",
      Viernes: "Celina",
      Sabado: "Salma",
      Domingo: "Anubis",
    },
  },
  {
    activity: "Lavar bano 1",
    start: "08:30",
    end: "09:00",
    details: "Lavado de franelas y del bano 1.",
    assignments: {
      Lunes: "Celina",
      Martes: "Jan",
      Miercoles: "Ruben / Anubis",
      Jueves: "Jan",
      Viernes: "Itzai",
      Sabado: "Ruben",
      Domingo: "Sabina",
    },
  },
  {
    activity: "Barrer atras",
    start: "09:00",
    end: "09:30",
    details:
      "Barrido del frente y por detras del mostrador general, vaciado de cubeta blanca, barrido del area del fondo incluyendo taller y acomodo de cartones.",
    assignments: {
      Lunes: "Jan",
      Martes: "Ruben / Anubis",
      Miercoles: "Celina",
      Jueves: "Itzai",
      Viernes: "Ruben",
      Sabado: "Diego",
      Domingo: "Salma",
    },
  },
  {
    activity: "Lavar bano 2",
    start: "08:30",
    end: "09:00",
    details: "Lavar el bano 2 incluyendo area de regadera.",
    assignments: {
      Lunes: "Sabina",
      Martes: "Itzai",
      Miercoles: "Jan",
      Jueves: "Sabina",
      Viernes: "Jan",
      Sabado: "Itzai",
      Domingo: "Ruben",
    },
  },
  {
    activity: "Trapear atras",
    start: "09:00",
    end: "09:30",
    details: "Trapeado del frente y por detras del mostrador general.",
    assignments: {
      Lunes: "Ruben",
      Martes: "",
      Miercoles: "Itzai",
      Jueves: "",
      Viernes: "Sabina",
      Sabado: "",
      Domingo: "Diego",
    },
  },
  {
    activity: "Acomodo de basura",
    start: "18:20",
    end: "18:40",
    details: "Acomodo de basura y cartones; informar al encargado del rol para revision.",
    assignments: {
      Lunes: "",
      Martes: "",
      Miercoles: "",
      Jueves: "",
      Viernes: "Jan / Diego / Ruben",
      Sabado: "Jan / Diego / Ruben",
      Domingo: "",
    },
  },
];

export const defaultActivitySchedules: ActivitySchedule[] = [
  {
    id: "apertura-puertas",
    name: "Abrir puertas y revisar seguridad",
    area: "Apertura",
    start: "08:00",
    end: "08:05",
    durationMinutes: 5,
    ownerRoles: ["GERENTE_TIENDA"],
    evidence: "none",
    assignedBy: "Gerente de tienda",
    editableBy: ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL"],
  },
  {
    id: "apertura-sistema-caja",
    name: "Encender POS, impresoras y validar fondo",
    area: "Caja",
    start: "08:00",
    end: "08:10",
    durationMinutes: 10,
    ownerRoles: ["CAJERO", "ADMIN_TIENDA"],
    evidence: "signature",
    assignedBy: "Administrador / Gerente",
    editableBy: ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL"],
  },
  {
    id: "brief-apertura",
    name: "Brief de apertura: meta, producto foco y prioridad",
    area: "Direccion tienda",
    start: "08:10",
    end: "08:15",
    durationMinutes: 5,
    ownerRoles: ["GERENTE_TIENDA", "JEFE_AREA", "CAJERO", "AUXILIAR"],
    evidence: "none",
    assignedBy: "Gerente",
    editableBy: ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL"],
  },
  {
    id: "venta-publico",
    name: "Apertura de venta al publico",
    area: "Ventas",
    start: "08:15",
    end: "08:30",
    durationMinutes: 15,
    ownerRoles: ["GERENTE_TIENDA", "JEFE_AREA", "AUXILIAR"],
    evidence: "none",
    assignedBy: "Gerente",
    editableBy: ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL"],
  },
  {
    id: "aseo-bloque-1",
    name: "Aseo bloque 1: banos, frente y exhibicion",
    area: "Aseo",
    start: "08:30",
    end: "09:00",
    durationMinutes: 30,
    ownerRoles: ["JEFE_AREA", "CAJERO", "AUXILIAR"],
    evidence: "none",
    assignedBy: "Directivos / Gerente",
    editableBy: ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL", "GERENTE_TIENDA"],
  },
  {
    id: "aseo-bloque-2",
    name: "Aseo bloque 2: trapear, banqueta, franelas",
    area: "Aseo",
    start: "09:00",
    end: "09:30",
    durationMinutes: 30,
    ownerRoles: ["JEFE_AREA", "CAJERO", "AUXILIAR"],
    evidence: "none",
    assignedBy: "Directivos / Gerente",
    editableBy: ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL", "GERENTE_TIENDA"],
  },
  {
    id: "revision-area-inicio",
    name: "Revision de area, exhibicion, faltantes y equipo personal",
    area: "Operacion de area",
    start: "09:30",
    end: "10:00",
    durationMinutes: 30,
    ownerRoles: ["JEFE_AREA", "AUXILIAR"],
    evidence: "none",
    assignedBy: "Gerente / Jefe de area",
    editableBy: ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL", "GERENTE_TIENDA"],
  },
  {
    id: "acomodo-mercancia",
    name: "Acomodar mercancia pendiente",
    area: "Inventario",
    start: "10:00",
    end: "11:00",
    durationMinutes: 60,
    ownerRoles: ["JEFE_AREA", "AUXILIAR"],
    evidence: "photo",
    assignedBy: "Gerente / Jefe de area",
    editableBy: ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL", "GERENTE_TIENDA"],
  },
  {
    id: "revision-200",
    name: "Revision visual de productos clave e inventario del area",
    area: "Inventario",
    start: "11:00",
    end: "12:00",
    durationMinutes: 60,
    ownerRoles: ["JEFE_AREA"],
    evidence: "none",
    assignedBy: "Gerente",
    editableBy: ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL", "GERENTE_TIENDA"],
  },
  {
    id: "corte-parcial",
    name: "Revision parcial de caja e incidencias",
    area: "Caja",
    start: "14:00",
    end: "14:20",
    durationMinutes: 20,
    ownerRoles: ["CAJERO", "ADMIN_TIENDA"],
    evidence: "ticket",
    assignedBy: "Administrador",
    editableBy: ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL"],
  },
  {
    id: "cierre-area",
    name: "Cierre de area, equipo personal y mostradores despejados",
    area: "Cierre",
    start: "18:20",
    end: "18:50",
    durationMinutes: 30,
    ownerRoles: ["JEFE_AREA", "AUXILIAR"],
    evidence: "none",
    assignedBy: "Gerente / Jefe de area",
    editableBy: ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL", "GERENTE_TIENDA"],
  },
  {
    id: "corte-cierre",
    name: "Corte de caja, resguardo y cierre de sistema",
    area: "Caja",
    start: "19:00",
    end: "19:20",
    durationMinutes: 20,
    ownerRoles: ["CAJERO", "ADMIN_TIENDA", "GERENTE_TIENDA"],
    evidence: "signature",
    assignedBy: "Administrador / Gerente",
    editableBy: ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL"],
  },
];

export const evaluationCriteria = [
  "Puntualidad y entrada a tiempo",
  "Atencion al cliente y proceso correcto",
  "Actitud y disposicion durante el dia",
  "Orden y limpieza del area",
  "Cumplimiento de actividades asignadas",
  "Trabajo en equipo y apoyo entre areas",
  "Uso correcto del equipo personal",
  "Ventas del area / resultado del dia",
];

export const processes: Process[] = [
  {
    id: "apertura",
    name: "Apertura de tienda",
    area: "Operacion diaria",
    allowedRoles: ["GERENTE_TIENDA", "ADMIN_TIENDA", "CAJERO", "JEFE_AREA", "AUXILIAR"],
    risk: "Si abre tarde, se registra incidencia y afecta evaluacion diaria.",
    notifyOnFailure: "Gerente general",
    steps: [
      { title: "Seguridad, candados y cortinas", owner: "Gerente", time: "8:00 - 8:05", evidence: "none" },
      { title: "Sistema POS, impresoras y fondo inicial", owner: "Cajero + Administrador", time: "8:00 - 8:10", evidence: "signature" },
      { title: "Validacion final de caja, sistema y personal", owner: "Gerente + Administrador", time: "8:10 - 8:15", evidence: "signature" },
      { title: "Apertura al publico", owner: "Gerente", time: "8:15", evidence: "none" },
    ],
  },
  {
    id: "venta",
    name: "Venta con solucion completa",
    area: "Ventas",
    allowedRoles: ["JEFE_AREA", "AUXILIAR", "GERENTE_TIENDA"],
    risk: "Mala atencion, venta incompleta o entrega sin ticket afecta bonos.",
    notifyOnFailure: "Gerente general",
    steps: [
      { title: "Deteccion maximo 5 segundos", owner: "Jefe / Auxiliar", time: "Inmediato", evidence: "none" },
      { title: "Diagnostico del problema", owner: "Vendedor responsable", time: "Durante atencion", evidence: "none" },
      { title: "Proponer minimo 2 opciones", owner: "Vendedor responsable", time: "Durante atencion", evidence: "none" },
      { title: "Venta complementaria obligatoria", owner: "Vendedor responsable", time: "Durante atencion", evidence: "none" },
      { title: "Folio, monto y envio a caja", owner: "Vendedor responsable", time: "Cierre venta", evidence: "ticket" },
      { title: "Entrega solo con ticket pagado", owner: "Vendedor responsable", time: "Despues de caja", evidence: "ticket" },
    ],
  },
  {
    id: "caja",
    name: "Corte e incidencias de caja",
    area: "Caja",
    allowedRoles: ["CAJERO", "ADMIN_TIENDA", "GERENTE_TIENDA"],
    risk: "Diferencia en caja es falta grave y bloquea cierre hasta documentar.",
    notifyOnFailure: "Gerente general",
    steps: [
      { title: "Validar fondo inicial", owner: "Cajero + Administrador", time: "Inicio", evidence: "signature" },
      { title: "Registrar ticket con vendedor y metodo de pago", owner: "Cajero", time: "Cada venta", evidence: "ticket" },
      { title: "Retiro solo con ticket del administrador", owner: "Cajero", time: "Caja > $10,000", evidence: "ticket" },
      { title: "Corte y diferencias documentadas", owner: "Cajero + Administrador", time: "Cierre", evidence: "signature" },
    ],
  },
  {
    id: "entrega-mercancia",
    name: "Entrega de mercancia con ticket pagado",
    area: "Ventas / Caja",
    allowedRoles: ["JEFE_AREA", "AUXILIAR", "CAJERO", "GERENTE_TIENDA"],
    risk: "No se entrega producto sin ticket original pagado y validado.",
    notifyOnFailure: "Gerente general",
    steps: [
      { title: "Solicitar ticket pagado al cliente", owner: "Jefe / Auxiliar", time: "Al entregar", evidence: "ticket" },
      { title: "Comparar folio, monto, cantidad y producto", owner: "Jefe / Auxiliar", time: "Antes de entregar", evidence: "ticket" },
      { title: "Contar articulos frente al cliente", owner: "Jefe / Auxiliar", time: "Entrega", evidence: "none" },
      { title: "Confirmar conformidad del cliente", owner: "Responsable de entrega", time: "Entrega", evidence: "signature" },
      { title: "Documentar cualquier diferencia", owner: "Gerente / Cajero", time: "Inmediato", evidence: "photo" },
    ],
  },
  {
    id: "garantias",
    name: "Garantias a proveedores",
    area: "Refacciones",
    allowedRoles: ["JEFE_AREA", "GERENTE_TIENDA", "GERENTE_GENERAL"],
    risk: "Producto defectuoso sin control genera perdida y afecta inventario.",
    notifyOnFailure: "Gerente general",
    steps: [
      { title: "Recibir producto y registrar proveedor, producto y motivo", owner: "Celina / Jefe de area", time: "Al detectar falla", evidence: "photo" },
      { title: "Inspeccionar y clasificar: procede, no procede o revision", owner: "Responsable de garantia", time: "Mismo dia", evidence: "photo" },
      { title: "Notificar al gerente y registrar caso", owner: "Responsable de garantia", time: "Mismo dia", evidence: "signature" },
      { title: "Notificar proveedor y etiquetar producto defectuoso", owner: "Responsable de garantia", time: "Antes de enviar", evidence: "photo" },
      { title: "Seguimiento hasta devolucion, reposicion o cierre", owner: "Responsable de garantia", time: "Abierto", evidence: "none" },
    ],
  },
  {
    id: "compras",
    name: "Compras y proveedores",
    area: "Inventario",
    allowedRoles: ["JEFE_AREA", "GERENTE_TIENDA", "ADMIN_TIENDA", "GERENTE_GENERAL"],
    risk: "Ningun pedido se envia sin autorizacion del gerente general.",
    notifyOnFailure: "Gerente general",
    steps: [
      { title: "Auxiliar detecta faltante", owner: "Auxiliar", time: "Diario", evidence: "none" },
      { title: "Jefe revisa toda el area", owner: "Jefe de area", time: "Diario", evidence: "none" },
      { title: "Jefe crea lista formal en ERP u orden interna", owner: "Jefe de area", time: "Antes de pedir", evidence: "signature" },
      { title: "Gerente valida stock, rotacion y proveedor", owner: "Gerente tienda", time: "Antes de pedir", evidence: "signature" },
      { title: "Gerente general autoriza compra", owner: "Gerente general", time: "Antes de enviar", evidence: "signature" },
      { title: "Jefe y administrador dan seguimiento al proveedor", owner: "Jefe + Administrador", time: "Hasta recepcion", evidence: "none" },
    ],
  },
  {
    id: "recepcion-mercancia",
    name: "Recepcion de mercancia",
    area: "Inventario",
    allowedRoles: ["JEFE_AREA", "GERENTE_TIENDA", "ADMIN_TIENDA", "GERENTE_GENERAL"],
    risk: "Nunca se firma factura sin revisar mercancia. Lo que se firma, se acepta.",
    notifyOnFailure: "Gerente general",
    steps: [
      { title: "Identificar proveedor, flete y area correspondiente", owner: "Jefe de area", time: "Al llegar proveedor", evidence: "none" },
      { title: "Revisar cantidad, codigo, funcionamiento, estetica, medidas y calidad", owner: "Jefe de area", time: "Recepcion", evidence: "photo" },
      { title: "Anotar anomalías en ambos juegos de factura", owner: "Jefe de area", time: "Antes de firmar", evidence: "signature" },
      { title: "Entregar factura firmada al administrador", owner: "Jefe de area", time: "Al terminar revision", evidence: "signature" },
      { title: "Dar de alta factura en ERP", owner: "Administrador de tienda", time: "Despues de recibir factura", evidence: "signature" },
      { title: "Ajustar precios con factor y formula interna", owner: "Administrador de tienda", time: "Despues de ERP", evidence: "signature" },
      { title: "Acomodar, etiquetar y exhibir mercancia", owner: "Jefe de area + Auxiliar", time: "Despues de precios", evidence: "photo" },
      { title: "Verificacion final de ERP, precios y existencias", owner: "Gerente tienda", time: "Antes de cierre", evidence: "signature" },
    ],
  },
  {
    id: "revision-inventario-area",
    name: "Revision diaria de inventario del area",
    area: "Inventario",
    allowedRoles: ["JEFE_AREA", "GERENTE_TIENDA", "ADMIN_TIENDA", "GERENTE_GENERAL"],
    risk: "El jefe de area responde por inventario, exhibicion y almacen de su espacio.",
    notifyOnFailure: "Gerente general",
    steps: [
      { title: "Revisar productos clave al inicio", owner: "Jefe de area", time: "9:30 - 10:00", evidence: "none" },
      { title: "Detectar faltantes, mala exhibicion o producto pendiente", owner: "Jefe de area", time: "Durante el dia", evidence: "none" },
      { title: "Reportar pedidos necesarios al gerente", owner: "Jefe de area", time: "Antes de cierre", evidence: "signature" },
      { title: "Confirmar equipo personal completo al cierre", owner: "Jefe de area", time: "18:20 - 18:50", evidence: "none" },
    ],
  },
  {
    id: "fletes-envios",
    name: "Fletes y envios",
    area: "Logistica",
    allowedRoles: ["GERENTE_TIENDA", "ADMIN_TIENDA", "JEFE_AREA", "AUXILIAR"],
    risk: "Envio sin formato, firma o cobro documentado genera perdida directa.",
    notifyOnFailure: "Gerente general",
    steps: [
      { title: "Validar pedido, ticket, direccion y monto minimo", owner: "Gerente / Administrador", time: "Antes de cargar", evidence: "ticket" },
      { title: "Asignar salida 9:00, 13:00 o 17:00", owner: "Gerente / Administrador", time: "Programacion", evidence: "none" },
      { title: "Llenar formato de entrega completo", owner: "Responsable de envio", time: "Antes de salir", evidence: "signature" },
      { title: "Recabar firma de recibido", owner: "Responsable de envio", time: "Entrega", evidence: "signature" },
      { title: "Documentar cobros en ruta y retorno", owner: "Responsable + Cajero", time: "Regreso", evidence: "ticket" },
    ],
  },
  {
    id: "devoluciones-cambios",
    name: "Devoluciones y cambios",
    area: "Caja / Garantias",
    allowedRoles: ["GERENTE_TIENDA", "ADMIN_TIENDA", "GERENTE_GENERAL"],
    risk: "Toda devolucion necesita justificacion, evidencia y autorizacion.",
    notifyOnFailure: "Gerente general",
    steps: [
      { title: "Validar ticket, producto y motivo", owner: "Gerente / Administrador", time: "Al recibir solicitud", evidence: "ticket" },
      { title: "Confirmar si procede cambio, garantia o devolucion", owner: "Gerente", time: "Revision", evidence: "photo" },
      { title: "Autorizar devolucion solo si no se puede surtir o reponer", owner: "Gerente", time: "Antes de caja", evidence: "signature" },
      { title: "Registrar documento firmado y justificacion", owner: "Cajero / Administrador", time: "Al cerrar caso", evidence: "signature" },
      { title: "Evitar devolucion en efectivo para pagos con tarjeta", owner: "Cajero", time: "Caja", evidence: "ticket" },
    ],
  },
  {
    id: "cliente-dificil",
    name: "Cliente dificil o agresivo",
    area: "Atencion y seguridad",
    allowedRoles: ["GERENTE_TIENDA", "ADMIN_TIENDA", "JEFE_AREA", "CAJERO"],
    risk: "La prioridad es contener sin escalar el conflicto ni comprometer al equipo.",
    notifyOnFailure: "Gerente general",
    steps: [
      { title: "Escuchar y contener sin discutir", owner: "Primer responsable", time: "Inmediato", evidence: "none" },
      { title: "Escalar a gerente o administrador", owner: "Primer responsable", time: "Si no se resuelve", evidence: "none" },
      { title: "Registrar motivo, cliente y solucion propuesta", owner: "Gerente / Administrador", time: "Mismo dia", evidence: "signature" },
      { title: "Negar servicio si existe agresion o riesgo", owner: "Gerente", time: "Critico", evidence: "signature" },
      { title: "Escalar a gerente general o autoridad si aplica", owner: "Gerente", time: "Critico", evidence: "none" },
    ],
  },
  {
    id: "errores-internos",
    name: "Reporte de errores internos",
    area: "Gestion",
    allowedRoles: ["GERENTE_TIENDA", "ADMIN_TIENDA", "JEFE_AREA", "CAJERO", "AUXILIAR"],
    risk: "Error no reportado se vuelve falta mayor cuando afecta caja, inventario o cliente.",
    notifyOnFailure: "Gerente general",
    steps: [
      { title: "Reportar error al superior inmediato", owner: "Colaborador", time: "Inmediato", evidence: "none" },
      { title: "Clasificar operativo, comercial, critico o grave", owner: "Gerente / Administrador", time: "Mismo dia", evidence: "signature" },
      { title: "Definir correccion y responsable", owner: "Gerente / Administrador", time: "Mismo dia", evidence: "signature" },
      { title: "Revisar en junta semanal de 10 a 15 minutos", owner: "Gerente", time: "Semanal", evidence: "none" },
    ],
  },
];

export const internalRules: InternalRule[] = [
  {
    id: "retardos",
    title: "Retardos y asistencia",
    appliesTo: "Todo el personal",
    policy: "Retardo despues de 8:15. Maximo 3 retardos por mes; al quinto se levanta reporte, se envia a casa y el dia queda como falta sin goce.",
    escalation: "Gerente general",
  },
  {
    id: "faltas",
    title: "Faltas injustificadas",
    appliesTo: "Todo el personal",
    policy: "Tres faltas injustificadas en el mes generan suspension de tres dias sin goce.",
    escalation: "Gerente general",
  },
  {
    id: "permisos",
    title: "Permisos",
    appliesTo: "Todo el personal",
    policy: "Permiso ordinario con 48 horas de anticipacion. Emergencia el mismo dia solo con justificacion.",
    escalation: "Superior inmediato",
  },
  {
    id: "salud",
    title: "Enfermedad y apoyo medico",
    appliesTo: "Todo el personal",
    policy: "Incapacidad o consulta requiere evidencia IMSS o privada. Apoyo medico se solicita al administrador de tienda para canalizar con administracion general.",
    escalation: "Administrador general",
  },
  {
    id: "tiempo-extra",
    title: "Tiempo extra",
    appliesTo: "Todo el personal",
    policy: "Solo se reconoce si fue autorizado previamente por gerente.",
    escalation: "Gerente de tienda",
  },
  {
    id: "disciplina",
    title: "Medidas disciplinarias",
    appliesTo: "Todo el personal",
    policy: "Escala: llamada verbal, advertencia escrita por gerente general, suspension o baja por gerente general.",
    escalation: "Gerente general",
  },
  {
    id: "uniforme-celular",
    title: "Uniforme, celular y conducta",
    appliesTo: "Todo el personal",
    policy: "Uniforme y conducta profesional obligatoria. Uso de celular solo cuando no afecte atencion, caja, seguridad o procesos.",
    escalation: "Superior inmediato",
  },
];

export const todayKey = () => new Date().toISOString().slice(0, 10);

export function getCleaningAssignment(employeeId: string, date = new Date()) {
  const employee = employees.find((person) => person.id === employeeId);
  const dayName = weekDays[(date.getDay() + 6) % 7];
  const assigned = defaultCleaningRole.find((row) =>
    row.assignments[dayName]
      .toLowerCase()
      .split("/")
      .map((name) => name.trim())
      .includes((employee?.name ?? "").toLowerCase()),
  );
  if (assigned) return `${assigned.activity} (${assigned.start} - ${assigned.end})`;
  const dayNumber = Math.floor(date.getTime() / 86400000);
  const index = (Number(employeeId) + dayNumber) % cleaningTasks.length;
  return `${cleaningTasks[index]} (por asignar)`;
}

export function currentSupervisor(employee: Employee, list: Employee[] = employees) {
  return list.find((person) => person.id === employee.supervisorId);
}

export function canAssign(from: Employee, to: Employee) {
  return roleRank[from.role] < roleRank[to.role];
}

export function canViewAll(employee: Employee) {
  return ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL"].includes(employee.role);
}

export function canGovern(employee: Employee) {
  return ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL"].includes(employee.role);
}

export function commissionRate(score: number, salesGoal: number, personalSales: number) {
  if (score >= 9 && personalSales >= salesGoal * 1.05) return 0.03;
  if (score >= 8.5 && personalSales >= salesGoal) return 0.02;
  return score >= 8 ? 0.01 : 0;
}
