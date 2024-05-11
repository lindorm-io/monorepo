import { Kryptos } from "@lindorm/kryptos";
import { BufferFormat, SignatureAlgorithm } from "./types";

export type RsaKitOptions = {
  algorithm?: SignatureAlgorithm;
  format?: BufferFormat;
  kryptos: Kryptos;
};
