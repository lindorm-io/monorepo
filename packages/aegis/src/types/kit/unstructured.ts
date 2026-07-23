import type { TokenData } from "@lindorm/types";
import type { CertificateBindingMode } from "../header/domain-header.js";
import type { WireTokenEnvelope } from "../header/wire-envelope.js";
import type { WireTokenHeader } from "../header/wire-header.js";
import type { TokenContent } from "./content.js";

/**
 * The UNSTRUCTURED (opaque) sign options — shared by JWS and CWS. The bare wire
 * envelope: no claim-pruning knob at the kit level (JWS secures opaque bytes; the
 * CWS claims-map pruning is an Aegis-tier concern applied before the CBOR bytes
 * reach the kit).
 */
export type SignUnstructuredTokenOptions = WireTokenEnvelope;

/**
 * The UNSTRUCTURED verify options — shared by JWS and CWS. Only the JOSE-side
 * cert-binding knob (COSE ignores it); JWS verify formerly took NO options.
 */
export type VerifyUnstructuredTokenOptions = {
  certBindingMode?: CertificateBindingMode;
};

/**
 * The NATIVE WIRE result of verifying an UNSTRUCTURED (opaque) token — JWS ≡ CWS.
 * `payload` is the negotiated content reconstructed from the cty header (a `Dict`
 * for `application/json`, a `string` for `text/plain`, else a `Buffer` — the
 * fallback when cty is absent/unknown); the unified WIRE header is
 * {@link WireTokenHeader}; the token is the NATIVE form (`string` JOSE / `Buffer`
 * COSE). A claim-bearing token is a CWT/JWT, never a CWS/JWS.
 */
export type VerifiedUnstructuredToken<
  P extends TokenContent = Buffer,
  T extends TokenData = Buffer,
> = {
  header: WireTokenHeader;
  payload: P;
  token: T;
};

/**
 * The uniform `decode` result for an UNSTRUCTURED token — JWS ≡ CWS: the unified
 * WIRE header + the cty-reconstructed payload + the native token, NO
 * signature/MAC verification.
 */
export type DecodedUnstructuredToken<
  P extends TokenContent = Buffer,
  T extends TokenData = Buffer,
> = {
  header: WireTokenHeader;
  payload: P;
  token: T;
};
