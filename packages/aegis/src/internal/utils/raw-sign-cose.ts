import { isBuffer, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { CwsKit } from "../../classes/CwsKit.js";
import type {
  AegisSignKey,
  SignedToken,
  SignUnstructuredTokenOptions,
  TokenContent,
} from "../../types/index.js";
import { Tag, decodeCbor, encodeCbor } from "../cose/cbor.js";
import { COSE_TAG } from "../cose/structures.js";
import { normaliseClaims } from "./normalise-claims.js";
import { coseName } from "../claims/claims-registry.js";
import { buildSignedToken } from "./build-signed-token.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The wire-tier input to the raw opaque COSE signer — the content and the
 * resolved key policy, intersected with the kit's `SignUnstructuredTokenOptions`
 * wire envelope (`tokenType` PREFIX, `header`/`unprotected` bags, `proprietary`).
 * The envelope is forwarded STRUCTURALLY to `CwsKit.sign`, so a new kit sign
 * option threads through unchanged (`oid` rides the `header` bag). The DOMAIN
 * `aegis.sign` path translates its `tokenType` enum to a prefix; the
 * `aegis.cws.sign` namespace hands the envelope straight through.
 */
export type RawSignCoseInput = {
  payload: TokenContent;
  key?: AegisSignKey;
} & SignUnstructuredTokenOptions;

/**
 * Raw OPAQUE COSE sign — the profile-less sibling of the `sign` JWS path (the
 * `signToken` util). Secures arbitrary content as an OPAQUE COSE_Sign1 /
 * COSE_Mac0 (a CWS), NOT a claims-bearing CWT: COSE_Sign1 signs a `bstr`, so
 * `CwsKit` serialises the content through the shared cty codec (Dict→json,
 * string→text, Buffer→octet) and round-trips it faithfully — there is no
 * claim-label codec here (a claims-bearing COSE_Sign1 is `aegis.cwt.sign`). It
 * stamps a `+cws` / `application/cws` `typ` so the token reads as a CWS
 * (`isCws`) and never as a CWT (`isCwt`). Shared between the `sign` verb (via
 * `signToken`) and the raw `cws.sign` namespace (via `rawSignCws`). The signing
 * key is resolved exactly as the JWS path does.
 */
export const rawSignCose = async ({
  input,
  deps,
}: {
  input: RawSignCoseInput;
  deps: AegisDeps;
}): Promise<SignedToken> => {
  // `payload`/`key` are the aegis-side concerns; `signOptions` is exactly the
  // kit's `SignUnstructuredTokenOptions` and is forwarded STRUCTURALLY to
  // `CwsKit.sign`, so a new kit sign option (e.g. `proprietary`/`unprotected`)
  // threads through with no change here.
  const { payload, key, ...signOptions } = input;

  const kryptos = await deps.resolveSignKey({ key });

  // Opaque content: an object payload is normalised exactly as the sign/mint
  // wires normalise theirs; a string/Buffer is opaque and passes through
  // untouched. `CwsKit.sign` owns the cty codec + COSE_Sign1/Mac0 split off the
  // key class; the outer CWT tag (61) frames it.
  const content =
    isBuffer(payload) || isString(payload) ? payload : normaliseClaims(payload as Dict);

  const cose = new CwsKit({ kryptos, logger: deps.logger }).sign(content, signOptions);

  // `CwsKit.sign` returns the BARE encoded COSE bytes; decode back to frame the
  // structure in the outer CWT tag (61).
  const token = encodeCbor(new Tag(COSE_TAG.cwt, decodeCbor(cose)));

  // A CWS secures OPAQUE content (no wire-claim interpretation), so the
  // expiry/`tokenId` sugar is `undefined`; only `objectId` (from the header bag)
  // is carried.
  return buildSignedToken(
    token.toString("base64url"),
    {},
    signOptions.header?.oid,
    "cws",
    coseName,
  );
};
