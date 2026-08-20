import type { TokenData } from "@lindorm/types";
import type { CertificateBindingMode } from "../header/domain-header.js";
import type { WireHeaderBuckets } from "../header/wire-buckets.js";
import type {
  CoseWireTokenEnvelope,
  JoseWireTokenEnvelope,
} from "../header/wire-envelope.js";
import type { TokenContent } from "./content.js";

/**
 * The JWS UNSTRUCTURED (opaque) sign options — the bare JOSE wire envelope: no
 * claim-pruning knob at the kit level (JWS secures opaque bytes).
 */
export type JoseSignUnstructuredTokenOptions = JoseWireTokenEnvelope;

/**
 * The CWS UNSTRUCTURED (opaque) sign options — the bare COSE wire envelope. The
 * CWS claims-map pruning is an Aegis-tier concern applied before the CBOR bytes
 * reach the kit, so it is no knob here either.
 */
export type CoseSignUnstructuredTokenOptions = CoseWireTokenEnvelope;

/**
 * The UNSTRUCTURED verify options — shared by JWS and CWS. The cert-binding knob
 * governs the post-verify certificate check on both wires.
 */
export type VerifyUnstructuredTokenOptions = {
  certBindingMode?: CertificateBindingMode;
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
 * The NATIVE WIRE result of verifying an UNSTRUCTURED (opaque) token — JWS ≡ CWS.
 * `payload` is the negotiated content reconstructed from the PROTECTED cty header
 * (a `Dict` for `application/json`, a `string` for `text/plain`, else a `Buffer` —
 * the fallback when cty is absent/unknown); the two WIRE header buckets are
 * {@link WireHeaderBuckets}; the token is the NATIVE form (`string` JOSE /
 * `Buffer` COSE). A claim-bearing token is a CWT/JWT, never a CWS/JWS.
 */
export type VerifiedUnstructuredToken<
  P extends TokenContent = Buffer,
  T extends TokenData = Buffer,
> = WireHeaderBuckets & {
  payload: P;
  token: T;
};

/**
 * The uniform `decode` result for an UNSTRUCTURED token — JWS ≡ CWS: the two WIRE
 * header buckets + the cty-reconstructed payload + the native token, NO
 * signature/MAC verification.
 */
export type DecodedUnstructuredToken<
  P extends TokenContent = Buffer,
  T extends TokenData = Buffer,
> = WireHeaderBuckets & {
  payload: P;
  signature: T;
  token: T;
};
