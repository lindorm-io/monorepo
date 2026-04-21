import type { IKryptos } from "@lindorm/kryptos";
import type { DsaEncoding } from "@lindorm/types";

export type SignatureOptions = {
  dsa?: DsaEncoding;
  encoding?: BufferEncoding;
  kryptos: IKryptos;
  raw?: boolean;
};
