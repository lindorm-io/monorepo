import { IKryptos, IKryptosEc } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";

export type EcSignatureFormat = BufferFormat | "raw";

export type CreateEcSignatureOptions = {
  data: string;
  format: EcSignatureFormat;
  kryptos: IKryptosEc;
};

export type VerifyEcSignatureOptions = {
  data: string;
  format: EcSignatureFormat;
  kryptos: IKryptosEc;
  signature: string;
};

export type EcKitOptions = {
  format?: EcSignatureFormat;
  kryptos: IKryptos;
};
