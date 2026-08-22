import { isObject } from "@lindorm/is";
import { CwsKit } from "../../classes/CwsKit.js";
import type {
  AegisSignKey,
  SignedToken,
  CoseSignUnstructuredTokenOptions,
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
 * resolved key policy, intersected with the kit's `CoseSignUnstructuredTokenOptions`
 * wire envelope (`tokenType` PREFIX, the `header` and `custom` bags, `proprietary`).
 * The envelope is forwarded STRUCTURALLY to `CwsKit.sign`, so a new kit sign
 * option threads through unchanged (`oid` rides the `header` bag). The DOMAIN
 * `aegis.sign` path translates its `tokenType` enum to a prefix; the
 * `aegis.cws.sign` namespace hands the envelope straight through.
 */
export type RawSignCoseInput = {
  payload: TokenContent;
  key?: AegisSignKey;
} & CoseSignUnstructuredTokenOptions;

/**
 * Raw OPAQUE COSE sign — the COSE sibling of `rawSignJws`. Secures arbitrary
 * content as an OPAQUE COSE_Sign1 / COSE_Mac0 (a CWS), never a claims-bearing CWT:
 * `CwsKit` serialises through the shared cty codec (Dict→json, string→text,
 * Buffer→octet), and there is no claim-label codec here. It stamps a `+cws` /
 * `application/cws` `typ` so the token reads as a CWS (`isCws`), never a CWT.
 *
 * Reached ONLY through `COSE_TOKEN_WIRE.signOpaque`, so every caller has already
 * been checked against `COSE_DISPOSITIONS.signOpaque` and an option that table
 * declares `unsupported` never arrives here.
 */
export const rawSignCose = async ({
  input,
  deps,
}: {
  input: RawSignCoseInput;
  deps: AegisDeps;
}): Promise<SignedToken> => {
  // `payload`/`key` are the aegis-side concerns; `signOptions` is exactly the
  // kit's `CoseSignUnstructuredTokenOptions` and is forwarded STRUCTURALLY to
  // `CwsKit.sign`, so a new kit sign option (e.g. `proprietary`/`custom`)
  // threads through with no change here.
  const { payload, key, ...signOptions } = input;

  const kryptos = await deps.resolveSignKey({ key });

  // Opaque content: an object payload is normalised exactly as the sign/mint
  // wires normalise theirs; a string/Buffer is opaque and passes through
  // untouched. `CwsKit.sign` owns the cty codec + COSE_Sign1/Mac0 split off the
  // key class; the outer CWT tag (61) frames it.
  // ⚠ NORMALISE ONLY A PLAIN DATA BAG. `TokenContent` also admits `number`,
  // `boolean` and `Array`, and the normalisation is written for claim dicts:
  // `omitUndefined` THROWS a raw `TypeError` on a scalar, and `pruneEmptyClaims`
  // rebuilds through `Object.entries`, so an array comes back `{"0":…}`. Neither
  // is a claim shape, so neither is the normalisation's business.
  // `isObject` decides by PROTOTYPE, which is what excludes a Buffer (and a Map,
  // a Date, a class instance) without naming any of them.
  const content = isObject(payload) ? normaliseClaims(payload) : payload;

  const cose = new CwsKit({
    certBindingMode: deps.certBindingMode,
    kryptos,
    logger: deps.logger,
  }).sign(content, signOptions);

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
