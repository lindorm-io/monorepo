import { IKryptos } from "@lindorm/kryptos";
import { DsaEncoding } from "@lindorm/types";

export type SignatureOptions = {
  dsa?: DsaEncoding;
  encoding?: BufferEncoding;
  kryptos: IKryptos;
  raw?: boolean;
};
