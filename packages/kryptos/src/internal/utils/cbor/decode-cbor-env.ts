import { KryptosError } from "../../../errors/index.js";
import type { LindormJwk } from "../../../types/index.js";
import { CBOR_ENV_KIT } from "../../constants/cbor-env-spec.js";

// Decode the kryptos CBOR env wire map back into a private LindormJwk via the shared
// `@lindorm/cbor` codec. The codec validates the format version and the enum values
// and applies the label→field mapping and value transforms.
//
// Two things are layered on top of the codec:
//   1. Failures are re-raised as a KryptosError — kryptos's public env-string import
//      throws its own domain error, never a leaked CborError or a raw TypeError (the
//      codec's non-map decode). The codec's reason is preserved in `details`.
//   2. Unknown-label REJECTION. The codec preserves any label it does not recognise
//      under its numeric key (forward compatibility); kryptos wants the opposite —
//      this format is versioned and closed, so an unrecognised label (including the
//      retired `key_ops` label 7) is an error, not something to carry into the JWK.
export const decodeCborEnv = (bytes: Uint8Array): LindormJwk => {
  let jwk: Record<string, unknown>;

  try {
    jwk = CBOR_ENV_KIT.decode(bytes) as Record<string, unknown>;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new KryptosError("The CBOR env string could not be decoded.", {
      code: "invalid_cbor_env",
      title: "Invalid CBOR Env String",
      details: reason,
      data: { reason },
    });
  }

  for (const key of Object.keys(jwk)) {
    if (/^-?\d+$/.test(key)) {
      throw new KryptosError(`Unknown CBOR label "${key}".`, {
        code: "invalid_cbor_env",
        title: "Invalid CBOR Env String",
        details: `Unknown CBOR label "${key}".`,
        data: { label: Number(key) },
      });
    }
  }

  return jwk as LindormJwk;
};
