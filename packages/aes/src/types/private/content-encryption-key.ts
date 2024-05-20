import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { PublicEncryptionJwk } from "../types";

export type CreateCekOptions = {
  encryption: KryptosEncryption;
  kryptos: IKryptos;
};

export type CreateCekResult = {
  contentEncryptionKey: Buffer;
  hkdfSalt?: Buffer;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionIv?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  publicEncryptionTag?: Buffer;
};

export type DecryptCekOptions = {
  encryption: KryptosEncryption;
  hkdfSalt?: Buffer;
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
