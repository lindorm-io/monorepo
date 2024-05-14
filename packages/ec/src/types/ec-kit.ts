import { Kryptos } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";

export type EcSignatureFormat = BufferFormat | "raw";

export type CreateEcSignatureOptions = {
  data: string;
  format: EcSignatureFormat;
  kryptos: Kryptos;
};

export type VerifyEcSignatureOptions = {
  data: string;
  format: EcSignatureFormat;
  kryptos: Kryptos;
  signature: string;
};

export type EcKitOptions = {
  format?: EcSignatureFormat;
  kryptos: Kryptos;
};
