import { Kryptos } from "@lindorm/kryptos";
import { BufferFormat, ShaAlgorithm } from "@lindorm/types";
import { AesEncryption, PublicEncryptionJwk } from "./types";

export type EncryptAesDataOptions = {
  data: Buffer | string;
  encryption?: AesEncryption;
  format?: BufferFormat;
  integrityHash?: ShaAlgorithm;
  kryptos: Kryptos;
};

export type DecryptAesDataOptions = {
  authTag?: Buffer;
  content: Buffer;
  encryption: AesEncryption;
  initialisationVector: Buffer;
  integrityHash?: ShaAlgorithm;
  iterations?: number;
  kryptos: Kryptos;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  salt?: Buffer;
};
