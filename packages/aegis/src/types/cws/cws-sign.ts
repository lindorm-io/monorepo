import type { Dict } from "@lindorm/types";
import type { TokenType } from "../../constants/token-type.js";
import type { OmitMode } from "../../internal/utils/apply-omit.js";
import type { AegisSignKey } from "../aegis.js";

/**
 * The payload a raw CWS secures. Unlike raw JWS (`JwsContent = Buffer | string`,
 * an opaque byte payload), the raw COSE_Sign1 path secures a CBOR claims MAP —
 * it goes through the CWT claims codec — so a `cws` payload is a claims object,
 * never a pre-serialised string/Buffer. This is a real COSE constraint, not a
 * choice: the signer rejects a string/Buffer payload.
 */
export type CwsContent = Dict;

export type SignCwsOptions = {
  objectId?: string;
  /**
   * Per-call signing key policy. Resolved by `Aegis` exactly as the JWS path
   * resolves it, so a predicate can pin an internal, unpublished key.
   */
  key?: AegisSignKey;
  /**
   * How empty claims are pruned before the CBOR is emitted. `"empty"` (default)
   * drops null/empty-string/empty-array/empty-object recursively; `"undefined"`
   * drops only undefined. Kept identical to the JWS/CWT wires.
   */
  omit?: OmitMode;
  tokenType?: TokenType;
};

export type SignedCws = {
  objectId: string | undefined;
  token: string;
};
