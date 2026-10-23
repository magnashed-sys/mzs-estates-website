import {isLocale} from "./public-routing";
export function rememberLocale(locale: string) {
  if (!isLocale(locale)) return;
  document.cookie = `MZS_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}
