import { isObject, isString } from "@lindorm/is";
import { AesError } from "../errors/index.js";
import type {
  AesDecryptionRecord,
  ParsedAesDecryptionRecord,
  SerialisedAesDecryption,
} from "../types/index.js";
import { isAesBufferData, isAesSerialisedData, isAesString } from "./is-aes.js";
import { parseCborAesString } from "../internal/utils/cbor-aes.js";
import { parseSerialisedAesRecord } from "../internal/utils/serialised-aes.js";

type ParseAes = {
  (data: string): ParsedAesDecryptionRecord;
  (data: SerialisedAesDecryption): ParsedAesDecryptionRecord;
  (data: AesDecryptionRecord): AesDecryptionRecord;
  (data: AesDecryptionRecord | SerialisedAesDecryption | string): AesDecryptionRecord;
};

export const parseAes: ParseAes = (
  data: AesDecryptionRecord | SerialisedAesDecryption | string,
): any => {
  if (isString(data) && isAesString(data)) {
    return parseCborAesString(data);
  }

  if (isObject(data) && isAesBufferData(data)) {
    return data;
  }

  if (isObject(data) && isAesSerialisedData(data)) {
    return parseSerialisedAesRecord(data);
  }

  throw new AesError("Invalid AES data", {
    code: "invalid_aes_data",
    title: "Invalid AES Data",
    details:
      "The input could not be recognised as an 'aes:' CBOR string, a decryption record, or a serialised AES record.",
  });
};
