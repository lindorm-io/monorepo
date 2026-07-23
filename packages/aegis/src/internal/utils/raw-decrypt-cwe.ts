import { CweKit } from "../../classes/CweKit.js";
import type {
  AegisDecryptKey,
  DecryptedEncryptedToken,
  DecryptTokenOptions,
  TokenContent,
} from "../../types/index.js";
import { decodeEncryptedCoseKid } from "../cose/cose-encryption.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw CWE decrypt namespace (`aegis.cwe.decrypt`) — the COSE_Encrypt0 mirror
 * of `jwe.decrypt`. Resolves the recipient key by the ciphertext's own `kid`,
 * then decrypts the COSE_Encrypt0 via `CweKit` (which takes the ENCODED bytes and
 * strips the outer CWT tag itself, R2) and returns its NATIVE WIRE result
 * (`header`/`payload`/native `Buffer` `token`).
 */
export const rawDecryptCwe = async <T extends TokenContent = Buffer>({
  token,
  options = {},
  deps,
}: {
  token: string;
  options?: DecryptTokenOptions & { key?: AegisDecryptKey };
  deps: AegisDeps;
}): Promise<DecryptedEncryptedToken<T, Buffer>> => {
  const bytes = Buffer.from(token, "base64url");

  const kryptos = await deps.resolveDecryptKey(
    decodeEncryptedCoseKid(bytes),
    undefined,
    options.key,
  );

  return new CweKit({ kryptos, logger: deps.logger }).decrypt<T>(bytes);
};
