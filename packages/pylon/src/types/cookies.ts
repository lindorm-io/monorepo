import type { Expiry } from "@lindorm/date";
import type { PylonEncKey, PylonSignKey, PylonVerifyKey } from "./keys.js";

export type CookieEncoding = "base64" | "base64url" | "hex";
export type CookiePriority = "low" | "medium" | "high";
export type CookieSameSite = "strict" | "lax" | "none";

export type PylonCookieOptions = {
  chunked?: boolean;
  chunkSize?: number;
  domain?: string;
  encoding?: CookieEncoding;
  encrypted?: boolean;
  expiry?: Expiry;
  httpOnly?: boolean;
  partitioned?: boolean;
  path?: string;
  priority?: CookiePriority;
  sameSite?: CookieSameSite;
  secure?: boolean;
  signed?: boolean;
};

export type PylonCookieConfig = Pick<
  PylonCookieOptions,
  | "chunked"
  | "chunkSize"
  | "domain"
  | "encoding"
  | "encrypted"
  | "httpOnly"
  | "sameSite"
  | "secure"
  | "signed"
>;

/**
 * `ctx.cookies.set` / `.get` are generic — they sign and seal every cookie the
 * same way, with the keys named in `keys.cookie`. A cookie that needs its OWN
 * key says so here, and that is how the session cookie's keys reach the signer
 * and the cipher without pylon ever sniffing cookie names.
 *
 * Absent ⇒ the `keys.cookie.*` key for that role. There is no third fallback:
 * the roles a cookie can override are exactly the roles pylon resolves.
 */
export type PylonSetCookie = PylonCookieOptions & {
  /** Signs THIS cookie. Falls back to `keys.cookie.signature`. */
  signature?: PylonSignKey;
  /** Encrypts THIS cookie's value. Falls back to `keys.cookie.encryption`. */
  encryption?: PylonEncKey;
};

export type PylonGetCookie = Pick<PylonCookieOptions, "encoding"> & {
  encrypted?: boolean;
  signed?: boolean;
  /**
   * Checked on the key THIS cookie's `.kid` names, before its signature is
   * verified. Falls back to `keys.cookie.verification`.
   *
   * The read side of DECRYPTION takes no key — ciphertext names its own.
   */
  verification?: PylonVerifyKey;
};
