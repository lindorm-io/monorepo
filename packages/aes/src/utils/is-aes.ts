import { isBuffer } from "@lindorm/is";
import { AesDecryptionRecord, SerialisedAesDecryption } from "../types";

export const isAesBufferData = (
  data: AesDecryptionRecord | SerialisedAesDecryption,
): data is AesDecryptionRecord => Object.values(data).some((x) => isBuffer(x));

export const isAesSerialisedData = (
  options: AesDecryptionRecord | SerialisedAesDecryption,
): options is SerialisedAesDecryption =>
  Object.values(options).every((x) => !isBuffer(x));

export const isAesTokenised = (string: string): boolean =>
  string.startsWith("$") &&
  string.endsWith("$") &&
  string.includes("v=") &&
  string.includes("alg=");
