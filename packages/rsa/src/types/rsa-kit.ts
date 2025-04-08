import { IKryptos, IKryptosRsa } from "@lindorm/kryptos";
import { BufferFormat, DsaEncoding } from "@lindorm/types";

export type CreateRsaSignatureOptions = {
  data: string;
  dsa: DsaEncoding;
  format: BufferFormat;
  kryptos: IKryptosRsa;
};

export type VerifyRsaSignatureOptions = {
  data: string;
  dsa: DsaEncoding;
  format: BufferFormat;
  kryptos: IKryptosRsa;
  signature: string;
};

export type RsaKitOptions = {
  dsa?: DsaEncoding;
  format?: BufferFormat;
  kryptos: IKryptos;
};
