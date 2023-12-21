import { AesError } from "../../errors";
import { AesEncryptionData } from "../../types";
import { mapStringToAesFormat, mapStringToEncryptionKeyAlgorithm } from "./mappers";
import { mapStringToAesAlgorithm } from "./mappers/algorithm-mapper";

const regex = /(?<key>[a-z]+)=(?<value>.+)/g;

export const decodeAesString = (data: string): AesEncryptionData => {
  const [_, alg, array, content] = data.split("$");

  const algorithm = mapStringToAesAlgorithm(alg);
  const items = array.split(",");
  const values: Record<string, string> = {};

  for (const item of items) {
    const match = new RegExp(regex).exec(item);

    if (!match?.groups?.key || !match?.groups?.value) {
      throw new AesError("Invalid AES cipher string", {
        description: "Invalid key/value pair",
        debug: { item },
      });
    }

    values[match.groups.key] = match.groups.value;
  }

  const { cek, eka, f, iv, kid, tag, v } = values;
  const format = mapStringToAesFormat(f);

  return {
    algorithm,
    authTag: tag ? Buffer.from(tag, format) : undefined,
    content: Buffer.from(content, format),
    encryptionKeyAlgorithm: eka ? mapStringToEncryptionKeyAlgorithm(eka) : undefined,
    format,
    initialisationVector: Buffer.from(iv, format),
    keyId: kid ? Buffer.from(kid, format) : undefined,
    publicEncryptionKey: cek ? Buffer.from(cek, format) : undefined,
    version: parseInt(v, 10),
  };
};
