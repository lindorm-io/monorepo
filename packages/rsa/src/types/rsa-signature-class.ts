import { RsaAlgorithm, RsaFormat } from "../enums";
import { RsaPrivateKey, RsaPublicKey } from "./rsa-key";

export type RsaSignatureOptions = {
  algorithm?: RsaAlgorithm;
  format?: RsaFormat;
  publicKey?: RsaPublicKey;
  privateKey?: RsaPrivateKey;
};
