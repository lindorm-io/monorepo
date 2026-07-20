import { isBuffer, isString } from "@lindorm/is";
import { CoseError } from "../../errors/index.js";
import type { RawSignInput, SignedJws } from "../../types/index.js";
import { coseTypFromTokenType } from "../cose/cose-typ.js";
import { signCose } from "../cose/sign-cose.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * Raw COSE sign — the profile-less sibling of the `sign` JWS path (the
 * `signToken` util). Secures an arbitrary CBOR claims map as a COSE_Sign1 CWT
 * (the same encoder `mintCoseToken` uses), typ derived straight from the bare
 * `tokenType`. Shared between the `sign` verb (via `signToken`) and the raw
 * `cws.sign` namespace (via `rawSignCws`). The point is an opaque handle: a
 * base64url CBOR blob a consumer cannot split on dots and read as a JWT. The
 * signing key is resolved exactly as the JWS path does, so a per-call `key`
 * predicate selects it (e.g. an internal, unpublished key).
 */
export const rawSignCose = async ({
  input,
  deps,
}: {
  input: RawSignInput;
  deps: AegisDeps;
}): Promise<SignedJws> => {
  // A COSE token secures a CBOR claims MAP; a pre-serialised string/Buffer has
  // no CWT structure to secure. That is valid only for the JOSE path, so it is
  // a caller error here rather than a silent reinterpretation.
  if (isString(input.payload) || isBuffer(input.payload)) {
    throw new CoseError("A COSE payload must be a claims object", {
      code: "cose_payload_not_object",
      title: "COSE Payload Not An Object",
      details:
        "sign({ format: 'cose' }) secures a CBOR claims map, so its payload must be a plain object; a string or Buffer payload is only valid for the default JWS format.",
    });
  }

  const kryptos = await deps.resolveSignKey({ key: input.key });

  const token = signCose({
    kryptos,
    logger: deps.logger,
    common: input.payload,
    typ: coseTypFromTokenType(input.tokenType),
    omit: input.omit,
  });

  return { objectId: input.objectId, token: token.toString("base64url") };
};
