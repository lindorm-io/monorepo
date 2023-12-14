import { RsaFormat } from "../enums";
import { RsaPrivateKey, RsaPublicKey } from "./rsa-key";

export type RsaCipherOptions = {
  format?: RsaFormat;
  publicKey?: RsaPublicKey;
  privateKey?: RsaPrivateKey;
};
