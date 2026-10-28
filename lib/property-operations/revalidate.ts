import {revalidatePath} from 'next/cache';
export function revalidateOperations(){
 for(const path of ['/staff','/admin/workspaces/estates/staff','/admin/workspaces/estates/actions','/admin/workspaces/estates','/admin/workspaces/group'])revalidatePath(path);
}
