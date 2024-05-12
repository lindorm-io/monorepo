import { Kryptos } from "@lindorm/kryptos";

export type RsaSignatureFormat = "base64" | "base64url" | "hex";

export type RsaSignatureAlgorithm =
  | "RSA-SHA256"
  | "RSA-SHA384"
  | "RSA-SHA512"
  | "sha256"
  | "sha384"
  | "sha512";

export type CreateRsaSignatureOptions = {
  algorithm?: RsaSignatureAlgorithm;
  data: string;
  format?: RsaSignatureFormat;
  kryptos: Kryptos;
};

export type VerifyRsaSignatureOptions = {
  algorithm?: RsaSignatureAlgorithm;
  data: string;
  format?: RsaSignatureFormat;
  kryptos: Kryptos;
  signature: string;
};

export type RsaKitOptions = {
  algorithm?: RsaSignatureAlgorithm;
  format?: RsaSignatureFormat;
  kryptos: Kryptos;
};
