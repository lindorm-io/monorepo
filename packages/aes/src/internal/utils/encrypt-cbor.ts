import { B64 } from "@lindorm/b64";
import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { AesCborRecord } from "../constants/cbor-spec.js";
import { AES_CBOR_KIT } from "../constants/cbor-spec.js";
import type { AesContent } from "../../types/content.js";
import { calculateContentType } from "./content.js";
import { getInitialisationVector } from "./data/get-initialisation-vector.js";
import { encryptAesContent } from "./encrypt-content.js";
import { getEncryptionKey } from "./get-key/get-encryption-key.js";

export type EncryptCborOptions = {
  data: AesContent;
  encryption: KryptosEncryption;
  kryptos: IKryptos;
};

/**
 * CBOR format (v1) — the self-contained default:
 *
 *   aes:<base64url(CBOR(map))>
 *
 * The CBOR map carries header metadata AND cryptographic material together — there
 * is no separate header blob. AAD binds the header to the ciphertext exactly like
 * the serialised format: it is the deterministic CBOR encoding of the header-only
 * fields (everything except iv / authTag / content), recomputed on decrypt.
 */
export const encryptCbor = (options: EncryptCborOptions): string => {
  const { data, encryption, kryptos } = options;

  // 1. Get encryption key (CEK + key management params)
  const keyResult = getEncryptionKey({ encryption, kryptos });

  // 2. Generate IV before AAD computation
  const initialisationVector = getInitialisationVector(encryption);

  // 3. Assemble the header-only fields (no material) and derive AAD from them
  const contentType = calculateContentType(data);
  const header: AesCborRecord = {
    keyId: kryptos.id,
    algorithm: kryptos.algorithm,
    encryption,
    contentType,
    initialisationVector: undefined as unknown as Buffer,
    authTag: undefined as unknown as Buffer,
    content: undefined as unknown as Buffer,
    publicEncryptionKey: keyResult.publicEncryptionKey,
    pbkdfIterations: keyResult.pbkdfIterations,
    pbkdfSalt: keyResult.pbkdfSalt,
    publicEncryptionIv: keyResult.publicEncryptionIv,
    publicEncryptionTag: keyResult.publicEncryptionTag,
    publicEncryptionJwk: keyResult.publicEncryptionJwk,
  };

  // Present-only encoding drops the three undefined material fields, so this is
  // the header-only map; `cde: true` makes it byte-identical on the decrypt side.
  const aad = Buffer.from(AES_CBOR_KIT.encode(header));

  // 4. Encrypt content with the header-derived AAD and pre-generated IV
  const { authTag, content } = encryptAesContent({
    aad,
    contentEncryptionKey: keyResult.contentEncryptionKey,
    data,
    encryption,
    initialisationVector,
  });

  // 5. Encode the full self-contained record (header + material)
  const bytes = AES_CBOR_KIT.encode({
    ...header,
    initialisationVector,
    authTag,
    content,
  });

  return `aes:${B64.encode(Buffer.from(bytes), "b64u")}`;
};
