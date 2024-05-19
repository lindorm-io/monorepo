import { IKryptos } from "@lindorm/kryptos";
import { AesEncryption, PublicEncryptionJwk } from "../types";

export type CreateCekOptions = {
  encryption: AesEncryption;
  kryptos: IKryptos;
};

export type CreateCekResult = {
  contentEncryptionKey: Buffer;
  hkdfSalt?: Buffer;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
};

export type DecryptCekOptions = {
  encryption: AesEncryption;
  hkdfSalt?: Buffer;
  kryptos: IKryptos;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
};

export type DecryptCekResult = {
  contentEncryptionKey: Buffer;
};
