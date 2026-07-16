import type { IProteusSource } from "@lindorm/proteus";
import type { PylonCookieAttributes } from "./cookie-settings.js";
import type { PylonEncKey, PylonSignKey } from "./keys.js";

/**
 * Session SETTINGS — the `new Pylon({ session })` declaration. A pylon session
 * IS a cookie, so this carries the same presentation defaults and the same two
 * FLAT key selectors as `PylonCookieSettings` (`signature`/`encryption`), plus
 * the session-only `enabled`/`kv`/`name`.
 *
 * Each key selector defaults to the cookie one:
 * `session.<role> ?? cookies.<role>` (see `resolveSessionKeys`). Name only
 * `cookies` and one set of keys does everything; name `session` keys too and the
 * session cookie is signed / sealed with its OWN key. Verification is derived
 * from the resolved `signature` predicate, never declared.
 */
export type PylonSessionSettings = Pick<
  PylonCookieAttributes,
  | "domain"
  | "encoding"
  | "expiry"
  | "httpOnly"
  | "path"
  | "priority"
  | "sameSite"
  | "secure"
> & {
  enabled: boolean;
  kv?: IProteusSource;
  name?: string;
  encryption?: PylonEncKey;
  signature?: PylonSignKey;
};
