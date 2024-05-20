import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { PublicEncryptionJwk } from "./types";

export type EncryptAesDataOptions = {
  data: Buffer | string;
  encryption?: KryptosEncryption;
  kryptos: IKryptos;
};

export type DecryptAesDataOptions = {
  authTag?: Buffer;
  content: Buffer;
  encryption: KryptosEncryption;
  hkdfSalt?: Buffer;
  initialisationVector: Buffer;
  kryptos: IKryptos;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionIv?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  publicEncryptionTag?: Buffer;
};
