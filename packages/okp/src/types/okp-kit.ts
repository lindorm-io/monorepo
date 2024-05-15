import { Kryptos, KryptosOkp } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";

export type CreateOkpSignatureOptions = {
  data: string;
  format: BufferFormat;
  kryptos: KryptosOkp;
};

export type VerifyOkpSignatureOptions = {
  data: string;
  format: BufferFormat;
  signature: string;
  kryptos: KryptosOkp;
};

export type OkpKitOptions = {
  format?: BufferFormat;
  kryptos: Kryptos;
};
