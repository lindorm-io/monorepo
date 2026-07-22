import type { CwsSignOptions, CwsVerifyResult } from "../../classes/CwsKit.js";
import type { Tag } from "../../internal/cose/cbor.js";
import type { DecodedOpaqueToken } from "../../types/index.js";

/**
 * The opaque COSE signer — the COSE analogue of {@link IJwsKit}. `sign` produces
 * a COSE structure (`Tag`) and `verify` consumes one; `decode` reads an encoded
 * COSE token to its unified wire header + opaque payload bytes, uniform with JWS
 * decode (no signature/MAC check).
 */
export interface ICwsKit {
  sign(payload: Buffer, options?: CwsSignOptions): Tag;
  verify(structure: unknown): CwsVerifyResult;
  decode(token: Buffer): DecodedOpaqueToken;
}
