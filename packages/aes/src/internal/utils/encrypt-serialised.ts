import { B64 } from "@lindorm/b64";
import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { AES_FORMAT_VERSION } from "../constants/version.js";
import type { AesContent } from "../../types/content.js";
import type { SerialisedAesEncryption } from "../../types/aes-encryption-data.js";
import { buildAesHeader, computeAad, encodeAesHeader } from "./aes-header.js";
import { calculateContentType } from "./content.js";
import { getInitialisationVector } from "./data/get-initialisation-vector.js";
import { encryptAesContent } from "./encrypt-content.js";
import { getEncryptionKey } from "./get-key/get-encryption-key.js";

export type EncryptSerialisedOptions = {
  data: AesContent;
  encryption: KryptosEncryption;
  kryptos: IKryptos;
};

export const encryptSerialised = (
  options: EncryptSerialisedOptions,
): SerialisedAesEncryption => {
  const { data, encryption, kryptos } = options;

  // 1. Get encryption key (CEK + key management params)
  const keyResult = getEncryptionKey({ encryption, kryptos });

  // 2. Generate IV before AAD computation
  const initialisationVector = getInitialisationVector(encryption);

  // 3. Build and encode header
  const contentType = calculateContentType(data);
  const header = buildAesHeader({
    algorithm: kryptos.algorithm,
    contentType,
    encryption,
    keyId: kryptos.id,
    pbkdfIterations: keyResult.pbkdfIterations,
    pbkdfSalt: keyResult.pbkdfSalt,
    publicEncryptionIv: keyResult.publicEncryptionIv,
    publicEncryptionJwk: keyResult.publicEncryptionJwk,
    publicEncryptionTag: keyResult.publicEncryptionTag,
  });
  const headerB64 = encodeAesHeader(header);

  // 4. Compute AAD from header
  const aad = computeAad(headerB64);

  // 5. Encrypt content with AAD and pre-generated IV
  const { authTag, content } = encryptAesContent({
    aad,
    contentEncryptionKey: keyResult.contentEncryptionKey,
    data,
    encryption,
    initialisationVector,
  });

  // 6. Format output
  return {
    cek: keyResult.publicEncryptionKey
      ? B64.encode(keyResult.publicEncryptionKey, "b64u")
      : undefined,
    ciphertext: B64.encode(content, "b64u"),
    header: headerB64,
    iv: B64.encode(initialisationVector, "b64u"),
    tag: B64.encode(authTag, "b64u"),
    v: AES_FORMAT_VERSION,
  };
};
