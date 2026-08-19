import type { Dict } from "@lindorm/types";
import type { DomainTokenHeader } from "../header/domain-header.js";

/**
 * The `aegis.decrypt` result — CONFIDENTIAL but NOT sender-authenticated: the
 * plaintext of an encrypted token, with no inner signature checked.
 *
 * ⚠ It carries NO claims layer, and that is the verb's contract rather than a
 * gap. `encrypt`/`decrypt` are a pure confidentiality pair — the value sealed is
 * the value returned, unrenamed and uninterpreted — so there is nothing here for
 * a registry to categorise. A claim is a statement by an issuer, and an issuer is
 * something only a signature establishes; read those with `verify` (authenticated)
 * or `parse` (keyless), both of which report `claims`/`custom`.
 *
 * The result used to carry FOUR payload-shaped fields — `claims`, `custom`, `raw`
 * and `wire` — of which two were always empty, decided by a per-wire content-type
 * discriminant over a payload the encrypt path had renamed on the way in.
 */
export type DecryptedToken<C extends Dict = Dict> = {
  /**
   * This token's OWN kind, which for a decrypt is always the encrypting outer —
   * `decrypt` reads THAT token and hands back its plaintext under `payload`.
   *
   * ⚠ There is no `wrapper` here, and its absence is the statement: nothing
   * encloses the token being read. That is the same shape `aegis.encrypt`
   * returns, and it is why `format === "jwe"` alone never means "a signed token
   * is inside" — a sign-then-encrypt reports `{ format: "jwt", wrapper: "jwe" }`
   * from `verify` instead.
   *
   * ⚠ There is no `inner` field either, for the same reason: this verb does not
   * inspect the plaintext for a nested token, so nothing could populate one.
   */
  format: "jwe" | "cwe";
  contentType?: string;
  /**
   * The encrypting outer's header, domain-keyed and uniform across JOSE and COSE
   * — the two wire buckets merged under the header registry's `placement`
   * allowlist, protected last. See {@link VerifiedToken.header}.
   *
   * ⚠ The AEAD covers the protected bucket in full (it is the `Enc_structure`
   * AAD, RFC 9052 §5.3), so on this verb the merge admits only the COSE
   * `kid`/`iv` that RFC 9052 §3.1 puts outside it.
   */
  header: DomainTokenHeader;
  /**
   * THE PLAINTEXT, as the TYPE it was sealed as — `TokenContent` with `C` in the
   * object slot, so a caller that knows what it sealed can name that shape
   * (`aegis.decrypt<Session>(token)`) instead of casting the result.
   *
   * Which type comes back is decided by the outer's own `cty`, which the writer
   * stamped from the value's shape: a Dict in is a Dict out, a `string` a
   * `string`, a `Buffer` a `Buffer`. A NESTED token comes back in its wire's
   * native form — the compact string on JOSE, the COSE bytes on COSE.
   */
  payload: Array<any> | boolean | Buffer | C | number | string;
  token: string;
};
