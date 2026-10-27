const routes:Record<string,string>={
 overview:"/admin/workspaces/group",estates:"/admin/workspaces/estates",capital:"/admin/workspaces/capital",
 contracts:"/admin/group/estates/contracts",bookings:"/admin/bookings/operations",
 relationships:"/admin/accounts",companies:"/admin/member-companies",projects:"/admin/projects",analytics:"/admin/system"
};
export function adminEntryRoute(params:Record<string,string|string[]|undefined>):string{
 const tab=typeof params.tab==="string"?params.tab:"overview";
 const destination=Object.hasOwn(routes,tab)?routes[tab]:routes.overview;
 const query=new URLSearchParams();
 for(const [key,value] of Object.entries(params)){
  if(key==="tab"||value===undefined)continue;
  for(const item of Array.isArray(value)?value:[value])query.append(key,item);
 }
 return destination+(query.size?"?"+query.toString():"");
}
