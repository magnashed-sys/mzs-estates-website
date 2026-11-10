import {NextResponse} from "next/server";
import {createClient} from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Vary": "Cookie",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  const fail = (status: number) => new NextResponse(null, {status, headers});
  const {id} = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return fail(404);
  const db = await createClient();
  const {data: auth, error: authError} = await db.auth.getUser();
  if (authError || !auth.user) return fail(401);
  // Session-scoped RLS requires an active member, project access and the
  // document's offering grant. Storage independently enforces the same rules.
  const {data: document, error} = await db.from("mzs_project_documents")
    .select("file_path,mime_type,file_size_bytes")
    .eq("id", id).eq("category", "floorplan").eq("is_published", true)
    .in("mime_type", ["image/webp", "image/png", "image/jpeg"])
    .maybeSingle();
  if (error || !document) return fail(404);
  const {data: file, error: storageError} = await db.storage
    .from("mzs-private-project-documents").download(document.file_path);
  if (storageError || !file || file.size !== document.file_size_bytes) return fail(404);
  return new NextResponse(file, {headers: {
    ...headers, "Content-Type": document.mime_type,
    "Content-Disposition": "inline",
  }});
}
