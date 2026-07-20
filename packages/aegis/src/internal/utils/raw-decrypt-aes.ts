import {
  type AesContent,
  type AesDecryptionRecord,
  AesKit,
  type SerialisedAesDecryption,
} from "@lindorm/aes";
import type { KryptosEncAlgorithm } from "@lindorm/kryptos";
import type { AesDecryptOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw AES decrypt namespace (`aegis.aes.decrypt`). The ciphertext names its
 * own key, so `findById` — deliberately unfiltered — still decrypts what an
 * expired or since-internalised key sealed. A key the vault never held is the one
 * case that lookup cannot serve, so an injected `kryptos` short-circuits it; the
 * floor still applies, and a supplied key naming a different kid than the
 * ciphertext throws (`resolveKey`).
 */
export const rawDecryptAes = async <T extends AesContent = string>({
  data,
  options,
  deps,
}: {
  data: AesDecryptionRecord | SerialisedAesDecryption | string;
  options?: AesDecryptOptions;
  deps: AegisDeps;
}): Promise<T> => {
  const parsed = AesKit.parse(data);

  const kryptos = await deps.resolveDecryptKey(
    parsed.keyId,
    parsed.algorithm as KryptosEncAlgorithm | undefined,
    options?.key,
  );
  const kit = new AesKit({ encryption: deps.encryption, kryptos });

  return kit.decrypt<T>(data);
};
