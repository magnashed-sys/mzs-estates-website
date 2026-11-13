import {getMessages} from "next-intl/server";
import ScopedClientMessages from "../components/ScopedClientMessages";
import type {Metadata} from "next";
export const metadata: Metadata = {robots: {index: false, follow: false}};
export default async function LoginLayout({children}: {children: React.ReactNode}) {
  const {Login} = await getMessages();
  return <ScopedClientMessages messages={{Login}}>{children}</ScopedClientMessages>;
}
