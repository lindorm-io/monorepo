import { IKryptos, IKryptosAkp } from "@lindorm/kryptos";
import { KeyData } from "@lindorm/types";

export type CreateAkpSignatureOptions = {
  data: KeyData;
  kryptos: IKryptosAkp;
};

export type VerifyAkpSignatureOptions = {
  data: KeyData;
  encoding: BufferEncoding;
  kryptos: IKryptosAkp;
  signature: KeyData;
};

export type AkpKitOptions = {
  encoding?: BufferEncoding;
  kryptos: IKryptos;
};
