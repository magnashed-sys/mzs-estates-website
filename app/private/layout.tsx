import {getMessages} from "next-intl/server";
import ScopedClientMessages from "../components/ScopedClientMessages";
import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Layout({children}: {children: React.ReactNode}) {
  const {Private, RentalAccount, MemberUI, CapitalUI} = await getMessages();
  return <ScopedClientMessages messages={{Private, RentalAccount, MemberUI, CapitalUI}}>{children}</ScopedClientMessages>;
}
