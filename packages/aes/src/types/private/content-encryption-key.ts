import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { PublicEncryptionJwk } from "../types";

export type CreateCekOptions = {
  apu?: Buffer;
  apv?: Buffer;
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
  apu?: Buffer;
  apv?: Buffer;
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
