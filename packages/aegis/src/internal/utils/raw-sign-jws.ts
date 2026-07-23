import { JwsKit } from "../../classes/JwsKit.js";
import type {
  AegisSignKey,
  SignedJwt,
  SignUnstructuredTokenOptions,
  TokenContent,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { buildSignedJwt } from "./jwt-payload.js";

/**
 * The raw JWS sign namespace (`aegis.jws.sign`): resolve the signing key and sign
 * the opaque payload as a JWS via the transform-free `JwsKit` (which returns the
 * BARE compact token), then enrich the token with the Aegis-level `SignedJwt`
 * sugar. A JWS carries no claims, so the expiry/`tokenId` sugar is `undefined`;
 * only `objectId` (from the `header` bag) is carried.
 */
export const rawSignJws = async ({
  data,
  options = {},
  deps,
}: {
  data: TokenContent;
  options?: SignUnstructuredTokenOptions & { key?: AegisSignKey };
  deps: AegisDeps;
}): Promise<SignedJwt> => {
  const { key, certificateThumbprintSha1, ...rest } = options;

  const kryptos = await deps.resolveSignKey({ key });

  const token = new JwsKit({
    certBindingMode: deps.certBindingMode,
    kryptos,
    logger: deps.logger,
  }).sign(data, {
    ...rest,
    certificateThumbprintSha1:
      certificateThumbprintSha1 ?? deps.certificateThumbprintSha1,
  });

  return buildSignedJwt(token, {}, options.header?.oid);
};
