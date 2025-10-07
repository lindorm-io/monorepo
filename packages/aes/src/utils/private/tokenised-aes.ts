import { KryptosCurve, KryptosEncryption } from "@lindorm/kryptos";
import { Dict } from "@lindorm/types";
import { removeEmpty } from "@lindorm/utils";
import { B64U } from "../../constants/private";
import { AesError } from "../../errors";
import { AesEncryptionRecord } from "../../types";
import { AesStringValues } from "../../types/private";

const regex = /(?<key>[a-z0-9]+)=(?<value>.+)/g;

export const createTokenisedAesString = ({
  algorithm,
  authTag,
  content,
  contentType,
  encryption,
  hkdfSalt,
  initialisationVector,
  keyId,
  pbkdfIterations,
  pbkdfSalt,
  publicEncryptionIv,
  publicEncryptionJwk,
  publicEncryptionKey,
  publicEncryptionTag,
  version,
}: AesEncryptionRecord): string => {
  const values: AesStringValues = removeEmpty({
    v: version.toString(),
    kid: keyId,

    // Required
    alg: algorithm,
    cty: contentType,
    iv: initialisationVector.toString(B64U),
    tag: authTag.toString(B64U),

    // Key Derivation
    hks: hkdfSalt?.toString(B64U),
    p2c: pbkdfIterations?.toString(),
    p2s: pbkdfSalt?.toString(B64U),

    // Public Encryption Key
    pei: publicEncryptionIv?.toString(B64U),
    pek: publicEncryptionKey?.toString(B64U),
    pet: publicEncryptionTag?.toString(B64U),

    // Public JWK
    crv: publicEncryptionJwk?.crv,
    kty: publicEncryptionJwk?.kty,
    x: publicEncryptionJwk?.x,
    y: publicEncryptionJwk?.y,
  });
  const array = Object.entries(values).map(([key, value]) => `${key}=${value}`);

  const str = array.join(",");
  const cnt = content.toString(B64U);

  return `$${encryption}$${str}$${cnt}$`;
};

export const parseTokenisedAesString = (data: string): AesEncryptionRecord => {
  const [_, enc, array, content] = data.split("$");

  const encryption = enc as KryptosEncryption;
  const items = array.split(",");
  const values: Dict<string> = {};

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
    cty,
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
    algorithm: alg,
    authTag: Buffer.from(tag, B64U),
    content: Buffer.from(content, B64U),
    contentType: cty,
    encryption: encryption,
    hkdfSalt: hks ? Buffer.from(hks, B64U) : undefined,
    initialisationVector: Buffer.from(iv, B64U),
    keyId: kid,
    pbkdfIterations: p2c ? parseInt(p2c, 10) : undefined,
    pbkdfSalt: p2s ? Buffer.from(p2s, B64U) : undefined,
    publicEncryptionIv: pei ? Buffer.from(pei, B64U) : undefined,
    publicEncryptionJwk: crv && x && kty ? { crv, x, y, kty } : undefined,
    publicEncryptionKey: pek ? Buffer.from(pek, B64U) : undefined,
    publicEncryptionTag: pet ? Buffer.from(pet, B64U) : undefined,
    version: parseInt(v, 10),
  };
};
