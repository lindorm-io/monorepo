import { IKryptos, IKryptosEc } from "@lindorm/kryptos";
import { DsaEncoding, KeyData } from "@lindorm/types";

export type CreateEcSignatureOptions = {
  data: KeyData;
  dsaEncoding: DsaEncoding;
  kryptos: IKryptosEc;
  raw: boolean;
};

export type VerifyEcSignatureOptions = {
  data: KeyData;
  dsaEncoding: DsaEncoding;
  encoding: BufferEncoding;
  kryptos: IKryptosEc;
  raw: boolean;
  signature: KeyData;
};

export type EcKitOptions = {
  dsa?: DsaEncoding;
  encoding?: BufferEncoding;
  kryptos: IKryptos;
  raw?: boolean;
};
