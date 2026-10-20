'use client';
import {useFormStatus} from 'react-dom';
export default function ClientAccessSubmit({children}:{children:React.ReactNode}){
 const {pending}=useFormStatus();
 return <button disabled={pending}>{pending?'Saving…':children}</button>;
}
