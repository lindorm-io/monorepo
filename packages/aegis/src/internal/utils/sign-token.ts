import { isBuffer, isString } from "@lindorm/is";
import type { RawSignInput, SignedToken } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { applyOmit } from "./apply-omit.js";
import { domainHeaderToWire } from "./domain-header-to-wire.js";
import { domainTokenTypePrefix } from "./compute-typ-header.js";
import { rawSignCose } from "./raw-sign-cose.js";
import { rawSignJws } from "./raw-sign-jws.js";

/**
 * THE raw sign pipeline (`aegis.sign`) — an OPAQUE signature over caller content,
 * with no claims layer and no profile.
 *
 * The format seam is one line: the payload shaping, the domain `tokenType` → bare
 * prefix translation, and the domain → wire header translation all happen once,
 * above the wire that emits the signature. A `Buffer`/`string` payload is opaque
 * and passes through untouched; a plain object is pruned of empty entries at this
 * emission boundary before it is serialised, matching the JWT/CWT wires.
 */
export const signToken = async ({
  input,
  deps,
}: {
  input: RawSignInput;
  deps: AegisDeps;
}): Promise<SignedToken> => {
  const tokenType = domainTokenTypePrefix(input.tokenType);
  const header = domainHeaderToWire(input.header);

  if (input.format === "cws") {
    return rawSignCose({
      input: {
        payload: input.payload,
        key: input.key,
        omit: input.omit,
        tokenType,
        header,
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
      header,
      key: input.key,
      tokenType,
    },
    deps,
  });
};
