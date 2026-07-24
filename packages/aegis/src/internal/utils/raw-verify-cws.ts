import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { CwsKit } from "../../classes/CwsKit.js";
import { decodeCwt } from "../cose/cwt-token.js";
import type {
  AegisVerifyKey,
  TokenContent,
  VerifiedUnstructuredToken,
  VerifyUnstructuredTokenOptions,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw CWS verify namespace (`aegis.cws.verify`) — the opaque mirror of
 * `jws.verify`: decode the kid off the COSE headers, resolve the verify key, then
 * verify the COSE_Sign1 / COSE_Mac0 integrity and return the OPAQUE payload bytes
 * under `payload` (with the native `Buffer` token). No claim decoding — a CWS
 * carries no claims layer. `CwsKit.verify` takes the ENCODED bytes and strips the
 * outer CWT tag (61) itself (R2).
 */
export const rawVerifyCws = async <T extends TokenContent = Buffer>({
  token,
  options = {},
  deps,
}: {
  token: string;
  options?: VerifyUnstructuredTokenOptions & { key?: AegisVerifyKey };
  deps: AegisDeps;
}): Promise<VerifiedUnstructuredToken<T, Buffer>> => {
  const bytes = Buffer.from(token, "base64url");
  const decoded = decodeCwt(bytes);

  const kryptos = await deps.resolveVerifyKey(
    decoded.kid,
    decoded.algorithm as KryptosSigAlgorithm,
    options.key,
  );

  return new CwsKit({ kryptos, logger: deps.logger }).verify<T>(bytes);
};
