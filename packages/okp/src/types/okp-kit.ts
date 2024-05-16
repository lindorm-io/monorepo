import { IKryptos, IKryptosOkp } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";

export type CreateOkpSignatureOptions = {
  data: string;
  format: BufferFormat;
  kryptos: IKryptosOkp;
};

export type VerifyOkpSignatureOptions = {
  data: string;
  format: BufferFormat;
  signature: string;
  kryptos: IKryptosOkp;
};

export type OkpKitOptions = {
  format?: BufferFormat;
  kryptos: IKryptos;
};
