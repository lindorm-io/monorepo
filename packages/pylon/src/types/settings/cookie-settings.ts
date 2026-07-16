import type { Expiry } from "@lindorm/date";
import type { PylonEncKey, PylonSignKey } from "./keys.js";

export type CookieEncoding = "base64" | "base64url" | "hex";
export type CookiePriority = "low" | "medium" | "high";
export type CookieSameSite = "strict" | "lax" | "none";

/**
 * The cookie PRESENTATION attributes shared by both tiers — the neutral base
 * both the deployment-wide `PylonCookieSettings` and the per-call
 * `PylonSetCookieOptions`/`PylonGetCookieOptions` Pick from. It reads as neither
 * tier: settings declare the deployment defaults, options override per cookie.
 */
export type PylonCookieAttributes = {
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
  PylonCookieAttributes,
  "chunked" | "chunkSize" | "domain" | "encoding" | "httpOnly" | "sameSite" | "secure"
> & {
  encryption?: PylonEncKey;
  signature?: PylonSignKey;
};
