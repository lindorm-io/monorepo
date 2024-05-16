import { KryptosCurve } from "@lindorm/kryptos";
import { BufferFormat, ShaAlgorithm } from "@lindorm/types";
import { AesError } from "../../errors";
import {
  AesEncryption,
  AesEncryptionData,
  AesEncryptionKeyAlgorithm,
  AesStringValues,
} from "../../types";

const regex = /(?<key>[a-z]+)=(?<value>.+)/g;

export const _decodeAesString = (data: string): AesEncryptionData => {
  const [_, alg, array, content] = data.split("$");

  const algorithm = alg as AesEncryption;
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

  const {
    v,
    f,
    cek,
    crv: curve,
    eka,
    ih,
    it,
    iv,
    kid,
    kty: keyType,
    s,
    tag,
    x,
    y,
  } = values as unknown as AesStringValues;

  const crv = curve as KryptosCurve;
  const format = f as BufferFormat;
  const kty = keyType as "EC";

  return {
    version: parseInt(v, 10),
    format,
    authTag: tag ? Buffer.from(tag, format) : undefined,
    content: Buffer.from(content, format),
    encryption: algorithm,
    encryptionKeyAlgorithm: eka as AesEncryptionKeyAlgorithm,
    initialisationVector: Buffer.from(iv, format),
    integrityHash: ih as ShaAlgorithm,
    iterations: it ? parseInt(it, 10) : undefined,
    keyId: kid ? Buffer.from(kid, format) : undefined,
    publicEncryptionJwk: crv && x && kty ? { crv, x, y, kty } : undefined,
    publicEncryptionKey: cek ? Buffer.from(cek, format) : undefined,
    salt: s ? Buffer.from(s, format) : undefined,
  };
};
