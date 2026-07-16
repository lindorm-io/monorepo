import { KryptosError } from "../../../errors/index.js";
import type { LindormJwk } from "../../../types/index.js";
import { CBOR_ENV_KIT } from "../../constants/cbor-env-spec.js";

// Decode the kryptos CBOR env wire map back into a private LindormJwk via the shared
// `@lindorm/cbor` codec. The codec validates the format version and the enum values
// and applies the label→field mapping and value transforms.
//
// This env format is versioned and closed, so the codec runs in its default "strict"
// mode: an unrecognised label (including the retired `key_ops` label 7) is rejected by
// the codec itself (a CborError with code "unknown_label") rather than carried into the
// JWK. Every codec failure — version/enum mismatch, non-map payload, unknown label — is
// re-raised here as a KryptosError so kryptos's public env-string import throws its own
// domain error, never a leaked CborError or a raw TypeError. The codec's reason is
// preserved in `details`.
export const decodeCborEnv = (bytes: Uint8Array): LindormJwk => {
  try {
    return CBOR_ENV_KIT.decode(bytes);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new KryptosError("The CBOR env string could not be decoded.", {
      code: "invalid_cbor_env",
      title: "Invalid CBOR Env String",
      details: reason,
      data: { reason },
    });
  }
};
