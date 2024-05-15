import { Kryptos, KryptosEc } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";

export type EcSignatureFormat = BufferFormat | "raw";

export type CreateEcSignatureOptions = {
  data: string;
  format: EcSignatureFormat;
  kryptos: KryptosEc;
};

export type VerifyEcSignatureOptions = {
  data: string;
  format: EcSignatureFormat;
  kryptos: KryptosEc;
  signature: string;
};

export type EcKitOptions = {
  format?: EcSignatureFormat;
  kryptos: Kryptos;
};
