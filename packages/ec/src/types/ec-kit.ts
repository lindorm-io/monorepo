import { Kryptos } from "@lindorm/kryptos";

export type EcSignatureAlgorithm = "SHA256" | "SHA384" | "SHA512";

export type EcSignatureFormat = "base64" | "base64url" | "hex";

export type CreateEcSignatureOptions = {
  algorithm?: EcSignatureAlgorithm;
  data: string;
  format?: EcSignatureFormat;
  kryptos: Kryptos;
};

export type VerifyEcSignatureOptions = {
  algorithm?: EcSignatureAlgorithm;
  data: string;
  format?: EcSignatureFormat;
  signature: string;
  kryptos: Kryptos;
};

export type EcKitOptions = {
  algorithm?: EcSignatureAlgorithm;
  format?: EcSignatureFormat;
  kryptos: Kryptos;
};
