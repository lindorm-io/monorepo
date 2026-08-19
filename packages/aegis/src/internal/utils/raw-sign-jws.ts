import { isObject } from "@lindorm/is";
import { JwsKit } from "../../classes/JwsKit.js";
import type {
  AegisSignKey,
  SignedToken,
  SignUnstructuredTokenOptions,
  TokenContent,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { joseName } from "../claims/claims-registry.js";
import { buildSignedToken } from "./build-signed-token.js";
import { normaliseClaims } from "./normalise-claims.js";

/**
 * The raw JWS sign namespace (`aegis.jws.sign`): resolve the signing key and sign
 * the opaque payload as a JWS via the transform-free `JwsKit` (which returns the
 * BARE compact token), then enrich the token with the Aegis-level `SignedToken`
 * sugar. A JWS carries no claims, so the expiry/`tokenId` sugar is `undefined`;
 * only `objectId` (from the `header` bag) is carried.
 *
 * ⚠ A PLAIN DATA BAG passes the emission-boundary normalisation
 * (`normalise-claims.ts`) — `undefined` and the empty value of a claim the
 * REGISTRY declares carries nothing when empty. Every other `TokenContent` member
 * is untouched: a `string`, a `Buffer`, a `number`, a `boolean` and an `Array`
 * are opaque, and the normalisation is written for claim dicts — it throws a raw
 * `TypeError` on a scalar and rebuilds an array into `{"0":…}`.
 *
 * The COSE twin does the identical thing (`raw-sign-cose.ts`), and the two
 * agreeing is the contract `sign-content-round-trip.test.ts` states: without it
 * `{ nonce: "" }` reaches a JWS and is pruned from a CWS, so the same call emits
 * two different payloads depending on the wire.
 */
export const rawSignJws = async ({
  data,
  options = {},
  deps,
}: {
  data: TokenContent;
  options?: SignUnstructuredTokenOptions & { key?: AegisSignKey };
  deps: AegisDeps;
}): Promise<SignedToken> => {
  const { key, ...rest } = options;

  const kryptos = await deps.resolveSignKey({ key });

  const token = new JwsKit({
    certBindingMode: deps.certBindingMode,
    kryptos,
    logger: deps.logger,
    // The SAME expression the COSE twin uses (`raw-sign-cose.ts`). Spelled
    // identically on purpose: the two namespaces agreeing is the contract, so a
    // local improvement to one of them is a change to both or to neither.
  }).sign(isObject(data) ? normaliseClaims(data) : data, rest);

  return buildSignedToken(token, {}, options.header?.oid, "jws", joseName);
};
