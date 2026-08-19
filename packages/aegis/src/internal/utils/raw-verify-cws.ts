import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { CwsKit } from "../../classes/CwsKit.js";
import { decodeCwt } from "../cose/decode-cwt.js";
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
  // `key` is the aegis-only external-key injection (it resolves the kryptos);
  // every other field IS the kit's VerifyUnstructuredTokenOptions and is
  // forwarded structurally, so a new verify option threads through with no change
  // here — the same shape `rawVerifyCwt` uses.
  const { key, ...verifyOptions } = options;

  const bytes = Buffer.from(token, "base64url");
  const decoded = decodeCwt(bytes);

  // UNSCOPED by construction — the COSE twin of the JWS case: a CWS is opaque,
  // its payload arbitrary bytes with no claims layer, so there is no `iss` to
  // narrow by. (`decoded.payload` is `undefined` here for exactly that reason.)
  // Not an oversight; see the unscoped-paths note in `resolve-key.ts`.
  const kryptos = await deps.resolveVerifyKey({
    id: decoded.kid,
    algorithm: decoded.algorithm as KryptosSigAlgorithm,
    verify: key,
  });

  return new CwsKit({
    certBindingMode: deps.certBindingMode,
    kryptos,
    logger: deps.logger,
  }).verify<T>(bytes, verifyOptions);
};
