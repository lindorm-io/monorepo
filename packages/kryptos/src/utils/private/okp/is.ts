import { isBuffer, isString } from "@lindorm/is";
import { KryptosCurve, OkpB64, OkpDer, OkpJwk, OkpPem } from "../../../types";
import {
  IsBufferFormatOptions,
  IsJwkFormatOptions,
  IsStringFormatOptions,
} from "../../../types/private";

const CURVES: Array<KryptosCurve> = ["Ed25519", "Ed448", "X25519", "X448"] as const;

export const isOkpB64 = (options: IsStringFormatOptions): options is OkpB64 => {
  if (options.type !== "OKP") return false;
  if (!options.curve || !CURVES.includes(options.curve)) return false;

  if (!isString(options.privateKey) && !isString(options.publicKey)) return false;

  if (options.privateKey && options.privateKey.startsWith("-----BEGIN PRIVATE KEY-----"))
    return false;

  if (options.publicKey && options.publicKey?.startsWith("-----BEGIN PUBLIC KEY-----"))
    return false;

  return true;
};

export const isOkpDer = (options: IsBufferFormatOptions): options is OkpDer => {
  if (options.type !== "OKP") return false;
  if (!options.curve || !CURVES.includes(options.curve)) return false;

  if (!isBuffer(options.privateKey) && !isBuffer(options.publicKey)) return false;

  return true;
};

export const isOkpJwk = (options: IsJwkFormatOptions): options is OkpJwk => {
  if (options.kty !== "OKP") return false;
  if (!options.crv || !CURVES.includes(options.crv)) return false;

  if (!isString(options.x)) return false;

  return true;
};

export const isOkpPem = (options: IsStringFormatOptions): options is OkpPem => {
  if (options.type !== "OKP") return false;
  if (!options.curve || !CURVES.includes(options.curve)) return false;

  if (!isString(options.privateKey) && !isString(options.publicKey)) return false;

  if (options.privateKey && !options.privateKey.startsWith("-----BEGIN PRIVATE KEY-----"))
    return false;

  if (options.publicKey && !options.publicKey?.startsWith("-----BEGIN PUBLIC KEY-----"))
    return false;

  return true;
};
