import { isBuffer } from "@lindorm/is";
import type { CweContent, CweEncryptOptions, EncryptedCwe } from "../../types/index.js";
import { encryptCose } from "../cose/cose-encryption.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw CWE encrypt namespace (`aegis.cwe.encrypt`) — the COSE_Encrypt0 mirror
 * of `jwe.encrypt`. Resolves the recipient key exactly as the JWE path does;
 * COSE_Encrypt0 is direct AEAD, so the key is a symmetric enc key (no wrapping).
 */
export const rawEncryptCwe = async ({
  data,
  options = {},
  deps,
}: {
  data: CweContent;
  options?: CweEncryptOptions;
  deps: AegisDeps;
}): Promise<EncryptedCwe> => {
  const kryptos = await deps.resolveEncryptKey(options.key);

  const inner = isBuffer(data) ? data : Buffer.from(data, "utf8");
  const token = encryptCose({
    kryptos,
    logger: deps.logger,
    inner,
    typ: options.typ,
    encryption: options.key?.encryption ?? deps.encryption,
    proprietary: options.proprietary,
  });

  return { token: token.toString("base64url") };
};
