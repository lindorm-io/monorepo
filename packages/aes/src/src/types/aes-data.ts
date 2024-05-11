import { Kryptos } from "@lindorm/kryptos";
import {
  BufferFormat,
  Encryption,
  EncryptionKeyAlgorithm,
  IntegrityHash,
  PublicEncryptionJwk,
} from "./types";

export type EncryptAesDataOptions = {
  data: Buffer | string;
  encryption?: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  format?: BufferFormat;
  integrityHash?: IntegrityHash;
  kryptos: Kryptos;
};

export type DecryptAesDataOptions = {
  authTag?: Buffer;
  content: Buffer;
  encryption: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  initialisationVector: Buffer;
  integrityHash?: IntegrityHash;
  kryptos: Kryptos;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
};
