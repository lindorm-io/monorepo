import { IKryptos, IKryptosRsa } from "@lindorm/kryptos";
import { DsaEncoding, KeyData } from "@lindorm/types";

export type CreateRsaSignatureOptions = {
  data: KeyData;
  dsaEncoding: DsaEncoding;
  kryptos: IKryptosRsa;
};

export type VerifyRsaSignatureOptions = {
  data: KeyData;
  dsaEncoding: DsaEncoding;
  encoding: BufferEncoding;
  kryptos: IKryptosRsa;
  signature: KeyData;
};

export type RsaKitOptions = {
  dsa?: DsaEncoding;
  encoding?: BufferEncoding;
  kryptos: IKryptos;
};
