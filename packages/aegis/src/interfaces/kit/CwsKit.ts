import type {
  DecodedUnstructuredToken,
  SignUnstructuredTokenOptions,
  TokenContent,
  VerifiedUnstructuredToken,
} from "../../types/index.js";

/**
 * The opaque COSE signer — the COSE analogue of {@link IJwsKit}. `sign` serialises
 * arbitrary content (cty negotiated via the shared codec) and returns the BARE
 * encoded COSE token (COSE_Sign1 / COSE_Mac0 bytes); `verify` consumes the ENCODED
 * COSE token bytes (R2 — decoded internally, parallel to JOSE), returning the
 * cty-reconstructed payload + the unified wire header + the native token; `decode`
 * reads an encoded COSE token to its unified wire header + reconstructed payload,
 * uniform with JWS decode (no signature/MAC check).
 */
export interface ICwsKit {
  sign(content: TokenContent, options?: SignUnstructuredTokenOptions): Buffer;
  verify<T extends TokenContent = Buffer>(
    token: Buffer,
  ): VerifiedUnstructuredToken<T, Buffer>;
  decode<T extends TokenContent = Buffer>(
    token: Buffer,
  ): DecodedUnstructuredToken<T, Buffer>;
}
