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
  const kryptos = await deps.resolveEncryptKey(options.key);

  const token = new CweKit({
    kryptos,
    logger: deps.logger,
    encryption: options.key?.encryption ?? deps.encryption,
  }).encrypt(data, {
    tokenType: options.tokenType,
    header: options.header,
    unprotected: options.unprotected,
    proprietary: options.proprietary,
  });

  return { format: "cwe", token: token.toString("base64url") };
};
