export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const statusLabels:Record<string,string>={reported:"Reported",triaged:"Reviewed",scheduled:"Scheduled",in_progress:"In progress",resolved:"Resolved",reopened:"Reopened",closed:"Closed"};
export const transitions:Record<string,string[]>={reported:['triaged'],triaged:['triaged','scheduled','in_progress','resolved'],scheduled:['triaged','scheduled','in_progress','resolved'],in_progress:['in_progress','scheduled','resolved'],resolved:['reopened','closed'],reopened:['triaged','scheduled','in_progress','resolved'],closed:['reopened']};
export type WorkState={status:'idle'|'success'|'error';message:string};
export type Visit={id:string;property_id:string;profile_id:string;worked_on:string;actual_minutes:number;effective_minutes:number;task_category:string;description:string;correction_id:string|null;review_decision:string|null;review_reason:string|null;correction_pending:boolean};
export type Ticket={id:string;property_id:string;title:string;description:string;priority:string;status:string;responsible_profile_id:string|null;scheduled_for:string|null;latest_note:string|null;latest_event_id:string|null};
export type Member={id:string;full_name:string|null;role:string;is_active:boolean};
export type Property={id:string;name:string};
export type Correction={id:string;visit_id:string;proposed_minutes:number;reason:string;created_at:string};
export type Decision={correction_id:string;decision:string;reason:string};
export function validDate(value:string){return /^20\d{2}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(value+'T00:00:00Z').valueOf())&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
export function pageNumber(value:string|undefined){const n=Number(value??1);return Number.isSafeInteger(n)&&n>0&&n<=100000?n:1;}
