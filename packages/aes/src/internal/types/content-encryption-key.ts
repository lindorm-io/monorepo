import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { PublicEncryptionJwk } from "../../types/types.js";

export type CreateCekOptions = {
  encryption: KryptosEncryption;
  kryptos: IKryptos;
};

export type CreateCekResult = {
  contentEncryptionKey: Buffer;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionIv?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  publicEncryptionTag?: Buffer;
};

export type DecryptCekOptions = {
  encryption: KryptosEncryption;
  kryptos: IKryptos;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionIv?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  publicEncryptionTag?: Buffer;
};

export type DecryptCekResult = {
  contentEncryptionKey: Buffer;
};
