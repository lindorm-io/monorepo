import { RsaAlgorithm, RsaFormat } from "../enums";
import { RsaPrivateKey, RsaPublicKey } from "./rsa-key";

export type CreateRsaSignatureOptions = {
  algorithm?: RsaAlgorithm;
  data: string;
  format?: RsaFormat;
  key: RsaPrivateKey;
};

export type VerifyRsaSignatureOptions = {
  algorithm?: RsaAlgorithm;
  data: string;
  format?: RsaFormat;
  key: RsaPublicKey;
  signature: string;
};
