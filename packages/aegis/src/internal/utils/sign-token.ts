import { isBuffer, isString } from "@lindorm/is";
import type { RawSignInput, SignedJws } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { applyOmit } from "./apply-omit.js";
import { rawSignCose } from "./raw-sign-cose.js";
import { rawSignJws } from "./raw-sign-jws.js";
import { selectEncoder } from "./select-encoder.js";

/**
 * The raw sign pipeline (`aegis.sign`). Encoding seam, mirroring `mintToken`:
 * the raw COSE path (`cws`) is a separate encoder that secures the payload as a
 * CBOR CWT (COSE_Sign1) instead of a JWS. Everything above is encoding-neutral.
 * A Buffer/string payload is opaque and passes through untouched; a plain object
 * is pruned of empty claims at this emission boundary (default `"empty"`) before
 * it is serialised, matching the JWT/CWT wires.
 */
export const signToken = async ({
  input,
  deps,
}: {
  input: RawSignInput;
  deps: AegisDeps;
}): Promise<SignedJws> => {
  if (selectEncoder(input.format).format === "cws") {
    return rawSignCose({ input, deps });
  }

  const payload =
    isString(input.payload) || isBuffer(input.payload)
      ? input.payload
      : JSON.stringify(applyOmit(input.payload, input.omit));

  return rawSignJws({
    data: payload,
    options: {
      bindCertificate: input.bindCertificate,
      certificateThumbprintSha1: input.certificateThumbprintSha1,
      contentType: input.contentType,
      header: input.header,
      objectId: input.objectId,
      key: input.key,
      tokenType: input.tokenType,
    },
    deps,
  });
};
