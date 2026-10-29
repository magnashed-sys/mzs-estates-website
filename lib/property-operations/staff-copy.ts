/** Staff cockpit copy. Independent of the public site and admin language settings. */
export type StaffLanguage='nl'|'en'|'es';
export function safeStaffLanguage(value:unknown):StaffLanguage{
 return value==='en'||value==='es'?value:'nl';
}
const copy={
 en:{
  tasks:'My tasks',openTasks:'Open tasks',dueToday:'Due / no date',priorityHigh:'High priority',completed:'Completed',
  newEntry:'+ New task / report',logTime:'+ Log working time',createHeading:'New task or report',
  addType:'What would you like to add?',task:'Task / general work',maintenance:'Maintenance issue / repair request',
  property:'Property',unit:'Unit (optional)',whole:'Whole property / common area',taskTitle:'What needs to be done?',
  issueTitle:'What needs repairing?',description:'Description',details:'Details (optional)',priority:'Priority',urgency:'Urgency',
  normal:'Normal',high:'High',urgent:'Urgent',low:'Low',soon:'Needs attention soon',
  dueDate:'Due date',planning:'Additional planning (optional)',sendReport:'Send maintenance report',
  createTask:'Create task',saving:'Saving…',photos:'Photos (optional, up to 3)',photoHint:'JPEG, PNG or WebP, max. 4 MB each. Avoid people or private documents.',
  photoWarning:'A maintenance report is not an approved supplier order or an invoice.',
  progress:'Update progress',progressNote:'Progress note',saveProgress:'Save progress',
  workingTime:'Log working time',workDate:'Date',hours:'Hours',minutes:'Minutes',total:'Total',
  relatedTask:'Related task (optional)',generalTask:'General work / no specific task',
  workCategory:'Work category',descriptionWork:'Description',saveTime:'Save working time',
  allTasks:'All tasks',noTasks:'No open tasks yet.',currentTask:'Last update',
  note:'Only assigned locations and tasks are visible. No invoice or payment is created.',
  history:'Work visits and maintenance history',dateLabel:'Work date',workSaved:'Your entry was saved.',
  cleaning:'Cleaning',inspection:'Inspection',maintenanceCategory:'Maintenance',gardening:'Gardening',guestService:'Guest service',other:'Other',
  taskOpen:'Open',taskProgress:'In progress',taskBlocked:'Waiting / blocked',taskDone:'Completed',taskCancelled:'Cancelled',
  recordActual:'Record actual time for a property, unit and, if relevant, a task.',
  hoursInfo:'Actual working time only; no salary or invoice is created.',
  taskSaved:'Task created and visible in Group Admin.',reportSaved:'Maintenance report saved.',
  uploadPartial:'Report saved, but not all photos could be uploaded. Open the report to add them.',
  selectLocation:'Choose a location'
 },
 nl:{
  tasks:'Mijn taken',openTasks:'Openstaande taken',dueToday:'Vandaag / zonder datum',priorityHigh:'Hoge prioriteit',completed:'Afgerond',
  newEntry:'+ Nieuwe taak / melding',logTime:'+ Uren registreren',createHeading:'Nieuwe taak of melding',
  addType:'Wat wil je registreren?',task:'Taak / algemene werkzaamheden',maintenance:'Onderhoudsmelding / reparatie',
  property:'Pand / locatie',unit:'Unit (optioneel)',whole:'Gehele pand / algemene ruimte',taskTitle:'Wat moet er gebeuren?',
  issueTitle:'Wat moet worden gerepareerd?',description:'Omschrijving',details:'Omschrijving (optioneel)',priority:'Prioriteit',urgency:'Urgentie',
  normal:'Normaal',high:'Hoog',urgent:'Dringend',low:'Laag',soon:'Binnenkort beoordelen',
  dueDate:'Uitvoeren voor',planning:'Aanvullende planning (optioneel)',sendReport:'Onderhoudsmelding versturen',
  createTask:'Taak aanmaken',saving:'Opslaan…',photos:'Foto’s (optioneel, maximaal 3)',photoHint:'JPEG, PNG of WebP, maximaal 4 MB per foto. Vermijd personen en privé-documenten.',
  photoWarning:'Een melding is nog geen opdracht aan een leverancier of factuur.',
  progress:'Voortgang bijwerken',progressNote:'Voortgangsnotitie',saveProgress:'Voortgang opslaan',
  workingTime:'Uren registreren',workDate:'Datum',hours:'Uren',minutes:'Minuten',total:'Totaal',
  relatedTask:'Gekoppelde taak (optioneel)',generalTask:'Algemene werkzaamheden / geen taak',
  workCategory:'Categorie werkzaamheden',descriptionWork:'Omschrijving',saveTime:'Uren opslaan',
  allTasks:'Alle taken',noTasks:'Er zijn nog geen openstaande taken.',currentTask:'Laatste update',
  note:'Alleen toegewezen locaties en taken zijn zichtbaar. Er worden geen facturen of betalingen aangemaakt.',
  history:'Uren- en onderhoudshistorie',dateLabel:'Werkdatum',workSaved:'De registratie is opgeslagen.',
  cleaning:'Schoonmaak',inspection:'Inspectie',maintenanceCategory:'Onderhoud',gardening:'Tuinonderhoud',guestService:'Gastservice',other:'Overige',
  taskOpen:'Open',taskProgress:'In uitvoering',taskBlocked:'Wachten / geblokkeerd',taskDone:'Afgerond',taskCancelled:'Geannuleerd',
  recordActual:'Registreer daadwerkelijk gewerkte tijd bij een pand, unit en eventueel een taak.',
  hoursInfo:'Alleen daadwerkelijke uren; er wordt geen loon of factuur aangemaakt.',
  taskSaved:'Taak aangemaakt en zichtbaar in de admin.',reportSaved:'Onderhoudsmelding opgeslagen.',
  uploadPartial:'Melding opgeslagen, maar niet alle foto’s konden worden verwerkt. Voeg ze via het dossier toe.',
  selectLocation:'Kies een locatie'
 },
 es:{
  tasks:'Mis tareas',openTasks:'Tareas abiertas',dueToday:'Hoy / sin fecha',priorityHigh:'Prioridad alta',completed:'Finalizadas',
  newEntry:'+ Nueva tarea / incidencia',logTime:'+ Registrar horas',createHeading:'Nueva tarea o incidencia',
  addType:'¿Qué deseas registrar?',task:'Tarea / trabajo general',maintenance:'Incidencia de mantenimiento / reparación',
  property:'Inmueble / ubicación',unit:'Unidad (opcional)',whole:'Inmueble completo / zona común',taskTitle:'¿Qué hay que hacer?',
  issueTitle:'¿Qué hay que reparar?',description:'Descripción',details:'Descripción (opcional)',priority:'Prioridad',urgency:'Urgencia',
  normal:'Normal',high:'Alta',urgent:'Urgente',low:'Baja',soon:'Revisar pronto',
  dueDate:'Fecha límite',planning:'Planificación adicional (opcional)',sendReport:'Enviar incidencia',
  createTask:'Crear tarea',saving:'Guardando…',photos:'Fotos (opcionales, máximo 3)',photoHint:'JPEG, PNG o WebP; máximo 4 MB por foto. Evita personas y documentos privados.',
  photoWarning:'Una incidencia no autoriza trabajos de proveedores ni genera facturas.',
  progress:'Actualizar progreso',progressNote:'Nota de progreso',saveProgress:'Guardar progreso',
  workingTime:'Registrar horas',workDate:'Fecha',hours:'Horas',minutes:'Minutos',total:'Total',
  relatedTask:'Tarea relacionada (opcional)',generalTask:'Trabajo general / sin tarea',
  workCategory:'Categoría de trabajo',descriptionWork:'Descripción',saveTime:'Guardar horas',
  allTasks:'Todas las tareas',noTasks:'Todavía no hay tareas abiertas.',currentTask:'Última actualización',
  note:'Solo se muestran ubicaciones y tareas asignadas. No se crean facturas ni pagos.',
  history:'Historial de horas y mantenimiento',dateLabel:'Fecha de trabajo',workSaved:'Registro guardado.',
  cleaning:'Limpieza',inspection:'Inspección',maintenanceCategory:'Mantenimiento',gardening:'Jardinería',guestService:'Servicio a huéspedes',other:'Otros',
  taskOpen:'Abierta',taskProgress:'En curso',taskBlocked:'En espera / bloqueada',taskDone:'Completada',taskCancelled:'Cancelada',
  recordActual:'Registra el tiempo real por inmueble, unidad y, si procede, tarea.',
  hoursInfo:'Solo tiempo realmente trabajado; no crea salarios ni facturas.',
  taskSaved:'Tarea creada y visible en administración.',reportSaved:'Incidencia guardada.',
  uploadPartial:'Incidencia guardada, pero no todas las fotos se pudieron subir. Añádelas desde el expediente.',
  selectLocation:'Selecciona una ubicación'
 }
} as const;
export type StaffCopyKey=keyof typeof copy.en;
export function staffText(language:StaffLanguage,key:StaffCopyKey):string{return copy[language][key];}
