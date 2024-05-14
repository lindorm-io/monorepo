import { Kryptos } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";

export type CreateRsaSignatureOptions = {
  data: string;
  format: BufferFormat;
  kryptos: Kryptos;
};

export type VerifyRsaSignatureOptions = {
  data: string;
  format: BufferFormat;
  kryptos: Kryptos;
  signature: string;
};

export type RsaKitOptions = {
  format?: BufferFormat;
  kryptos: Kryptos;
};
