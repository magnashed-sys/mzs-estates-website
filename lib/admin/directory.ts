export const adminDirectory = [
 {group:"Accountancy",en:"Completeness center",es:"Centro de integridad documental",href:"/admin/workspaces/accountancy/completeness"},
  {
    "group": "Cockpit",
    "en": "Cockpit",
    "es": "Panel",
    "href": "/admin/workspaces/group"
  },
  {
    "group": "Bookings",
    "en": "Bookings",
    "es": "Reservas",
    "href": "/admin/bookings"
  },
  {
    "group": "Bookings",
    "en": "Booking operations",
    "es": "Operaciones de reservas",
    "href": "/admin/bookings/operations"
  },
  {
    "group": "Bookings",
    "en": "Owner stays",
    "es": "Estancias de propietarios",
    "href": "/admin/owner-stays"
  },
  {
    "group": "Real Estate",
    "en": "Properties",
    "es": "Inmuebles",
    "href": "/admin/group/estates/properties"
  },
  {
    "group": "Real Estate",
    "en": "Units",
    "es": "Unidades",
    "href": "/admin/group/estates/units"
  },
  {
    "group": "Real Estate",
    "en": "Rental contracts",
    "es": "Contratos de alquiler",
    "href": "/admin/group/estates/contracts"
  },
  {
    "group": "Real Estate",
    "en": "Projects",
    "es": "Proyectos",
    "href": "/admin/projects"
  },
  {
    "group": "Real Estate",
    "en": "Legal entities & property links",
    "es": "Entidades y vínculos inmobiliarios",
    "href": "/admin/workspaces/estates/entities"
  },
  {
    "group": "Capital",
    "en": "Capital overview",
    "es": "Resumen de capital",
    "href": "/admin/workspaces/capital"
  },
  {
    "group": "Capital",
    "en": "Investment dossiers",
    "es": "Expedientes de inversión",
    "href": "/admin/group/capital/deals"
  },
  {
    "group": "Capital",
    "en": "Capital requests",
    "es": "Solicitudes de capital",
    "href": "/admin/capital-requests"
  },
  {
    "group": "Capital",
    "en": "Introductory calls",
    "es": "Llamadas iniciales",
    "href": "/admin/intro-calls"
  },
  {
    "group": "Relationships",
    "en": "Accounts & access requests",
    "es": "Cuentas y solicitudes de acceso",
    "href": "/admin/accounts"
  },
  {
    "group": "Relationships",
    "en": "Relationship dossiers",
    "es": "Expedientes de relaciones",
    "href": "/admin/relationships"
  },
  {
    "group": "Relationships",
    "en": "Companies",
    "es": "Empresas",
    "href": "/admin/member-companies"
  },
  {
    "group": "Relationships",
    "en": "Project access",
    "es": "Acceso a proyectos",
    "href": "/admin/project-access"
  },
  {
    "group": "Accountancy",
    "en": "Invoices",
    "es": "Facturas",
    "href": "/admin/workspaces/accountancy/sales"
  },
  {
    "group": "Accountancy",
    "en": "New invoice draft",
    "es": "Nuevo borrador de factura",
    "href": "/admin/workspaces/accountancy/sales/new"
  },
  {
    "group": "Accountancy",
    "en": "Receivables & reminders",
    "es": "Cobros y recordatorios",
    "href": "/admin/workspaces/accountancy/sales/receivables"
  },
  {
    "group": "Accountancy",
    "en": "Purchase PDFs · batch upload",
    "es": "PDF de compras · carga múltiple",
    "href": "/admin/workspaces/accountancy/purchases"
  },
  {
    "group": "Accountancy",
    "en": "Year administrations & accountant packages",
    "es": "Administraciones anuales y paquetes contables",
    "href": "/admin/workspaces/accountancy/administrations"
  },
  {
    "group": "Accountancy",
    "en": "Document archive",
    "es": "Archivo documental",
    "href": "/admin/workspaces/accountancy/documents"
  },
  {
    "group": "Accountancy",
    "en": "Expense register",
    "es": "Registro de gastos",
    "href": "/admin/workspaces/estates/expenses"
  },
  {
    "group": "Accountancy",
    "en": "Reports & accountant exports",
    "es": "Informes y exportaciones contables",
    "href": "/admin/workspaces/estates/reports"
  },
  {
    "group": "Accountancy",
    "en": "Historical invoices",
    "es": "Facturas históricas",
    "href": "/admin/workspaces/accountancy/invoices"
  },
  {
    "group": "Staff",
    "en": "Tasks & maintenance",
    "es": "Tareas y mantenimiento",
    "href": "/admin/workspaces/estates/staff/tasks"
  },
  {
    "group": "Staff",
    "en": "Operations action center",
    "es": "Centro de acciones operativas",
    "href": "/admin/workspaces/estates/operations"
  },
  {
    "group": "Staff",
    "en": "Staff access & work visits",
    "es": "Acceso y visitas de trabajo",
    "href": "/admin/workspaces/estates/staff"
  },
  {
    "group": "Staff",
    "en": "Weekly approval · bulk review",
    "es": "Aprobación semanal · revisión múltiple",
    "href": "/admin/workspaces/estates/weekly"
  },
  {
    "group": "Staff",
    "en": "Time reporting & export",
    "es": "Informes y exportación de horas",
    "href": "/admin/workspaces/estates/time-report"
  },
  {
    "group": "Staff",
    "en": "Zorgbalans · private billing",
    "es": "Zorgbalans · facturación privada",
    "href": "/admin/workspaces/estates/zorgbalans"
  },
  {
    "group": "System",
    "en": "System",
    "es": "Sistema",
    "href": "/admin/system"
  }
] as const;
export function findAdminModules(query:string,group:string=""){const terms=query.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().trim().split(/\s+/);return adminDirectory.filter(item=>(!group||item.group===group)&&terms.every(term=>[item.en,item.es,item.group].join(" ").normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().includes(term)));}
