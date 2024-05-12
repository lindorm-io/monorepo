import { Kryptos } from "@lindorm/kryptos";

export type OkpSignatureFormat = "base64" | "base64url" | "hex";

export type CreateOkpSignatureOptions = {
  data: string;
  format?: OkpSignatureFormat;
  kryptos: Kryptos;
};

export type VerifyOkpSignatureOptions = {
  data: string;
  format?: OkpSignatureFormat;
  signature: string;
  kryptos: Kryptos;
};

export type OkpKitOptions = {
  format?: OkpSignatureFormat;
  kryptos: Kryptos;
};
