import { IKryptos } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";

export type SignatureFormat = BufferFormat | "raw";

export type SignatureOptions = {
  format?: SignatureFormat;
  kryptos: IKryptos;
};
