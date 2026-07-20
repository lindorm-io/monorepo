import { isBuffer, isString } from "@lindorm/is";
import { CwsKit } from "../../classes/CwsKit.js";
import { CoseError } from "../../errors/index.js";
import type { RawSignInput, SignedJws } from "../../types/index.js";
import { Tag, encodeCbor } from "../cose/cbor.js";
import { coseTypCwsFromTokenType } from "../cose/cose-typ.js";
import { COSE_TAG } from "../cose/structures.js";
import { applyOmit } from "./apply-omit.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * Raw OPAQUE COSE sign — the profile-less sibling of the `sign` JWS path (the
 * `signToken` util). Secures an arbitrary claims map as an OPAQUE COSE_Sign1 /
 * COSE_Mac0 (a CWS), NOT a claims-bearing CWT: the map is CBOR-encoded verbatim
 * (no claim-label codec) and signed by `CwsKit`, with a `+cws` / `application/cws`
 * `typ` so the token is recognised as a CWS (`isCws`) and never as a CWT
 * (`isCwt`) — the Phase-16 emission fix. Shared between the `sign` verb (via
 * `signToken`) and the raw `cws.sign` namespace (via `rawSignCws`). The point is
 * an opaque handle: a base64url COSE blob a consumer cannot split on dots and
 * read as a JWT. The signing key is resolved exactly as the JWS path does, so a
 * per-call `key` predicate selects it (e.g. an internal, unpublished key).
 */
export const rawSignCose = async ({
  input,
  deps,
}: {
  input: RawSignInput;
  deps: AegisDeps;
}): Promise<SignedJws> => {
  // A COSE token secures a CBOR claims MAP; a pre-serialised string/Buffer has
  // no map structure to CBOR-encode. That is valid only for the JOSE path, so it
  // is a caller error here rather than a silent reinterpretation.
  if (isString(input.payload) || isBuffer(input.payload)) {
    throw new CoseError("A COSE payload must be a claims object", {
      code: "cose_payload_not_object",
      title: "COSE Payload Not An Object",
      details:
        "sign({ format: 'cws' }) secures a CBOR claims map, so its payload must be a plain object; a string or Buffer payload is only valid for the default JWS format.",
    });
  }

  const kryptos = await deps.resolveSignKey({ key: input.key });

  // OPAQUE emission: CBOR-encode the (pruned) claims map verbatim, then sign the
  // bytes with the sole opaque COSE signer. `CwsKit` picks COSE_Sign1 (asymmetric)
  // or COSE_Mac0 (symmetric) off the key class; the outer CWT tag (61) frames it.
  const payload = encodeCbor(applyOmit(input.payload, input.omit));

  const cose = new CwsKit({ kryptos, logger: deps.logger }).sign(payload, {
    typ: coseTypCwsFromTokenType(input.tokenType),
  });

  const token = encodeCbor(new Tag(COSE_TAG.cwt, cose));

  return { objectId: input.objectId, token: token.toString("base64url") };
};
