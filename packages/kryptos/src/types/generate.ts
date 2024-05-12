import { EcCurve } from "./ec";
import { KryptosOptions } from "./kryptos";
import { OctSize } from "./oct";
import { OkpCurve } from "./okp";
import { RsaModulus } from "./rsa";

type StdOptions = Omit<KryptosOptions, "curve" | "privateKey" | "publicKey" | "type">;

type StdResult = { privateKey: Buffer };

export type GenerateEcOptions = StdOptions & {
  curve?: EcCurve;
};

export type GenerateEcResult = StdResult & {
  curve: EcCurve;
  publicKey: Buffer;
};

export type GenerateOctOptions = StdOptions & {
  size?: OctSize;
};

export type GenerateOctResult = StdResult;

export type GenerateOkpOptions = StdOptions & {
  curve?: OkpCurve;
};

export type GenerateOkpResult = StdResult & {
  curve: OkpCurve;
  publicKey: Buffer;
};

export type GenerateRsaOptions = StdOptions & {
  modulus?: RsaModulus;
};

export type GenerateRsaResult = StdResult & {
  publicKey: Buffer;
};

export type GenerateOptions =
  | GenerateEcOptions
  | GenerateOctOptions
  | GenerateOkpOptions
  | GenerateRsaOptions;

export type GenerateResult =
  | GenerateEcResult
  | GenerateOctResult
  | GenerateOkpResult
  | GenerateRsaResult;
