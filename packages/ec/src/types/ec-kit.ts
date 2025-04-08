import { IKryptos, IKryptosEc } from "@lindorm/kryptos";
import { BufferFormat, DsaEncoding } from "@lindorm/types";

export type EcSignatureFormat = BufferFormat | "raw";

export type CreateEcSignatureOptions = {
  data: string;
  dsa: DsaEncoding;
  format: EcSignatureFormat;
  kryptos: IKryptosEc;
};

export type VerifyEcSignatureOptions = {
  data: string;
  dsa: DsaEncoding;
  format: EcSignatureFormat;
  kryptos: IKryptosEc;
  signature: string;
};

export type EcKitOptions = {
  dsa?: DsaEncoding;
  format?: EcSignatureFormat;
  kryptos: IKryptos;
};
