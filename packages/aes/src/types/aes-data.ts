import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";
import { PublicEncryptionJwk } from "./types";

export type EncryptAesDataOptions = {
  data: Buffer | string;
  encryption?: KryptosEncryption;
  format?: BufferFormat;
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
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
};
