import {
  type AesContent,
  type AesEncryptionRecord,
  AesKit,
  type SerialisedAesEncryption,
} from "@lindorm/aes";
import { isString } from "@lindorm/is";
import type { AesEncryptOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw AES encrypt namespace (`aegis.aes.encrypt`). The AES path resolves its
 * key exactly like JWE / COSE do — same resolver, same floor, same
 * deployment-⊕-per-call selector merge — so a per-call `key` selects the right
 * enc key (e.g. an internal `dir` cookie key) instead of the deployment-wide
 * published token key. The 2nd arg is EITHER the output mode (a string) OR the
 * options object; when it is a string the 3rd arg carries the options.
 */
export const rawEncryptAes = async ({
  data,
  modeOrOptions,
  maybeOptions,
  deps,
}: {
  data: AesContent;
  modeOrOptions?: "cbor" | "record" | "serialised" | AesEncryptOptions;
  maybeOptions?: AesEncryptOptions;
  deps: AegisDeps;
}): Promise<string | AesEncryptionRecord | SerialisedAesEncryption> => {
  const mode = isString(modeOrOptions) ? modeOrOptions : "cbor";
  const options = isString(modeOrOptions) ? maybeOptions : modeOrOptions;

  const kryptos = await deps.resolveEncryptKey(options?.key);
  const kit = new AesKit({
    encryption: options?.key?.encryption ?? deps.encryption,
    kryptos,
  });

  return kit.encrypt(data, mode as "cbor");
};
