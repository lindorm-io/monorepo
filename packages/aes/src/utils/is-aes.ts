import { isBuffer, isString } from "@lindorm/is";
import type { AesDecryptionRecord, SerialisedAesDecryption } from "../types/index.js";

export const isAesBufferData = (
  data: AesDecryptionRecord | SerialisedAesDecryption,
): data is AesDecryptionRecord => Object.values(data).some((x) => isBuffer(x));

export const isAesSerialisedData = (
  options: AesDecryptionRecord | SerialisedAesDecryption,
): options is SerialisedAesDecryption =>
  Object.values(options).every((x) => !isBuffer(x));

export const isAesTokenised = (string: string): boolean =>
  isString(string) && string.startsWith("aes:");
