import { KeySet } from "@lindorm-io/jwk";
import {
  BufferFormat,
  Encryption,
  EncryptionKeyAlgorithm,
  IntegrityHash,
  KeyObject,
  PublicEncryptionJwk,
  Secret,
} from "./types";

export type EncryptAesDataOptions = {
  data: Buffer | string;
  encryption?: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  format?: BufferFormat;
  integrityHash?: IntegrityHash;
  key?: KeyObject;
  keySet?: KeySet;
  secret?: Secret;
};

export type DecryptAesDataOptions = {
  authTag?: Buffer;
  content: Buffer;
  encryption: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  initialisationVector: Buffer;
  integrityHash?: IntegrityHash;
  key?: KeyObject;
  keySet?: KeySet;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  secret?: Secret;
};
