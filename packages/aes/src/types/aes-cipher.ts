import { KeySet } from "@lindorm-io/jwk";
import { EncryptAesDataOptions } from "./aes-data";
import { KeyObject, Secret } from "./types";

export type EncryptAesCipherOptions = EncryptAesDataOptions;

export type DecryptAesCipherOptions = {
  cipher: string;
  key?: KeyObject;
  keySet?: KeySet;
  secret?: Secret;
};

export type VerifyAesCipherOptions = DecryptAesCipherOptions & {
  data: string;
};
