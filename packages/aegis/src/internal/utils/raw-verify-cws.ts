import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { CwsKit } from "../../classes/CwsKit.js";
import { CwtKit } from "../../classes/CwtKit.js";
import type { ParsedCws, VerifyCwsOptions } from "../../types/index.js";
import { Tag, decodeCbor } from "../cose/cbor.js";
import { COSE_TAG } from "../cose/structures.js";
import type { AegisDeps } from "./aegis-deps.js";

// A CWS frames its COSE structure in the CWT tag (61); unwrap to the inner
// COSE_Sign1 / COSE_Mac0 the opaque signer verifies.
const unwrapCwt = (value: unknown): unknown =>
  value instanceof Tag && value.tag === COSE_TAG.cwt ? value.contents : value;

/**
 * The raw CWS verify namespace (`aegis.cws.verify`) — the opaque mirror of
 * `jws.verify`: decode the kid off the COSE headers, resolve the verify key, then
 * verify the COSE_Sign1 / COSE_Mac0 integrity and return the OPAQUE payload bytes
 * under `raw`. No claim decoding — a CWS carries no claims layer.
 */
export const rawVerifyCws = async ({
  token,
  options = {},
  deps,
}: {
  token: string;
  options?: VerifyCwsOptions;
  deps: AegisDeps;
}): Promise<ParsedCws> => {
  const bytes = Buffer.from(token, "base64url");
  const decoded = CwtKit.decode(bytes);

  const kryptos = await deps.resolveVerifyKey(
    decoded.kid,
    decoded.algorithm as KryptosSigAlgorithm,
    options.key,
  );

  const cose = unwrapCwt(decodeCbor(bytes));
  const { payload } = new CwsKit({ kryptos, logger: deps.logger }).verify(cose);

  return {
    header: { alg: decoded.algorithm, kid: decoded.kid, typ: decoded.typ },
    raw: payload,
    token,
  };
};
