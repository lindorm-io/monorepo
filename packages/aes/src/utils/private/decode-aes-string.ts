import { EcCurve } from "@lindorm/kryptos";
import { AesError } from "../../errors";
import {
  AesEncryptionData,
  BufferFormat,
  Encryption,
  EncryptionKeyAlgorithm,
  IntegrityHash,
} from "../../types";

const regex = /(?<key>[a-z]+)=(?<value>.+)/g;

export const _decodeAesString = (data: string): AesEncryptionData => {
  const [_, alg, array, content] = data.split("$");

  const algorithm = alg as Encryption;
  const items = array.split(",");
  const values: Record<string, string> = {};

  for (const item of items) {
    const match = new RegExp(regex).exec(item);

    if (!match?.groups?.key || !match?.groups?.value) {
      throw new AesError("Invalid AES cipher string", {
        debug: { item },
      });
    }

    values[match.groups.key] = match.groups.value;
  }

  const { cek, crv: curve, eka, f, ih, iv, kid, tag, v, x, y, kty: keyType } = values;
  const crv = curve as EcCurve;
  const format = f as BufferFormat;
  const kty = keyType as "EC";

  return {
    encryption: algorithm,
    authTag: tag ? Buffer.from(tag, format) : undefined,
    content: Buffer.from(content, format),
    encryptionKeyAlgorithm: eka as EncryptionKeyAlgorithm,
    format,
    integrityHash: ih as IntegrityHash,
    initialisationVector: Buffer.from(iv, format),
    keyId: kid ? Buffer.from(kid, format) : undefined,
    publicEncryptionJwk: crv && x && y && kty ? { crv, x, y, kty } : undefined,
    publicEncryptionKey: cek ? Buffer.from(cek, format) : undefined,
    version: parseInt(v, 10),
  };
};
