import { RsaAlgorithm, RsaFormat, ShaAlgorithm } from "../enums";
import { RsaPrivateKey, RsaPublicKey } from "./rsa-key";

export type CreateRsaSignatureOptions = {
  algorithm?: RsaAlgorithm | ShaAlgorithm;
  data: string;
  format?: RsaFormat;
  key: RsaPrivateKey;
};

export type VerifyRsaSignatureOptions = {
  algorithm?: RsaAlgorithm | ShaAlgorithm;
  data: string;
  format?: RsaFormat;
  key: RsaPublicKey;
  signature: string;
};
