import { Kryptos } from "@lindorm/kryptos";
import { BufferFormat, HashAlgorithm } from "./types";

export type RsaKitOptions = {
  algorithm?: HashAlgorithm;
  format?: BufferFormat;
  kryptos: Kryptos;
};
