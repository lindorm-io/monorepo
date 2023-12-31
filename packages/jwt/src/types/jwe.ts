import { Encryption, EncryptionKeyAlgorithm, KeyObject } from "@lindorm-io/aes";
import { KeySet } from "@lindorm-io/jwk";

export type JweOptions = {
  encryption?: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  key?: KeyObject;
  keySet?: KeySet;
};

export type EncryptJweOptions = {
  encryption?: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  key?: KeyObject;
  keySet?: KeySet;
  token: string;
};

export type DecryptJweOptions = {
  jwe: string;
  key?: KeyObject;
  keySet?: KeySet;
};
