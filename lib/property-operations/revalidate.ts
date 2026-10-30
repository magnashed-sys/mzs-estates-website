import {revalidatePath} from 'next/cache';
export function revalidateOperations(){
 for(const path of ['/staff','/admin/workspaces/estates/staff','/admin/workspaces/estates/actions','/admin/workspaces/estates/time-report','/admin/workspaces/estates','/admin/workspaces/estates/zorgbalans','/admin/workspaces/group'])revalidatePath(path);
}
