export function introCallsEnvironmentAllowed() {
  const env = process.env.VERCEL_ENV;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (env === "production" && url === "https://ptrnjzmcehrhbsfxntgw.supabase.co") ||
    (env === "preview" && url === "https://senonkpxdtlhyhrubicg.supabase.co");
}

export type IntroCallInput = { requestKey: string; name: string; email: string; phone: string; message: string; source: "private-capital" | "real-estate" | "consultancy" };
export function parseIntroCall(value: unknown): IntroCallInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.requestKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestKey)) return null;
  const source = input.source ?? "private-capital";
  if (source !== "private-capital" && source !== "real-estate" && source !== "consultancy") return null;
  const clean = (v: unknown, limit: number, optional = false) => {
    if (optional && (v === undefined || v === "")) return "";
    if (typeof v !== "string" || v.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)) return null;
    return v.trim();
  };
  const name = clean(input.name, 120), email = clean(input.email, 254);
  const phone = clean(input.phone, 40, true), message = clean(input.message, 1000, true);
  if (!name || !email || phone === null || message === null || /[\r\n]/.test(name + email + phone) ||
      !/^[^\s@<>(),;:\\"]+@[^\s@<>(),;:\\"]+\.[^\s@<>(),;:\\"]+$/.test(email)) return null;
  return { requestKey: input.requestKey, name, email: email.toLowerCase(), phone, message, source };
}
