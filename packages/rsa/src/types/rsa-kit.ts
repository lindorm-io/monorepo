import { IKryptos, IKryptosRsa } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";

export type CreateRsaSignatureOptions = {
  data: string;
  format: BufferFormat;
  kryptos: IKryptosRsa;
};

export type VerifyRsaSignatureOptions = {
  data: string;
  format: BufferFormat;
  kryptos: IKryptosRsa;
  signature: string;
};

export type RsaKitOptions = {
  format?: BufferFormat;
  kryptos: IKryptos;
};
