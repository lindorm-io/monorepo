import { Kryptos } from "@lindorm/kryptos";
import { BufferFormat, SignatureAlgorithm } from "./types";

export type CreateRsaSignatureOptions = {
  algorithm?: SignatureAlgorithm;
  data: string;
  format?: BufferFormat;
  kryptos: Kryptos;
};

export type VerifyRsaSignatureOptions = {
  algorithm?: SignatureAlgorithm;
  data: string;
  format?: BufferFormat;
  kryptos: Kryptos;
  signature: string;
};
