import { isObject, isString } from "@lindorm/is";
import { AesError } from "../errors";
import {
  AesDecryptionRecord,
  ParsedAesDecryptionRecord,
  SerialisedAesDecryption,
} from "../types";
import { isAesBufferData, isAesSerialisedData, isAesTokenised } from "./is-aes";
import { parseEncodedAesString } from "../internal/utils/encoded-aes";
import { parseSerialisedAesRecord } from "../internal/utils/serialised-aes";
import { parseTokenisedAesString } from "../internal/utils/tokenised-aes";

type ParseAes = {
  (data: string): ParsedAesDecryptionRecord;
  (data: SerialisedAesDecryption): ParsedAesDecryptionRecord;
  (data: AesDecryptionRecord): AesDecryptionRecord;
  (data: AesDecryptionRecord | SerialisedAesDecryption | string): AesDecryptionRecord;
};

export const parseAes: ParseAes = (
  data: AesDecryptionRecord | SerialisedAesDecryption | string,
): any => {
  if (isString(data) && isAesTokenised(data)) {
    return parseTokenisedAesString(data);
  }

  if (isString(data) && !isAesTokenised(data)) {
    return parseEncodedAesString(data);
  }

  if (isObject(data) && isAesBufferData(data)) {
    return data;
  }

  if (isObject(data) && isAesSerialisedData(data)) {
    return parseSerialisedAesRecord(data);
  }

  throw new AesError("Invalid AES data");
};
