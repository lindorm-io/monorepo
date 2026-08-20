import type { TokenData } from "@lindorm/types";
import type { WireHeaderBuckets } from "../header/wire-buckets.js";
import type {
  CoseWireTokenEnvelope,
  JoseWireTokenEnvelope,
} from "../header/wire-envelope.js";
import type { TokenContent } from "./content.js";

/**
 * The JOSE ENCRYPTED (confidentiality) encrypt options — the bare JOSE wire
 * envelope. A SPECIFIC derived type appears only for a genuine wire delta
 * ({@link JweEncryptOptions}).
 */
export type JoseEncryptTokenOptions = JoseWireTokenEnvelope;

/** The COSE ENCRYPTED (confidentiality) encrypt options — the bare COSE wire envelope. */
export type CoseEncryptTokenOptions = CoseWireTokenEnvelope;

/**
 * The JWE encrypt options — {@link JoseEncryptTokenOptions} plus the JOSE-only
 * ECDH-ES party info (RFC 7518 §4.6), a real wire delta.
 */
export type JweEncryptOptions = JoseEncryptTokenOptions & {
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
 * The COSE_Encrypt0 encrypt options — {@link CoseEncryptTokenOptions} with no wire
 * delta beyond the COSE envelope (direct AEAD carries no key-management params;
 * `proprietary`/`custom.unprotected` already live on the envelope).
 */
export type CweEncryptOptions = CoseEncryptTokenOptions;

/**
 * The ENCRYPTED decrypt options — shared by JWE and CWE. Aegis intersects
 * `& { key? }` for its per-call key policy.
 *
 * ⚠ A DECRYPT DOOR TAKES THE `crit` DECLARATION because both wires MINT a
 * critical custom parameter on an encrypting outer ({@link JweEncryptOptions} /
 * {@link CweEncryptOptions} carry `header.crit` beside `custom.protected`), and
 * because `aegis.verify` peels a nested token through `JweKit.decrypt` /
 * `CweKit.decrypt` — so without it the outer's declaration has nowhere to travel
 * and the token aegis just minted becomes unreadable.
 */
export type DecryptTokenOptions = {
  /**
   * Custom header parameters the CALLER takes responsibility for — it will act on
   * them after aegis returns. RFC 7515 §4.1.11 puts the duty on the RECIPIENT, and
   * aegis is never the final recipient; it verifies on the application's behalf.
   *
   * A `crit` member is accepted only when it is named here AND carried by the
   * token. Absent means nothing is declared, so EVERY critical parameter is
   * refused — `oid` included, since registering a parameter says nothing about
   * whether the application can act on it. Fail closed.
   *
   * ⚠ WIRE names — `["oid"]`, never the domain `["objectId"]`. An unregistered
   * custom parameter is spelled identically at both tiers.
   */
  crit?: Array<string>;
};

/**
 * The NATIVE WIRE result of decrypting an ENCRYPTED token (`JweKit.decrypt` /
 * `CweKit.decrypt`). The COSE-and-JOSE-uniform decrypt result: the two WIRE
 * header buckets ({@link WireHeaderBuckets} for BOTH — no domain-shaped JWE
 * header), the plaintext `payload` — the negotiated content reconstructed from
 * the PROTECTED cty header (a `Dict` for `application/json`, a `string` for
 * `text/plain`, else a `Buffer` — the fallback when cty is absent/unknown) — and
 * the NATIVE token (`string` JOSE / `Buffer` COSE).
 *
 * Named distinctly from the DOMAIN `DecryptedToken` (the `aegis.decrypt`
 * claims/custom result, which pairs with `VerifiedToken`) — this is the wire tier.
 */
export type DecryptedEncryptedToken<
  P extends TokenContent = Buffer,
  T extends TokenData = Buffer,
> = WireHeaderBuckets & {
  payload: P;
  token: T;
};

/**
 * The uniform `decode` result for an ENCRYPTED token — JWE ≡ CWE: the two WIRE
 * header buckets ONLY (the content stays ciphertext; reading it needs the key). A
 * JWE protected header carries a key-management `alg` alongside the content
 * `enc`, whereas a COSE_Encrypt0 carries only `enc` — so `alg` is present for JWE
 * and absent for CWE, though both share this ONE result type. The COSE_Encrypt0
 * IV and `kid` ride the UNPROTECTED bucket (RFC 9052 §5.2).
 */
export type DecodedEncryptedToken<T extends TokenData = Buffer> = WireHeaderBuckets & {
  token: T;
};
