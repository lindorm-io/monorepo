import { isBuffer, isString } from "@lindorm/is";
import type { RawSignInput, SignedToken } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { applyOmit } from "./apply-omit.js";
import { domainTokenTypePrefix } from "./compute-typ-header.js";
import { rawSignCose } from "./raw-sign-cose.js";
import { rawSignJws } from "./raw-sign-jws.js";
import { selectEncoder } from "./select-encoder.js";

/**
 * The raw sign pipeline (`aegis.sign`). Encoding seam, mirroring `mintToken`:
 * the raw COSE path (`cws`) is a separate encoder that secures the payload as a
 * CBOR CWT (COSE_Sign1) instead of a JWS. Everything above is encoding-neutral.
 * A Buffer/string payload is opaque and passes through untouched; a plain object
 * is pruned of empty claims at this emission boundary (default `"empty"`) before
 * it is serialised, matching the JWT/CWT wires. The DOMAIN `tokenType` enum is
 * translated to the bare kit PREFIX, and the caller's `contentType` folds into
 * the wire `header.cty` (ruling: contentType → header.cty, oid → header bag).
 */
export const signToken = async ({
  input,
  deps,
}: {
  input: RawSignInput;
  deps: AegisDeps;
}): Promise<SignedToken> => {
  const tokenType = domainTokenTypePrefix(input.tokenType);

  if (selectEncoder(input.format).format === "cws") {
    return rawSignCose({
      input: {
        payload: input.payload,
        key: input.key,
        omit: input.omit,
        tokenType,
        header: input.header,
      },
      deps,
    });
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
      header: input.contentType
        ? { cty: input.contentType, ...input.header }
        : input.header,
      key: input.key,
      tokenType,
    },
    deps,
  });
};
