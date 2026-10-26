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
 {href:"/admin?tab=analytics",label:"System"}
];
export default function WorkspaceNavigation(){
 const path=usePathname();
 return <nav className={styles.nav} aria-label="Administration workspaces">{items.map(item=>
  <Link key={item.href} href={item.href} aria-current={path===item.href||path.startsWith(item.href+"/")?"page":undefined}>{item.label}</Link>)}</nav>;
}
