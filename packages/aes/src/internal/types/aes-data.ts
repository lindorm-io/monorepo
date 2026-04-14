import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { AesContentType } from "../../types/content";
import { PublicEncryptionJwk } from "../../types/types";
import {
  AesEncryptionOptions,
  SerialisedAesDecryption,
} from "../../types/aes-decryption-data";

export type PrivateAesEncryptionOptions = AesEncryptionOptions & { kryptos: IKryptos };

/**
 * Runtime options for `decryptAes`. Looser than the public `AesDecryptionRecord`
 * because decryption only consumes the cryptographic fields — `algorithm`,
 * `keyId`, and `version` are envelope metadata that callers have already
 * resolved (e.g. to pick the kryptos key) before invoking `decryptAes`.
 */
export type PrivateAesDecryptionOptions = {
  aad?: Buffer;
  authTag: Buffer;
  content: Buffer;
  contentType?: AesContentType;
  encryption: KryptosEncryption;
  initialisationVector: Buffer;
  kryptos: IKryptos;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionIv?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  publicEncryptionTag?: Buffer;
};

export type PrivateSerialisedAesDecryptionOptions = SerialisedAesDecryption & {
  kryptos: IKryptos;
};
