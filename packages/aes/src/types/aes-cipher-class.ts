import { KeySet } from "@lindorm-io/jwk";
import {
  BufferFormat,
  Encryption,
  EncryptionKeyAlgorithm,
  IntegrityHash,
  KeyObject,
  Secret,
} from "./types";

export type AesCipherOptions = {
  encryption?: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  format?: BufferFormat;
  integrityHash?: IntegrityHash;
  key?: KeyObject;
  keySet?: KeySet;
  secret?: Secret;
};
