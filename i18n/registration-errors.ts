/** Translate known public API messages; never display unexpected backend details. */
const keys: Record<string,string> = {
  "New account registration is being prepared. Please return later.": "registration0",
  "Unable to process this registration.": "registration1",
  "Registration is temporarily unavailable.": "registration2",
  "The test environment is not ready yet.": "registration3",
  "Submission is too large.": "registration4",
  "Please complete the registration form.": "registration5",
  "Check your name, email, interests and password (minimum 8 characters).": "registration6",
  "Too many registration attempts. Please try again later or contact MZS Group.": "registration7",
  "An account already exists for this email address. Please sign in or reset your password.": "registration8",
  "A private access request already exists for this email address. Please contact MZS Group.": "registration9",
  "An account already exists for this email address. Please sign in.": "registration10",
  "Registration could not be completed. Please try again later.": "registration11",
  "Your account may have been created, but we could not verify the application record. Contact MZS Group; do not register twice.": "registration12",
  "Registration needs a configuration review. Contact MZS Group; do not register twice.": "registration13",
  "Registration is temporarily unavailable. Please try again later.": "registration14"
};
export function registrationErrorKey(message: unknown) { return typeof message === "string" && Object.hasOwn(keys, message) ? keys[message] : "a071"; }
