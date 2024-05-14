import { Kryptos } from "@lindorm/kryptos";
import { BufferFormat, ShaAlgorithm } from "@lindorm/types";
import { AesEncryption } from "./types";

export type AesKitOptions = {
  encryption?: AesEncryption;
  format?: BufferFormat;
  integrityHash?: ShaAlgorithm;
  kryptos: Kryptos;
};
