import { Kryptos } from "@lindorm/kryptos";
import { BufferFormat, Encryption, EncryptionKeyAlgorithm, IntegrityHash } from "./types";

export type AesKitOptions = {
  encryption?: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  format?: BufferFormat;
  integrityHash?: IntegrityHash;
  kryptos: Kryptos;
};