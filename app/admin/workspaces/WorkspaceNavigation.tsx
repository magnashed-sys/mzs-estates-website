"use client";
import Link from "next/link";
import {Suspense} from "react";
import {usePathname,useSearchParams} from "next/navigation";
import styles from "./workspace.module.css";
const items=[
 {href:"/admin/workspaces/group",label:"Cockpit"},
 {href:"/admin/bookings",label:"Bookings"},
 {href:"/admin/workspaces/estates",label:"Real Estate"},
 {href:"/admin/workspaces/capital",label:"Capital"},
 {href:"/admin/workspaces/relationships",label:"Relationships"},
 {href:"/admin/workspaces/staff",label:"Staff"},
 {href:"/admin/workspaces/accountancy",label:"Accountancy"},
 {href:"/admin/system",label:"System"}
];
export function activeWorkspace(path:string,queue:string|null=null){
 const matches=(prefix:string)=>path===prefix||path.startsWith(prefix+"/");
 if(["/admin/workspaces/staff","/admin/workspaces/estates/staff","/admin/workspaces/estates/time-report"].some(matches)|| (matches("/admin/workspaces/estates/actions")&&["visits","corrections"].includes(queue??"")))return "Staff";
 if(["/admin/workspaces/accountancy","/admin/workspaces/estates/expenses","/admin/workspaces/estates/reports","/admin/workspaces/estates/history"].some(matches))return "Accountancy";
 if(["/admin/bookings","/admin/unified-bookings","/admin/owner-stays"].some(matches))return "Bookings";
 if(["/admin/workspaces/capital","/admin/group/capital","/admin/group/capital-access","/admin/capital-requests","/admin/intro-calls"].some(matches))return "Capital";
 if(["/admin/workspaces/relationships","/admin/accounts","/admin/member-companies","/admin/relationships","/admin/project-access"].some(matches))return "Relationships";
 if(["/admin/workspaces/estates","/admin/group/estates","/admin/projects"].some(matches))return "Real Estate";
 if(["/admin/system","/admin/property-operations-pilot"].some(matches))return "System";
 return "Cockpit";
}
function Navigation({disabled=false}:{disabled?:boolean}){
 const active=activeWorkspace(usePathname(),useSearchParams().get("queue"));
 return <nav className={styles.nav} aria-label="Administration workspaces">{items.map(item=>
  <Link key={item.href} href={item.href} onClick={event=>{if(disabled)event.preventDefault()}} aria-disabled={disabled} aria-current={active===item.label?"page":undefined}>{item.label}</Link>)}</nav>;
}

export default function WorkspaceNavigation({disabled=false}:{disabled?:boolean}){return <Suspense fallback={<nav className={styles.nav} aria-label="Administration workspaces" aria-busy="true">Loading navigation…</nav>}><Navigation disabled={disabled}/></Suspense>;}
