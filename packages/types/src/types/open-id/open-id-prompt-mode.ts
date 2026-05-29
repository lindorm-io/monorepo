// OIDC Core §3.1.2.1 (consent | login | select_account | none) +
// OIDC Initiating User Registration "create".
export type OpenIdPromptMode =
  | "consent"
  | "create"
  | "login"
  | "select_account"
  | "none"
  | (string & {});
