"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import styles from "./workspace.module.css";
const items=[
 {href:"/admin/workspaces/group",label:"Group"},
 {href:"/admin/bookings",label:"Bookings"},
 {href:"/admin/workspaces/estates",label:"MZS Estates"},
 {href:"/admin/workspaces/capital",label:"MZS Capital"},
 {href:"/admin/workspaces/relationships",label:"Relationships"},
 {href:"/admin/system",label:"System"}
];
export default function WorkspaceNavigation({disabled=false}:{disabled?:boolean}){
 const path=usePathname();
 return <nav className={styles.nav} aria-label="Administration workspaces">{items.map(item=>
  <Link key={item.href} href={item.href} onClick={event=>{if(disabled)event.preventDefault()}} aria-disabled={disabled} aria-current={path===item.href||path.startsWith(item.href+"/")||(item.label==="Relationships"&&["/admin/accounts","/admin/member-companies","/admin/relationships"].some(prefix=>path===prefix||path.startsWith(prefix+"/")))||(item.label==="MZS Estates"&&path.startsWith("/admin/projects"))?"page":undefined}>{item.label}</Link>)}</nav>;
}
