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
  employeeIds?: string[];
  branch?: "Corporativo" | "Matriz" | "Sucursal Centro";
  instructions?: string;
};

export type CleaningRole = {
  branch: "Matriz" | "Sucursal Centro";
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
  assignedAt?: string;
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
  slaMinutes?: number;
  startedAt?: string;
  completedAt?: string;
  escalated?: boolean;
  requiresPhoto?: boolean;
  // Si es false, quitar o incumplir esta actividad no genera penalización de evaluación
  // (útil para tareas extra/de apoyo que no deben afectar la calificación del colaborador).
  affectsEvaluation?: boolean;
  beforeEvidenceCapture?: { dataUrl: string; capturedAt: string; lat?: number; lng?: number; accuracyM?: number };
  afterEvidenceCapture?: { dataUrl: string; capturedAt: string; lat?: number; lng?: number; accuracyM?: number };
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
    branch: "Sucursal Centro",
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
    shift: "A",
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
    shift: "A",
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
    shift: "B",
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
    branch: "Matriz",
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
    branch: "Matriz",
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
    branch: "Matriz",
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
    branch: "Matriz",
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
    branch: "Matriz",
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
    branch: "Matriz",
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
  { branch:"Sucursal Centro",activity:"Barrer toda la tienda",start:"09:00",end:"10:00",details:"Daniel barre toda la tienda sin descuidar la entrada.",assignments:{Lunes:"Daniel",Martes:"Daniel",Miercoles:"Daniel",Jueves:"Daniel",Viernes:"Daniel",Sabado:"Daniel",Domingo:"Daniel"} },
  { branch:"Sucursal Centro",activity:"Trapear toda la tienda",start:"09:00",end:"10:00",details:"Jan trapea toda la tienda manteniendo paso seguro para clientes.",assignments:{Lunes:"Jan",Martes:"Jan",Miercoles:"Jan",Jueves:"Jan",Viernes:"Jan",Sabado:"Jan",Domingo:"Jan"} },
  { branch:"Sucursal Centro",activity:"Limpieza de baño 1",start:"09:00",end:"10:00",details:"Lavado y desinfección completa del baño 1.",assignments:{Lunes:"Daniel",Martes:"Daniel",Miercoles:"Daniel",Jueves:"Daniel",Viernes:"Daniel",Sabado:"Daniel",Domingo:"Daniel"} },
  { branch:"Sucursal Centro",activity:"Limpieza de baño 2",start:"09:00",end:"10:00",details:"Lavado y desinfección completa del baño 2.",assignments:{Lunes:"Jan",Martes:"Jan",Miercoles:"Jan",Jueves:"Jan",Viernes:"Jan",Sabado:"Jan",Domingo:"Jan"} },
  { branch:"Sucursal Centro",activity:"Mostradores, trapos y zona de trabajo",start:"09:00",end:"10:00",details:"Daniel limpia mostradores, trapos y área de atención.",assignments:{Lunes:"Daniel",Martes:"Daniel",Miercoles:"Daniel",Jueves:"Daniel",Viernes:"Daniel",Sabado:"Daniel",Domingo:"Daniel"} },
  { branch:"Sucursal Centro",activity:"Basura, plantas y orden exterior",start:"17:00",end:"18:00",details:"Jan ordena basura y plantas y deja limpia la zona exterior.",assignments:{Lunes:"Jan",Martes:"Jan",Miercoles:"Jan",Jueves:"Jan",Viernes:"Jan",Sabado:"Jan",Domingo:"Jan"} },
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
  { id:"matriz-celina-apertura-caja",name:"Verificar fondo, abrir caja y dejarla lista",area:"Caja",start:"08:00",end:"08:10",durationMinutes:10,ownerRoles:["JEFE_AREA"],employeeIds:["010"],branch:"Matriz",evidence:"signature",assignedBy:"Gerencia",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL","GERENTE_TIENDA"],instructions:"Contar fondo, encender sistema y documentar cualquier diferencia. La atención al cliente conserva prioridad." },
  { id:"matriz-turno1-exhibicion",name:"Limpiar mostrador, acomodar mercancía y atender clientes",area:"Exhibición",start:"08:30",end:"09:00",durationMinutes:30,ownerRoles:["JEFE_AREA"],employeeIds:["009","010"],branch:"Matriz",evidence:"photo",assignedBy:"Gerencia",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL","GERENTE_TIENDA"],instructions:"Trabajar por zona pequeña y suspender la actividad para recibir de inmediato a cualquier cliente." },
  { id:"matriz-sabina-bloque1",name:"Aseo asignado y atención prioritaria al cliente",area:"Aseo",start:"08:30",end:"09:00",durationMinutes:30,ownerRoles:["JEFE_AREA"],employeeIds:["008"],branch:"Matriz",evidence:"photo",assignedBy:"Gerencia",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL","GERENTE_TIENDA"],instructions:"Cumplir el rol de aseo sin dejar de saludar, orientar o canalizar clientes." },
  { id:"matriz-turno1-bloque2",name:"Aseo Celina, limpieza Sabina y orden de isla de tornillería Julio",area:"Aseo y exhibición",start:"09:00",end:"09:30",durationMinutes:30,ownerRoles:["JEFE_AREA"],employeeIds:["008","009","010"],branch:"Matriz",evidence:"photo",assignedBy:"Gerencia",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL","GERENTE_TIENDA"],instructions:"Celina realiza aseo; Sabina limpia su área; Julio ordena y acomoda la isla de tornillería." },
  { id:"matriz-anubis-caja",name:"Recibir y verificar caja del turno",area:"Caja",start:"09:30",end:"10:00",durationMinutes:30,ownerRoles:["CAJERO"],employeeIds:["007"],branch:"Matriz",evidence:"signature",assignedBy:"Gerencia",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL","GERENTE_TIENDA"],instructions:"Confirmar fondo, sistema, pendientes y condiciones de entrega de caja con Celina." },
  { id:"matriz-turno2-aseo",name:"Aseo de turno 2 por zona pequeña",area:"Aseo",start:"09:30",end:"10:00",durationMinutes:30,ownerRoles:["JEFE_AREA"],employeeIds:["011","012"],branch:"Matriz",evidence:"photo",assignedBy:"Gerencia",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL","GERENTE_TIENDA"],instructions:"Ruben e Itzai realizan el aseo asignado. Detenerse y atender al cliente cuando ingrese." },
  { id:"matriz-ruben-area",name:"Orden, limpieza y surtido del área de herramientas",area:"Herramientas",start:"10:00",end:"10:30",durationMinutes:30,ownerRoles:["JEFE_AREA"],employeeIds:["011"],branch:"Matriz",evidence:"photo",assignedBy:"Gerencia",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL","GERENTE_TIENDA"],instructions:"Trabajar una zona pequeña, llenar faltantes visibles y conservar segura la exhibición." },
  { id:"matriz-aprendizaje-productos",name:"Investigar 5 productos y documentar uso, datos técnicos y estrategia de venta",area:"Capacitación",start:"10:30",end:"11:00",durationMinutes:30,ownerRoles:["JEFE_AREA"],employeeIds:["008","009","010","011","012"],branch:"Matriz",evidence:"photo",assignedBy:"Gerente de tienda",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL","GERENTE_TIENDA"],instructions:"Buscar uno o dos videos por producto y redactar una ficha breve. La atención al cliente siempre interrumpe esta actividad." },
  { id:"matriz-operacion-programada",name:"Actividades programadas: mercancía, exhibición, inventario o tarea asignada",area:"Operación",start:"11:00",end:"16:30",durationMinutes:330,ownerRoles:["JEFE_AREA"],employeeIds:["008","009","010","011","012"],branch:"Matriz",evidence:"photo",assignedBy:"Gerente / Jefe de área",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL","GERENTE_TIENDA"],instructions:"Ejecutar una misión a la vez, con instrucciones completas y sin traslapes. Atender clientes de inmediato." },
  { id:"matriz-turno1-cierre",name:"Concluir tareas, ordenar área y cerrar el día en sistema",area:"Cierre",start:"16:30",end:"17:30",durationMinutes:60,ownerRoles:["JEFE_AREA"],employeeIds:["008","009","010"],branch:"Matriz",evidence:"signature",assignedBy:"Gerencia",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL","GERENTE_TIENDA"],instructions:"Cerrar actividades pendientes, dejar orden, registrar avance y reportar incidencias antes de salida." },
  { id:"matriz-turno2-cierre",name:"Ordenar área, concluir actividades y cierre operativo",area:"Cierre",start:"18:00",end:"19:00",durationMinutes:60,ownerRoles:["JEFE_AREA"],employeeIds:["011","012"],branch:"Matriz",evidence:"signature",assignedBy:"Gerencia",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL","GERENTE_TIENDA"],instructions:"Dejar área, exhibición y pendientes documentados para el día siguiente." },
  { id:"matriz-anubis-facturas-corte",name:"Facturas del día, retiros uno a uno y corte de caja",area:"Caja",start:"18:00",end:"19:20",durationMinutes:80,ownerRoles:["CAJERO"],employeeIds:["007"],branch:"Matriz",evidence:"signature",assignedBy:"Gerencia",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL","GERENTE_TIENDA"],instructions:"Capturar ventas ERP, efectivo, tarjeta, transferencia, MSI, retiros con destino y diferencias hasta cuadrar." },
  { id:"centro-llegada-matriz",name:"Llegar a Matriz y confirmar personal, llaves y pendientes",area:"Apertura Centro",start:"08:00",end:"08:15",durationMinutes:15,ownerRoles:["GERENTE_TIENDA","JEFE_AREA"],employeeIds:["005","006"],branch:"Sucursal Centro",evidence:"signature",assignedBy:"Dirección",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL"],instructions:"Registrar llegada en Matriz, recibir llaves, documentos y pendientes antes del traslado." },
  { id:"centro-salida-traslado",name:"Salida de Matriz y traslado seguro a Sucursal Centro",area:"Apertura Centro",start:"08:15",end:"08:45",durationMinutes:30,ownerRoles:["GERENTE_TIENDA","JEFE_AREA"],employeeIds:["005","006"],branch:"Sucursal Centro",evidence:"signature",assignedBy:"Dirección",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL"],instructions:"Salir de Matriz a las 8:15 y llegar a Sucursal Centro a más tardar 8:45. Reportar cualquier retraso." },
  { id:"centro-preapertura",name:"Encender equipos y luces; revisar accesos, seguridad y condiciones",area:"Apertura Centro",start:"08:45",end:"08:55",durationMinutes:10,ownerRoles:["GERENTE_TIENDA","JEFE_AREA"],employeeIds:["005","006"],branch:"Sucursal Centro",evidence:"photo",assignedBy:"Dirección",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL"],instructions:"Daniel enciende equipos y verifica operación; Jan revisa iluminación, accesos, orden y seguridad. Mantener vigilancia de entrada y salida." },
  { id:"centro-apertura-publico",name:"Abrir puertas al público y confirmar apertura en sistema",area:"Apertura Centro",start:"08:55",end:"09:00",durationMinutes:5,ownerRoles:["GERENTE_TIENDA","JEFE_AREA"],employeeIds:["005","006"],branch:"Sucursal Centro",evidence:"signature",assignedBy:"Dirección",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL"],instructions:"Abrir al público a las 8:55, confirmar hora real y reportar cualquier incidencia." },
  { id:"centro-apertura-caja",name:"Verificar fondo, abrir caja y dejar POS listo",area:"Caja Centro",start:"08:55",end:"09:05",durationMinutes:10,ownerRoles:["GERENTE_TIENDA"],employeeIds:["005"],branch:"Sucursal Centro",evidence:"signature",assignedBy:"Dirección",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL"],instructions:"Daniel cuenta el fondo, inicia POS e impresora, registra la apertura y reporta diferencias. No mezclar este registro con ventas o retiros." },
  { id:"centro-limpieza",name:"Limpieza completa de tienda y baños por responsabilidad asignada",area:"Aseo Centro",start:"09:00",end:"10:00",durationMinutes:60,ownerRoles:["GERENTE_TIENDA","JEFE_AREA"],employeeIds:["005","006"],branch:"Sucursal Centro",evidence:"photo",assignedBy:"Dirección",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL"],instructions:"Daniel barre, limpia mostradores y trapos; Jan trapea, ordena basura; cada uno atiende un baño. Ambos vigilan la entrada." },
  { id:"centro-inventario-zonas",name:"Limpieza, reorganización e inventario por zonas",area:"Inventario Centro",start:"10:00",end:"12:00",durationMinutes:120,ownerRoles:["GERENTE_TIENDA","JEFE_AREA"],employeeIds:["005","006"],branch:"Sucursal Centro",evidence:"photo",assignedBy:"Dirección",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL"],instructions:"10-11 Daniel bombas/mostrador 1; Jan herramientas eléctricas y seguridad. 11-12 herramienta de taller. Registrar diferencias." },
  { id:"centro-productos-redes",name:"Investigar 3 productos y redactar estrategia para redes o ecommerce",area:"Capacitación Centro",start:"12:00",end:"13:00",durationMinutes:60,ownerRoles:["GERENTE_TIENDA","JEFE_AREA"],employeeIds:["005","006"],branch:"Sucursal Centro",evidence:"photo",assignedBy:"Dirección",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL"],instructions:"Entregar reporte escrito con aplicación, solución, argumentos de venta y propuesta de contenido." },
  { id:"centro-reparaciones",name:"Reparaciones agendadas",area:"Taller Centro",start:"13:00",end:"15:00",durationMinutes:120,ownerRoles:["GERENTE_TIENDA","JEFE_AREA"],employeeIds:["005","006"],branch:"Sucursal Centro",evidence:"photo",assignedBy:"Gerente",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL","GERENTE_TIENDA"],instructions:"Atender reparaciones registradas, documentar diagnóstico, avance y entrega. Vigilar siempre la entrada." },
  { id:"centro-aprendizaje5",name:"Aprender 5 productos: uso, solución y estrategia de venta",area:"Capacitación Centro",start:"15:00",end:"17:00",durationMinutes:120,ownerRoles:["GERENTE_TIENDA","JEFE_AREA"],employeeIds:["005","006"],branch:"Sucursal Centro",evidence:"photo",assignedBy:"Dirección",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL"],instructions:"Documentar por escrito cada producto y suspender la actividad para recibir al cliente." },
  { id:"centro-cierre-traslado",name:"Orden, limpieza, facturación, traslado y reporte final",area:"Cierre Centro",start:"17:00",end:"18:30",durationMinutes:90,ownerRoles:["GERENTE_TIENDA","JEFE_AREA"],employeeIds:["005","006"],branch:"Sucursal Centro",evidence:"signature",assignedBy:"Dirección",editableBy:["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL"],instructions:"Jan ordena mostradores y plantas; Daniel factura y cierra caja. Traslado a Matriz de 18:00 a 18:30 y salida después de reportar." },
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
    id: "apertura-centro",
    name: "Apertura diaria de Sucursal Centro",
    area: "Sucursal Centro",
    allowedRoles: ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "GERENTE_TIENDA", "JEFE_AREA"],
    risk: "Cualquier retraso, diferencia de caja o falla de seguridad debe quedar reportado antes de iniciar ventas.",
    notifyOnFailure: "Dirección y Gerencia General",
    steps: [
      { title: "Llegada y reporte en Matriz", owner: "Daniel + Jan", time: "8:00 - 8:15", evidence: "signature" },
      { title: "Salida de Matriz hacia Centro", owner: "Daniel + Jan", time: "8:15", evidence: "signature" },
      { title: "Llegada, equipos, luces y seguridad", owner: "Daniel + Jan", time: "8:45 - 8:55", evidence: "photo" },
      { title: "Apertura al público", owner: "Daniel + Jan", time: "8:55", evidence: "signature" },
      { title: "Verificación y apertura de caja", owner: "Daniel", time: "8:55 - 9:05", evidence: "signature" },
      { title: "Limpieza de tienda, baños y mostradores", owner: "Daniel + Jan", time: "9:00 - 10:00", evidence: "photo" },
      { title: "Inventario, orden y limpieza por zonas", owner: "Daniel + Jan", time: "10:00 - 12:00", evidence: "photo" },
      { title: "Reporte de productos para redes/ecommerce", owner: "Daniel + Jan", time: "12:00 - 13:00", evidence: "photo" },
      { title: "Reparaciones agendadas", owner: "Daniel + Jan", time: "13:00 - 15:00", evidence: "ticket" },
      { title: "Aprendizaje de cinco productos", owner: "Daniel + Jan", time: "15:00 - 17:00", evidence: "photo" },
      { title: "Orden, facturación, cierre y regreso a Matriz", owner: "Daniel + Jan", time: "17:00 - 18:30", evidence: "signature" },
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
    allowedRoles: ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL", "GERENTE_TIENDA", "ADMIN_TIENDA", "JEFE_AREA", "CAJERO", "AUXILIAR"],
    risk: "Nunca se firma factura sin revisar mercancia. Lo que se firma, se acepta.",
    notifyOnFailure: "Gerente general",
    steps: [
      { title: "Recibir proveedor e iniciar proceso; identificar flete y canalizar al area", owner: "Cualquier colaborador que recibe", time: "Minuto 0", evidence: "signature" },
      { title: "Revisar cantidad, codigo, funcionamiento, estetica, medidas y calidad", owner: "Jefe de area", time: "Recepcion", evidence: "photo" },
      { title: "Anotar anomalías en ambos juegos de factura", owner: "Jefe de area", time: "Antes de firmar", evidence: "signature" },
      { title: "Entregar factura firmada al administrador", owner: "Jefe de area", time: "Al terminar revision", evidence: "signature" },
      { title: "Dar de alta factura y productos en ERP", owner: "Celina / Anubis / Julio", time: "Después de revisión", evidence: "signature" },
      { title: "Capturar y verificar precios con formula interna", owner: "Celina / Anubis / Julio", time: "Después del alta", evidence: "signature" },
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

export const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

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
  if (["001", "002", "003", "005"].includes(from.id)) return from.id !== to.id;
  return roleRank[from.role] < roleRank[to.role];
}

export function canViewAll(employee: Employee) {
  return ["001", "002", "003", "005"].includes(employee.id) || ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL"].includes(employee.role);
}

export function canGovern(employee: Employee) {
  return ["001", "002", "003", "005"].includes(employee.id) || ["APODERADA_LEGAL", "DIRECTOR", "GERENTE_GENERAL", "ADMIN_GENERAL"].includes(employee.role);
}

export function commissionRate(score: number, salesGoal: number, personalSales: number) {
  if (score >= 9 && personalSales >= salesGoal * 1.05) return 0.03;
  if (score >= 8.5 && personalSales >= salesGoal) return 0.02;
  return score >= 8 ? 0.01 : 0;
}
