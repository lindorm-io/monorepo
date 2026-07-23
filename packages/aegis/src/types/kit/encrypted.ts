import type { TokenData } from "@lindorm/types";
import type { WireTokenEnvelope } from "../header/wire-envelope.js";
import type { WireTokenHeader } from "../header/wire-header.js";
import type { TokenContent } from "./content.js";

/**
 * The ENCRYPTED (confidentiality) encrypt options — the generic base shared by
 * JWE and CWE (the bare wire envelope). A SPECIFIC derived type appears only for
 * a genuine wire delta ({@link JweEncryptOptions}).
 */
export type EncryptTokenOptions = WireTokenEnvelope;

/**
 * The JWE encrypt options — {@link EncryptTokenOptions} plus the JOSE-only
 * ECDH-ES party info (RFC 7518 §4.6), a real wire delta (R3).
 */
export type JweEncryptOptions = EncryptTokenOptions & {
  /**
   * ECDH-ES Agreement PartyUInfo (RFC 7518 §4.6.1.2) — the base64url producer
   * identity. Fed to the Concat-KDF AND emitted on the protected header (`apu`)
   * ONLY when the recipient key is an ECDH-ES algorithm; stripped otherwise.
   */
  partyProducer?: string;
  /**
   * ECDH-ES Agreement PartyVInfo (RFC 7518 §4.6.1.3) — the base64url recipient
   * identity. Same ECDH-ES gate/strip semantics as {@link partyProducer}; on the
   * read side a kit configured with `partyRecipient` verifies the incoming `apv`.
   */
  partyRecipient?: string;
};

/**
 * The COSE_Encrypt0 encrypt options — {@link EncryptTokenOptions} with no wire
 * delta beyond the shared base (direct AEAD carries no key-management params;
 * `proprietary`/`unprotected` already live on the envelope).
 */
export type CweEncryptOptions = EncryptTokenOptions;

/**
 * The ENCRYPTED decrypt options — shared by JWE and CWE. Empty at the kit level
 * (decrypt takes no wire knobs); Aegis intersects `& { key? }` for its per-call
 * key policy. Modelled as `Record<never, never>` (a clean empty object with no
 * index signature, so the `& { key? }` intersection is well-formed).
 */
export type DecryptTokenOptions = Record<never, never>;

/**
 * The NATIVE WIRE result of decrypting an ENCRYPTED token (`JweKit.decrypt` /
 * `CweKit.decrypt`). The COSE-and-JOSE-uniform decrypt result: the unified WIRE
 * header ({@link WireTokenHeader} for BOTH — R1: no domain-shaped JWE header),
 * the plaintext `payload` — the negotiated content reconstructed from the cty
 * header (a `Dict` for `application/json`, a `string` for `text/plain`, else a
 * `Buffer` — the fallback when cty is absent/unknown) — and the NATIVE token
 * (`string` JOSE / `Buffer` COSE).
 *
 * Named distinctly from the DOMAIN `DecryptedToken` (the `aegis.decrypt`
 * claims/custom result, which pairs with `VerifiedToken`) — this is the wire tier.
 */
export type DecryptedEncryptedToken<
  P extends TokenContent = Buffer,
  T extends TokenData = Buffer,
> = {
  header: WireTokenHeader;
  payload: P;
  token: T;
};

/**
 * The uniform `decode` result for an ENCRYPTED token — JWE ≡ CWE: the unified
 * WIRE header ONLY (the content stays ciphertext; reading it needs the key). A
 * JWE protected header carries a key-management `alg` alongside the content
 * `enc`, whereas a COSE_Encrypt0 carries only `enc` — so `alg` is present for JWE
 * and absent for CWE, though both share this ONE result type.
 */
export type DecodedEncryptedToken<T extends TokenData = Buffer> = {
  header: WireTokenHeader;
  token: T;
};
