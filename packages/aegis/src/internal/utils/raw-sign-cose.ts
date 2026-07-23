import { isBuffer, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { CwsKit } from "../../classes/CwsKit.js";
import type {
  AegisSignKey,
  SignedToken,
  TokenContent,
  WireProtectedHeader,
} from "../../types/index.js";
import { Tag, decodeCbor, encodeCbor } from "../cose/cbor.js";
import { COSE_TAG } from "../cose/structures.js";
import type { OmitMode } from "./apply-omit.js";
import { applyOmit } from "./apply-omit.js";
import { buildSignedCwt } from "./cwt-payload.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The wire-tier input to the raw opaque COSE signer — the content, the resolved
 * key policy, the empty-claim prune mode (applied to an object payload only), the
 * bare `tokenType` PREFIX (the DOMAIN `aegis.sign` path translates its enum to a
 * prefix; the `aegis.cws.sign` namespace hands one directly), and the wire header
 * bag (`oid` rides here).
 */
export type RawSignCoseInput = {
  payload: TokenContent;
  key?: AegisSignKey;
  omit?: OmitMode;
  tokenType?: string;
  header?: WireProtectedHeader;
};

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
  const kryptos = await deps.resolveSignKey({ key: input.key });

  // Opaque content: an object payload is pruned of empty entries when an omit
  // mode is set (matching the sign/mint wires); a string/Buffer is opaque and
  // passes through untouched. `CwsKit.sign` owns the cty codec + COSE_Sign1/Mac0
  // split off the key class; the outer CWT tag (61) frames it.
  const content =
    isBuffer(input.payload) || isString(input.payload)
      ? input.payload
      : applyOmit(input.payload as Dict, input.omit);

  const cose = new CwsKit({ kryptos, logger: deps.logger }).sign(content, {
    tokenType: input.tokenType,
    header: input.header,
  });

  // `CwsKit.sign` returns the BARE encoded COSE bytes; decode back to frame the
  // structure in the outer CWT tag (61).
  const token = encodeCbor(new Tag(COSE_TAG.cwt, decodeCbor(cose)));

  // A CWS secures OPAQUE content (no wire-claim interpretation), so the
  // expiry/`tokenId` sugar is `undefined`; only `objectId` (from the header bag)
  // is carried.
  return buildSignedCwt(token.toString("base64url"), {}, input.header?.oid, "cws");
};
