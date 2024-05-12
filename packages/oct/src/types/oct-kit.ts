import { Kryptos } from "@lindorm/kryptos";

export type OctSignatureAlgorithm = "SHA256" | "SHA384" | "SHA512";

export type OctSignatureFormat = "base64" | "base64url" | "hex";

export type CreateOctSignatureOptions = {
  algorithm?: OctSignatureAlgorithm;
  data: string;
  format?: OctSignatureFormat;
  kryptos: Kryptos;
};

export type VerifyOctSignatureOptions = {
  algorithm?: OctSignatureAlgorithm;
  data: string;
  format?: OctSignatureFormat;
  kryptos: Kryptos;
  signature: string;
};

export type OctSignatureKitOptions = {
  algorithm?: OctSignatureAlgorithm;
  format?: OctSignatureFormat;
  kryptos: Kryptos;
};
