import { B64 } from "@lindorm/b64";
import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { AesContent } from "../../types";
import { buildAesHeader, computeAad } from "./aes-header";
import { calculateContentType } from "./content";
import { getInitialisationVector } from "./data";
import { encryptAesContent } from "./encrypt-content";
import { getEncryptionKey } from "./get-key";

export type EncryptEncodedOptions = {
  data: AesContent;
  encryption: KryptosEncryption;
  kryptos: IKryptos;
};

export const encryptEncoded = (options: EncryptEncodedOptions): string => {
  const { data, encryption, kryptos } = options;

  // 1. Get encryption key (CEK + key management params)
  const keyResult = getEncryptionKey({ encryption, kryptos });

  // 2. Generate IV before AAD computation
  const initialisationVector = getInitialisationVector(encryption);

  // 3. Build header and get JSON bytes
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
  const headerJson = Buffer.from(JSON.stringify(header), "utf8");

  // 4. Compute AAD from the base64url-encoded header JSON
  const headerB64 = B64.encode(headerJson, "b64u");
  const aad = computeAad(headerB64);

  // 5. Encrypt content with AAD and pre-generated IV
  const { authTag, content } = encryptAesContent({
    aad,
    contentEncryptionKey: keyResult.contentEncryptionKey,
    data,
    encryption,
    initialisationVector,
  });

  // 6. Build binary layout
  const buffers: Buffer[] = [];

  // Header length (uint16 BE) + header JSON
  const headerLength = Buffer.alloc(2);
  headerLength.writeUInt16BE(headerJson.length);
  buffers.push(headerLength, headerJson);

  // CEK length (uint16 BE) + CEK
  const cekLength = keyResult.publicEncryptionKey?.length ?? 0;
  const cekLengthBuf = Buffer.alloc(2);
  cekLengthBuf.writeUInt16BE(cekLength);
  buffers.push(cekLengthBuf);
  if (keyResult.publicEncryptionKey) {
    buffers.push(keyResult.publicEncryptionKey);
  }

  // IV (fixed size)
  buffers.push(initialisationVector);

  // Tag (fixed size)
  buffers.push(authTag);

  // Ciphertext (remaining)
  buffers.push(content);

  return B64.encode(Buffer.concat(buffers), "b64u");
};
