import type { LindormJwk } from "../../../types/index.js";
import { CBOR_ENV_KIT } from "../../constants/cbor-env-spec.js";

// Encode a private LindormJwk into the kryptos CBOR env wire map via the shared
// `@lindorm/cbor` codec: integer labels, enum ints, byte strings for material.
// Deterministic (cbor2 CDE) for stable, byte-identical output.
//
// `key_ops` (label 7) is NEVER encoded — `operations` is derived from the key
// material on import, so there is nothing to carry, and the spec omits the label.
export const encodeCborEnv = (jwk: LindormJwk): Uint8Array => CBOR_ENV_KIT.encode(jwk);
