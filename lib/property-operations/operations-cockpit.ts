import type {PropertyTask} from './property-tasks';
export type OperationsTicket={
 id:string;property_id:string;unit_id:string|null;title:string;priority:string;status:string;
 scheduled_for:string|null;responsible_profile_id:string|null;created_at:string;latest_note:string|null
};
export type OperationsVisit={
 id:string;profile_id:string;property_id:string|null;work_area_id:string|null;
 worked_on:string;effective_minutes:number;description:string;
 review_decision:string|null;correction_pending:boolean
};
export type OperationsStaffNote={
 id:string;ticket_id:string;note_kind:string;created_at:string;note:string
};
export type OperationsItem={
 id:string;kind:'task'|'maintenance'|'time'|'correction';title:string;
 location:string;subtitle:string;detail:string;date:string|null;priority:'normal'|'attention'|'urgent';
 href:string
};
export type OperationsSummary={
 taskOpen:number;taskBlocked:number;taskOverdue:number;taskHigh:number;taskUnassigned:number;
 maintenanceOpen:number;maintenanceTriage:number;maintenanceBlocked:number;maintenanceReady:number;
 maintenanceOverdue:number;timePending:number;timeCorrection:number;timeTotalMinutes:number;
};
type Named={id:string;name:string};
export function operationsSnapshot(input:{
 tasks:readonly PropertyTask[];tickets:readonly OperationsTicket[];visits:readonly OperationsVisit[];
 notes:readonly OperationsStaffNote[];properties:readonly Named[];areas:readonly Named[];
 units:readonly {id:string;address:string}[];people:readonly {id:string;full_name:string|null}[];
 today:string
}):{summary:OperationsSummary;tasks:OperationsItem[];maintenance:OperationsItem[];time:OperationsItem[];corrections:OperationsItem[]}{
 const {tasks,tickets,visits,notes,today}=input;
 if(!/^20\d\d-\d\d-\d\d$/.test(today))throw Error('Invalid operations day');
 const props=new Map(input.properties.map(x=>[x.id,x.name])),areas=new Map(input.areas.map(x=>[x.id,x.name]));
 const units=new Map(input.units.map(x=>[x.id,x.address])),people=new Map(input.people.map(x=>[x.id,x.full_name]));
 const location=(property:string|null,area:string|null,unit?:string|null)=>{
  const main=area?areas.get(area):property?props.get(property):undefined;
  if(!main)throw Error('Unknown assigned work location');
  return main+(unit?' · '+(units.get(unit)??'Unknown unit'):'');
 };
 const openTasks=tasks.filter(x=>!['done','cancelled'].includes(x.status));
 const openTickets=tickets.filter(x=>!['resolved','closed'].includes(x.status));
 const byTicket=new Map<string,OperationsStaffNote>();
 for(const note of [...notes].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id))){
  if(!byTicket.has(note.ticket_id))byTicket.set(note.ticket_id,note);
 }
 const pending=visits.filter(x=>x.review_decision===null&&!x.correction_pending);
 const corrections=visits.filter(x=>x.correction_pending);
 const dueSoon=new Date(today+'T00:00:00Z');
 dueSoon.setUTCDate(dueSoon.getUTCDate()+7);
 const through=dueSoon.toISOString().slice(0,10);
 const summary:OperationsSummary={
  taskOpen:openTasks.length,
  taskBlocked:openTasks.filter(x=>x.status==='blocked').length,
  taskOverdue:openTasks.filter(x=>!!x.due_on&&x.due_on<today).length,
  taskHigh:openTasks.filter(x=>['urgent','high'].includes(x.priority)).length,
  taskUnassigned:openTasks.filter(x=>!x.assigned_profile_id).length,
  maintenanceOpen:openTickets.length,
  maintenanceTriage:openTickets.filter(x=>['reported','reopened'].includes(x.status)).length,
  maintenanceBlocked:openTickets.filter(x=>byTicket.get(x.id)?.note_kind==='blocked').length,
  maintenanceReady:openTickets.filter(x=>byTicket.get(x.id)?.note_kind==='ready_for_review').length,
  maintenanceOverdue:openTickets.filter(x=>!!x.scheduled_for&&x.scheduled_for<today).length,
  timePending:pending.length,timeCorrection:corrections.length,
  timeTotalMinutes:visits.reduce((total,row)=>total+row.effective_minutes,0)
 };
 const taskItems:OperationsItem[]=openTasks.map(t=>{
  const late=!!t.due_on&&t.due_on<today;
  const blocked=t.status==='blocked';
  const priority:'normal'|'attention'|'urgent'=late||t.priority==='urgent'?'urgent':blocked||!t.assigned_profile_id||t.priority==='high'?'attention':'normal';
  return {id:t.id,kind:'task',title:t.title,location:location(t.property_id,t.work_area_id,t.unit_id),
   subtitle:blocked?'Blocked':late?'Overdue':t.due_on&&t.due_on<=through?'Due within 7 days':!t.assigned_profile_id?'Unassigned':'Open',
   detail:(t.assigned_profile_id?people.get(t.assigned_profile_id)??'Assigned staff':'Unassigned')+
    (t.latest_note?' · '+t.latest_note:''),
   date:t.due_on,priority,href:'/admin/workspaces/estates/staff/tasks#tasks'
  };
 }).sort((a,b)=>{
  const rank=(v:OperationsItem)=>v.priority==='urgent'?0:v.priority==='attention'?1:2;
  return rank(a)-rank(b)||(a.date??'9999-12-31').localeCompare(b.date??'9999-12-31')||a.id.localeCompare(b.id);
 });
 const maintenanceItems:OperationsItem[]=openTickets.map(t=>{
  const last=byTicket.get(t.id),late=!!t.scheduled_for&&t.scheduled_for<today;
  const blocked=last?.note_kind==='blocked',ready=last?.note_kind==='ready_for_review';
  return {id:t.id,kind:'maintenance',title:t.title,location:location(t.property_id,null,t.unit_id),
   subtitle:blocked?'Staff blocked':ready?'Ready for review':late?'Planning overdue':
    ['reported','reopened'].includes(t.status)?'Needs triage':t.status.replaceAll('_',' '),
   detail:last?.note??t.latest_note??t.status,
   date:t.scheduled_for??t.created_at.slice(0,10),
   priority:late||t.priority==='urgent'?'urgent':blocked||ready||t.status==='reported'?'attention':'normal',
   href:'/admin/workspaces/estates/staff?ticket='+encodeURIComponent(t.id)+'#ticket'
  };
 }).sort((a,b)=>(a.priority==='urgent'?0:a.priority==='attention'?1:2)-
  (b.priority==='urgent'?0:b.priority==='attention'?1:2)||
   (a.date??'').localeCompare(b.date??'')||a.id.localeCompare(b.id));
 const visitItem=(v:OperationsVisit,kind:'time'|'correction'):OperationsItem=>({
  id:v.id,kind,title:(v.effective_minutes/60).toLocaleString('en',{maximumFractionDigits:2})+' hours',
  location:location(v.property_id,v.work_area_id),
  subtitle:kind==='correction'?'Correction requested':'Awaiting review',
  detail:(people.get(v.profile_id)??'Staff member')+' · '+v.description,
  date:v.worked_on,priority:kind==='correction'?'attention':'normal',
  href:'/admin/workspaces/estates/staff?visit='+encodeURIComponent(v.id)+'#visit'
 });
 return {summary,tasks:taskItems,maintenance:maintenanceItems,
  time:pending.map(x=>visitItem(x,'time')).sort((a,b)=>(a.date??'').localeCompare(b.date??'')),
  corrections:corrections.map(x=>visitItem(x,'correction')).sort((a,b)=>(a.date??'').localeCompare(b.date??''))};
}
