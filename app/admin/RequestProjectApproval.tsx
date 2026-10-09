1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68
69
70
71
72
73
74
75
76
77
78
79
80
81
82
83
84
85
86
87
88
89
90
91
92
93
94
95
96
"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createClient } from "../../lib/supabase/client";

type Role = "client" | "partner";
type Request = { id: string; full_name: string; email: string; status: string };
type Project = { id: string; title: string; location: string | null };
type Offering = { id: string; project_id: string; title: string | null; offering_type: string };
type Plan = { requested_role: Role; revision: number; applied_at: string | null };
export type PlannedInvitation = {
  id: string; request_id: string; email: string; requested_role: Role; status: string; invited_at: string;
};
type Props = {
  request: Request;
  onApproved: (id: string) => void;
  onInvited: (invitation: PlannedInvitation) => void;
  onClose: () => void;
};
const gold = "#d5c09a";
const muted = "#b4ac9f";
const edge = "#514839";
const button: CSSProperties = {
  padding: "13px 20px", border: `1px solid ${gold}`, background: "transparent", color: gold,
  fontSize: 12, lineHeight: 1.5, letterSpacing: ".07em", cursor: "pointer",
};
const labels: Record<string, string> = {
  rental: "Private Rental", sale: "Private Sale", investment: "Investment", financing: "Private Capital",
};
function sameIds(a: string[], b: string[]) {
  return a.length === b.length && [...a].sort().every((value, i) => value === [...b].sort()[i]);
}
function messageOf(error: unknown) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message : "The action could not be verified. Reload before another attempt.";
}

export default function RequestProjectApproval({ request, onApproved, onInvited, onClose }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [role, setRole] = useState<Role>("client");
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState<{ role: Role; ids: string[]; revision: number } | null>(null);
  const [invitation, setInvitation] = useState<PlannedInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const mounted = useRef(false);
  const actionLock = useRef(false);
  const loadGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const current = () => mounted.current && generation === loadGeneration.current;
    setLoading(true); setError("");
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sign in again as administrator.");
      const { data: profile, error: profileError } = await supabase.from("profiles")
        .select("role,is_active").eq("id", auth.user.id).single();
      if (profileError || profile?.role !== "admin" || profile.is_active !== true)
        throw new Error("Active administrator access is required.");
      const [p, o, plan, entries, existing] = await Promise.all([
        supabase.from("projects").select("id,title,location", { count: "exact" }).eq("status", "active").order("title"),
        supabase.from("offerings").select("id,project_id,title,offering_type", { count: "exact" }).eq("status", "active").order("title"),
        supabase.from("access_request_access_plans").select("requested_role,revision,applied_at").eq("request_id", request.id).maybeSingle(),
        supabase.from("access_request_offering_plans").select("offering_id", { count: "exact" }).eq("request_id", request.id),
        supabase.from("access_invitations").select("id,request_id,email,requested_role,status,invited_at").eq("request_id", request.id).maybeSingle(),
      ]);
      if (!current()) return;
      if ([p,o,plan,entries,existing].some(result => result.error)) throw new Error("Unable to load the access selection. No changes were made.");
      if ([p,o,entries].some(result => result.count !== null && result.count > (result.data?.length ?? 0)))
        throw new Error("The opportunity list is incomplete. Do not save; pagination is required.");
      const planRow = plan.data as Plan | null;
      const ids = (entries.data ?? []).map(x => x.offering_id as string);
      setProjects((p.data ?? []) as Project[]); setOfferings((o.data ?? []) as Offering[]);
      setRole(planRow?.requested_role ?? "client"); setSelected(ids);
      setSaved(planRow ? { role: planRow.requested_role, ids, revision: planRow.revision } : null);
      setInvitation(existing.data as PlannedInvitation | null);
    } catch (cause) { if (current()) setError(messageOf(cause)); }
    finally { if (current()) setLoading(false); }
  }, [request.id]);
  useEffect(() => {
    mounted.current = true; void load();
    return () => { mounted.current = false; loadGeneration.current += 1; };
  }, [load]);

  const selectable = offerings.filter(o => projects.some(p => p.id === o.project_id));
  const dirty = !saved || saved.role !== role || !sameIds(saved.ids, selected);
  const unavailableSaved = selected.some(id => !selectable.some(o => o.id === id));
  const locked = busy || loading || Boolean(invitation) || uncertain || Boolean(error);
  const selectionText = () => selected.map(id => {
    const offering = selectable.find(o => o.id === id);
