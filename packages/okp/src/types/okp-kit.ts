import type { IKryptos, IKryptosOkp } from "@lindorm/kryptos";
import type { DsaEncoding, KeyData } from "@lindorm/types";

export type CreateOkpSignatureOptions = {
  data: KeyData;
  dsaEncoding: DsaEncoding;
  kryptos: IKryptosOkp;
};

export type VerifyOkpSignatureOptions = {
  data: KeyData;
  dsaEncoding: DsaEncoding;
  encoding: BufferEncoding;
  kryptos: IKryptosOkp;
  signature: KeyData;
};

export type OkpKitOptions = {
  dsa?: DsaEncoding;
  encoding?: BufferEncoding;
  kryptos: IKryptos;
};
