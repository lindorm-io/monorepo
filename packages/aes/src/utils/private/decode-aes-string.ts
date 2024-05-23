import { KryptosAlgorithm, KryptosCurve, KryptosEncryption } from "@lindorm/kryptos";
import { B64U } from "../../constants/private/format";
import { AesError } from "../../errors";
import { AesEncryptionData } from "../../types";
import { AesStringValues } from "../../types/private";

const regex = /(?<key>[a-z0-9]+)=(?<value>.+)/g;

export const decodeAesString = (data: string): AesEncryptionData => {
  const [_, enc, array, content] = data.split("$");

  const encryption = enc as KryptosEncryption;
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
    kid,

    // Required
    alg,
    iv,
    tag,

    // Key Derivation
    hks,
    p2c,
    p2s,

    // Public Encryption Key
    pei,
    pek,
    pet,

    // Public JWK
    crv: curve,
    kty: keyType,
    x,
    y,
  } = values as unknown as AesStringValues;

  const crv = curve as KryptosCurve;
  const kty = keyType as "EC" | "OKP";

  return {
    authTag: Buffer.from(tag, B64U),
    content: Buffer.from(content, B64U),
    encryption: encryption,
    algorithm: alg as KryptosAlgorithm,
    hkdfSalt: hks ? Buffer.from(hks, B64U) : undefined,
    initialisationVector: Buffer.from(iv, B64U),
    keyId: Buffer.from(kid, B64U),
    pbkdfIterations: p2c ? parseInt(p2c, 10) : undefined,
    pbkdfSalt: p2s ? Buffer.from(p2s, B64U) : undefined,
    publicEncryptionJwk: crv && x && kty ? { crv, x, y, kty } : undefined,
    publicEncryptionIv: pei ? Buffer.from(pei, B64U) : undefined,
    publicEncryptionKey: pek ? Buffer.from(pek, B64U) : undefined,
    publicEncryptionTag: pet ? Buffer.from(pet, B64U) : undefined,
    version: parseInt(v, 10),
  };
};
