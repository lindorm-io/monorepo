import { isObject, isString } from "@lindorm/is";
import { AesError } from "../errors";
import { AesDecryptionRecord, SerialisedAesDecryption } from "../types";
import { isAesBufferData, isAesSerialisedData, isAesTokenised } from "./is-aes";
import {
  parseEncodedAesString,
  parseSerialisedAesRecord,
  parseTokenisedAesString,
} from "./private";

export const parseAes = (
  data: AesDecryptionRecord | SerialisedAesDecryption | string,
): AesDecryptionRecord => {
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
