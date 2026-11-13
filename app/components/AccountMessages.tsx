import {getMessages} from 'next-intl/server';
import ScopedClientMessages from './ScopedClientMessages';

export default async function AccountMessages({children}: {children: React.ReactNode}) {
  const {AccountUI} = await getMessages();
  return <ScopedClientMessages messages={{AccountUI}}>{children}</ScopedClientMessages>;
}
