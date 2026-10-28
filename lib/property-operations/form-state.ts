/**
 * Safe serializable initial state for client useActionState components.
 * Never export this object from a "use server" Server Actions module:
 * Next.js allows only exported async functions in those files.
 */
export type FormActionState={
  status:"idle"|"success"|"error";
  message:string;
};
export const initialFormActionState:FormActionState={status:"idle",message:""};
