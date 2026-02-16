import { B64 } from "@lindorm/b64";
import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { AesContent } from "../../types";
import { buildAesHeader, computeAad, encodeAesHeader } from "./aes-header";
import { calculateContentType } from "./content";
import { getInitialisationVector } from "./data";
import { encryptAesContent } from "./encrypt-content";
import { getEncryptionKey } from "./get-key";

export type EncryptTokenisedOptions = {
  data: AesContent;
  encryption: KryptosEncryption;
  kryptos: IKryptos;
};

export const encryptTokenised = (options: EncryptTokenisedOptions): string => {
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
  const ivB64 = B64.encode(initialisationVector, "b64u");
  const tagB64 = B64.encode(authTag, "b64u");
  const ciphertextB64 = B64.encode(content, "b64u");

  if (keyResult.publicEncryptionKey) {
    const cekB64 = B64.encode(keyResult.publicEncryptionKey, "b64u");
    return `aes:${headerB64}$${cekB64}$${ivB64}$${tagB64}$${ciphertextB64}`;
  }

  return `aes:${headerB64}$${ivB64}$${tagB64}$${ciphertextB64}`;
};
