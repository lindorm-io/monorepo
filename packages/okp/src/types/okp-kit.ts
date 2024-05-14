import { Kryptos } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";

export type CreateOkpSignatureOptions = {
  data: string;
  format: BufferFormat;
  kryptos: Kryptos;
};

export type VerifyOkpSignatureOptions = {
  data: string;
  format: BufferFormat;
  signature: string;
  kryptos: Kryptos;
};

export type OkpKitOptions = {
  format?: BufferFormat;
  kryptos: Kryptos;
};
