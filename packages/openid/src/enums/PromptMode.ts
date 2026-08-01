/**
 * OIDC Core §3.1.2.1 `prompt` values (consent | login | select_account | none)
 * + OIDC Initiating User Registration 1.0 (`create`).
 *
 * The type stays OPEN — `prompt` is a space-delimited list on the wire and
 * additional values may be registered.
 */
export const PromptMode = {
  /** wire: `consent` — OIDC Core §3.1.2.1 */
  Consent: "consent",
  /** wire: `create` — OIDC Initiating User Registration 1.0 §4 */
  Create: "create",
  /** wire: `login` — OIDC Core §3.1.2.1 */
  Login: "login",
  /** wire: `select_account` — OIDC Core §3.1.2.1 */
  SelectAccount: "select_account",
  /** wire: `none` — OIDC Core §3.1.2.1; MUST NOT be combined with any other value */
  None: "none",
} as const;

export type PromptMode = (typeof PromptMode)[keyof typeof PromptMode] | (string & {});
