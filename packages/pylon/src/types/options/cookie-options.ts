import type { PylonCookieAttributes } from "../settings/cookie-settings.js";
import type { PylonEncKey, PylonSignKey, PylonVerifyKey } from "../settings/keys.js";

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
export type PylonSetCookieOptions = PylonCookieAttributes & {
  /** Encrypts THIS cookie's value. `true` ⇒ `cookies.encryption`; a selector ⇒ that key; `false` ⇒ off. */
  encryption?: boolean | PylonEncKey;
  /** Signs THIS cookie. `true` ⇒ `cookies.signature`; a selector ⇒ that key; `false` ⇒ off. */
  signature?: boolean | PylonSignKey;
};

export type PylonGetCookieOptions = Pick<PylonCookieAttributes, "encoding"> & {
  /** `true` ⇒ decrypt (the ciphertext names its own key); `false` ⇒ off; absent ⇒ on iff `cookies.encryption` is named. */
  encrypted?: boolean | PylonEncKey;
  /**
   * Whether — and against which key — THIS cookie's signature is verified,
   * checked on the key its `.kid` names before the signature is trusted.
   *
   * - `true` ⇒ verify with the deployment `cookies.signature` condition.
   * - a selector ⇒ verify against that key's condition.
   * - `false` ⇒ not verified.
   * - absent ⇒ verified iff `cookies.signature` is named (its condition is the
   *   verification policy).
   *
   * The read side of DECRYPTION takes no key — ciphertext names its own.
   */
  signed?: boolean | PylonVerifyKey;
};
