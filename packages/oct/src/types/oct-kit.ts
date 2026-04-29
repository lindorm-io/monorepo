import type { IKryptos, IKryptosOct } from "@lindorm/kryptos";
import type { KeyData } from "@lindorm/types";

export type CreateOctSignatureOptions = {
  data: KeyData;
  kryptos: IKryptosOct;
};

export type VerifyOctSignatureOptions = {
  data: KeyData;
  encoding: BufferEncoding;
  kryptos: IKryptosOct;
  signature: KeyData;
};

export type OctKitOptions = {
  encoding?: BufferEncoding;
  kryptos: IKryptos;
};
