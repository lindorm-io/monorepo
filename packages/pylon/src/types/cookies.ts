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
  expiry?: Expiry;
  httpOnly?: boolean;
  partitioned?: boolean;
  path?: string;
  priority?: CookiePriority;
  sameSite?: CookieSameSite;
  secure?: boolean;
};

/**
 * Deployment-wide cookie SETTINGS — the `new Pylon({ cookies })` declaration.
 * Pure DECLARATION: presentation defaults (`chunked`/`domain`/`encoding`/
 * `httpOnly`/`sameSite`/`secure`/…) merged BEFORE any per-call options, plus the
 * two FLAT key selectors — `signature` and `encryption`.
 *
 * The split is the whole point: settings declare WHICH keys sign / seal / verify
 * cookies, the runtime `PylonSetCookieOptions`/`PylonGetCookieOptions` toggles
 * decide PER COOKIE whether to. A CONFIGURED key turns its role ON by default — a
 * plain `set(name, value)` is signed when `signature` is named and sealed when
 * `encryption` is named, and the matching `get` verifies / decrypts it without
 * repeating the option. An ABSENT key ⇒ the role is off. A per-cookie
 * `set(name, value, { signature: false })` opts THAT cookie out even when a
 * signing key is configured.
 *
 * There is no `verification` selector: verification is derived from the
 * `signature` selector's predicate (see `resolveVerificationKey`), never
 * declared.
 */
export type PylonCookieSettings = Pick<
  PylonCookieOptions,
  "chunked" | "chunkSize" | "domain" | "encoding" | "httpOnly" | "sameSite" | "secure"
> & {
  encryption?: PylonEncKey;
  signature?: PylonSignKey;
};

/**
 * The RUNTIME toggle for one `ctx.cookies.set`. Each field is `boolean |
 * <selector>` and overrides the settings default for THIS cookie:
 *
 * - `true` ⇒ the deployment `cookies.<role>` key for that role.
 * - a selector ⇒ THIS cookie's own key (how the session cookie carries its own).
 * - `false` ⇒ the role is off, even when a `cookies.<role>` key is configured.
 * - absent ⇒ the settings default: on iff `cookies.<role>` is named.
 *
 * There is no third fallback: the roles a cookie can override are exactly the
 * roles pylon resolves. Pylon never sniffs cookie names.
 */
export type PylonSetCookieOptions = PylonCookieOptions & {
  /** Encrypts THIS cookie's value. `true` ⇒ `cookies.encryption`; a selector ⇒ that key; `false` ⇒ off. */
  encryption?: boolean | PylonEncKey;
  /** Signs THIS cookie. `true` ⇒ `cookies.signature`; a selector ⇒ that key; `false` ⇒ off. */
  signature?: boolean | PylonSignKey;
};

export type PylonGetCookieOptions = Pick<PylonCookieOptions, "encoding"> & {
  /** `true` ⇒ decrypt (the ciphertext names its own key); `false` ⇒ off; absent ⇒ on iff `cookies.encryption` is named. */
  encrypted?: boolean | PylonEncKey;
  /**
   * Whether — and against which key — THIS cookie's signature is verified,
   * checked on the key its `.kid` names before the signature is trusted.
   *
   * - `true` ⇒ verify with the deployment `cookies.signature` predicate.
   * - a selector ⇒ verify against that key's predicate.
   * - `false` ⇒ not verified.
   * - absent ⇒ verified iff `cookies.signature` is named (its predicate is the
   *   verification policy).
   *
   * The read side of DECRYPTION takes no key — ciphertext names its own.
   */
  signed?: boolean | PylonVerifyKey;
};
