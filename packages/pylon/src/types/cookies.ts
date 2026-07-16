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
 * Deployment-wide cookie defaults, merged BEFORE any per-call options. Signing
 * and sealing collapse into a single field each: a `boolean` picks the
 * deployment cookie key (`true`) or turns the role off (`false`), a selector
 * names a different key outright.
 */
export type PylonCookieConfig = Pick<
  PylonCookieOptions,
  "chunked" | "chunkSize" | "domain" | "encoding" | "httpOnly" | "sameSite" | "secure"
> & {
  /** `true` ⇒ sign with `keys.cookie.signature`; a selector ⇒ that key; `false`/absent ⇒ unsigned. */
  signature?: boolean | PylonSignKey;
  /** `true` ⇒ seal with `keys.cookie.encryption`; a selector ⇒ that key; `false`/absent ⇒ plaintext. */
  encryption?: boolean | PylonEncKey;
  /**
   * Deployment-wide READ defaults, so an ordinary cookie set with a config-level
   * `signature`/`encryption` is verified/decrypted on read without repeating it
   * per `get` — the symmetry the old `signed`/`encrypted` booleans gave.
   */
  /** `true` ⇒ verify with `keys.cookie.verification`; a selector ⇒ that key; `false`/absent ⇒ not verified. */
  signed?: boolean | PylonVerifyKey;
  /** `true` ⇒ decrypt on read (ciphertext names its own key); `false`/absent ⇒ plaintext. */
  encrypted?: boolean;
};

/**
 * `ctx.cookies.set` signs and seals every cookie the same way, driven by two
 * collapsed fields. Each is `boolean | <selector>`:
 *
 * - `true` ⇒ the deployment `keys.cookie.*` key for that role.
 * - a selector ⇒ THIS cookie's own key (how the session cookie carries its own).
 * - `false` / absent ⇒ the role is off.
 *
 * There is no third fallback: the roles a cookie can override are exactly the
 * roles pylon resolves. Pylon never sniffs cookie names.
 */
export type PylonSetCookie = PylonCookieOptions & {
  /** Signs THIS cookie. `true` ⇒ `keys.cookie.signature`; a selector ⇒ that key. */
  signature?: boolean | PylonSignKey;
  /** Encrypts THIS cookie's value. `true` ⇒ `keys.cookie.encryption`; a selector ⇒ that key. */
  encryption?: boolean | PylonEncKey;
};

export type PylonGetCookie = Pick<PylonCookieOptions, "encoding"> & {
  /** `true` ⇒ decrypt (the ciphertext names its own key); `false`/absent ⇒ plaintext. */
  encrypted?: boolean;
  /**
   * Whether — and against which key — THIS cookie's signature is verified,
   * checked on the key its `.kid` names before the signature is trusted.
   *
   * - `true` ⇒ verify with `keys.cookie.verification`.
   * - a selector ⇒ verify against that key's predicate.
   * - `false` / absent ⇒ not verified.
   *
   * The read side of DECRYPTION takes no key — ciphertext names its own.
   */
  signed?: boolean | PylonVerifyKey;
};
