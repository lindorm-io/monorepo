import { CweKit } from "../../classes/CweKit.js";
import type {
  AegisEncKey,
  CweEncryptOptions,
  EncryptedToken,
  TokenContent,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw CWE encrypt namespace (`aegis.cwe.encrypt`) — the COSE_Encrypt0 mirror
 * of `jwe.encrypt`. Resolves the recipient key exactly as the JWE path does;
 * COSE_Encrypt0 is direct AEAD, so the key is a symmetric enc key (no wrapping).
 * The content is handed straight to `CweKit`, which negotiates the cty (Dict→json,
 * string→text, Buffer→octet) so a `decrypt` round-trips the JS type. `tokenType`
 * is already the bare kit PREFIX; the kit builds `application/<…>+cwe`.
 */
export const rawEncryptCwe = async ({
  data,
  options = {},
  deps,
}: {
  data: TokenContent;
  options?: CweEncryptOptions & { key?: AegisEncKey };
  deps: AegisDeps;
}): Promise<EncryptedToken> => {
  // `key` is the aegis-only recipient-key selector (resolves the kryptos and
  // feeds the kit's `encryption`); every other field IS the kit's
  // `CweEncryptOptions` and is forwarded structurally, so a new encrypt option
  // threads through with no change here.
  const { key, ...rest } = options;

  const kryptos = await deps.resolveEncryptKey(key);

  const token = new CweKit({
    kryptos,
    logger: deps.logger,
    encryption: key?.encryption ?? deps.encryption,
  }).encrypt(data, rest);

  return { format: "cwe", token: token.toString("base64url") };
};
