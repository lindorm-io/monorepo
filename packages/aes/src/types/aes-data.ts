import { IKryptos } from "@lindorm/kryptos";
import { BufferFormat, ShaAlgorithm } from "@lindorm/types";
import { AesEncryption, PublicEncryptionJwk } from "./types";

export type EncryptAesDataOptions = {
  data: Buffer | string;
  encryption?: AesEncryption;
  format?: BufferFormat;
  integrityHash?: ShaAlgorithm;
  kryptos: IKryptos;
};

export type DecryptAesDataOptions = {
  authTag?: Buffer;
  content: Buffer;
  encryption: AesEncryption;
  initialisationVector: Buffer;
  integrityHash?: ShaAlgorithm;
  kryptos: IKryptos;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  salt?: Buffer;
};
