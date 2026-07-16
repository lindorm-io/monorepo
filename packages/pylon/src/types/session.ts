import type { IPylonSession } from "../interfaces/index.js";
import type { PylonSetCookie } from "./cookies.js";

export type PylonSessionOnContext = {
  set(session: IPylonSession): Promise<void>;
  get(): Promise<IPylonSession | null>;
  del(): Promise<void>;
  logout(subject: string): Promise<void>;
};

export type PylonSessionConfig = Pick<
  PylonSetCookie,
  | "domain"
  | "encoding"
  | "expiry"
  | "httpOnly"
  | "path"
  | "priority"
  | "sameSite"
  | "secure"
> & {
  name?: string;
  /**
   * Seal the session cookie. A plain boolean — the session middleware resolves
   * WHICH key (`keys.session.encryption ?? keys.cookie.encryption`, or the
   * deployment cookie key) and translates it into the cookie's `encryption`
   * union. An encrypted session with no key configured fails closed, never
   * writes plaintext.
   */
  encrypted?: boolean;
  /** Sign the session cookie. Resolved the same way as {@link encrypted}. */
  signed?: boolean;
};
