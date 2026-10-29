
import {getAdminI18n} from '../../../lib/admin/i18n-server';
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "../../../lib/supabase/server";
import { introCallsEnvironmentAllowed } from "../../../lib/mzs/intro-calls";
import styles from "../capital-requests/requests.module.css";

export const dynamic = "force-dynamic";
async function requireAdmin() {
  if (!introCallsEnvironmentAllowed()) notFound();
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: profile } = await db.from("profiles").select("role,is_active").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile.is_active !== true) notFound();
  return db;
}
async function updateStatus(form: FormData) {
  "use server";
  const db = await requireAdmin();
  const id = form.get("id"), status = form.get("status");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id) || typeof status !== "string" || !["new", "contacted", "closed"].includes(status)) return;
  const { data, error } = await db.from("mzs_intro_call_requests").update({ status }).eq("id", id).select("id").single();
  if (error || !data) redirect("/admin/intro-calls?error=update");
  revalidatePath("/admin/intro-calls");
  redirect("/admin/intro-calls?updated=1");
}
export default async function IntroCallsAdmin({ searchParams }: { searchParams: Promise<{ page?: string; updated?: string; error?: string }> }) {
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

  const db = await requireAdmin();
  const query = await searchParams;
  const page = Math.max(1, Math.min(100000, Number.parseInt(query.page || "1", 10) || 1));
  const { data, error, count } = await db.from("mzs_intro_call_requests")
    .select("id,full_name,email,phone,message,status,created_at,source", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * 30, page * 30 - 1);
  return <main className={styles.page}>
    <Link href="/admin/group/capital">{adminT("← MZS Capital Cockpit")}</Link>
    <p className={styles.kicker}>{adminT("MZS GROUP / FIRST CONVERSATIONS")}</p>
    <h1>{adminT("Introductory Calls")}</h1>
    <p>{adminT("Public enquiries received without a private account. Contact the requester personally to arrange a time.")}</p>
    {query.updated && <p role="status">{adminT("Status updated.")}</p>}
    {query.error && <p role="alert">{adminT("The update could not be confirmed. Please reload and try again.")}</p>}
    {error ? <p role="alert">{adminT("Unable to load requests. Please try again.")}</p> : <>
      <p>{count || 0}  {adminT("requests · Page")} {page}</p>
      <div className={styles.list}>{data?.map(item => <article className={styles.card} key={item.id}>
        <div className={styles.top}><strong>{adminT(item.status)}</strong><span>{new Date(item.created_at).toLocaleString(adminLocale, { timeZone: "Europe/Madrid" })}</span></div>
        <p>{item.source === "consultancy" ? adminT("Consultancy") : item.source === "real-estate" ? adminT("Real Estate") : adminT("Private Capital")}</p>
        <h2>{item.full_name}</h2>
        <p><a href={"mailto:" + item.email}>{item.email}</a>{item.phone && <><br />{item.phone}</>}</p>
        {item.message && <p className={styles.explanation}>{item.message}</p>}
        <form action={updateStatus}>
          <input type="hidden" name="id" value={item.id} />
          <label>{adminT("Status")} <select name="status" defaultValue={item.status} aria-label={adminT("Status for {p0}", {p0: item.full_name})}>
            <option value="new">{adminT("New")}</option><option value="contacted">{adminT("Contacted")}</option><option value="closed">{adminT("Closed")}</option>
          </select></label>
          <button type="submit" style={{ padding: "12px 18px", background: "#d5c09a", color: "#111", border: 0, cursor: "pointer" }}>{adminT("Save status")}</button>
        </form>
        <p><small>{adminT("Reference:")} {item.id}</small></p>
      </article>)}</div>
      {page > 1 && <Link href={"?page=" + (page - 1)}>{adminT("← Newer requests")} </Link>}
      {(count || 0) > page * 30 && <Link href={"?page=" + (page + 1)}>  {adminT("Older requests →")}</Link>}
      {!data?.length && <p>{adminT("No requests on this page.")}</p>}
    </>}
  </main>;
}
