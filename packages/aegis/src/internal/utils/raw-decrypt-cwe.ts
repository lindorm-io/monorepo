import type { CweDecryptOptions, DecryptedCwe } from "../../types/index.js";
import { decodeEncryptedCoseKid, decryptCose } from "../cose/cose-encryption.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw CWE decrypt namespace (`aegis.cwe.decrypt`) — the COSE_Encrypt0 mirror
 * of `jwe.decrypt`. Resolves the recipient key by the ciphertext's own `kid`,
 * then decrypts the COSE_Encrypt0.
 */
export const rawDecryptCwe = async ({
  token,
  options = {},
  deps,
}: {
  token: string;
  options?: CweDecryptOptions;
  deps: AegisDeps;
}): Promise<DecryptedCwe> => {
  const bytes = Buffer.from(token, "base64url");

  const kryptos = await deps.resolveDecryptKey(
    decodeEncryptedCoseKid(bytes),
    undefined,
    options.key,
  );

  return {
    payload: decryptCose({ kryptos, logger: deps.logger, token: bytes }),
    token,
  };
};
