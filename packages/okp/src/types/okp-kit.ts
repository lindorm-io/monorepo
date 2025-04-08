import { IKryptos, IKryptosOkp } from "@lindorm/kryptos";
import { BufferFormat, DsaEncoding } from "@lindorm/types";

export type CreateOkpSignatureOptions = {
  data: string;
  dsa: DsaEncoding;
  format: BufferFormat;
  kryptos: IKryptosOkp;
};

export type VerifyOkpSignatureOptions = {
  data: string;
  dsa: DsaEncoding;
  format: BufferFormat;
  signature: string;
  kryptos: IKryptosOkp;
};

export type OkpKitOptions = {
  dsa?: DsaEncoding;
  format?: BufferFormat;
  kryptos: IKryptos;
};
