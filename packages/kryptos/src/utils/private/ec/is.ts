import { B64 } from "@lindorm/b64";
import { isBuffer, isString } from "@lindorm/is";
import { EcDer, EcJwk, EcString, KryptosCurve } from "../../../types";
import {
  IsBufferFormatOptions,
  IsJwkFormatOptions,
  IsStringFormatOptions,
} from "../../../types/private";

const CURVES: Array<KryptosCurve> = ["P-256", "P-384", "P-521"] as const;

export const isEcB64 = (options: IsStringFormatOptions): options is EcString => {
  if (options.type !== "EC") return false;
  if (!options.curve || !CURVES.includes(options.curve)) return false;

  if (!isString(options.privateKey) && !isString(options.publicKey)) return false;

  if (options.privateKey && options.privateKey.startsWith("-----BEGIN PRIVATE KEY-----"))
    return false;

  if (options.publicKey && options.publicKey.startsWith("-----BEGIN PUBLIC KEY-----"))
    return false;

  if (options.privateKey && !B64.isBase64Url(options.privateKey)) return false;

  if (options.publicKey && !B64.isBase64Url(options.publicKey)) return false;

  return true;
};

export const isEcDer = (options: IsBufferFormatOptions): options is EcDer => {
  if (options.type !== "EC") return false;
  if (!options.curve || !CURVES.includes(options.curve)) return false;

  if (!isBuffer(options.privateKey) && !isBuffer(options.publicKey)) return false;

  return true;
};

export const isEcJwk = (options: IsJwkFormatOptions): options is EcJwk => {
  if (options.kty !== "EC") return false;
  if (!options.crv || !CURVES.includes(options.crv)) return false;

  if (!isString(options.x) || !isString(options.y)) return false;

  return true;
};

export const isEcPem = (options: IsStringFormatOptions): options is EcString => {
  if (options.type !== "EC") return false;
  if (!options.curve || !CURVES.includes(options.curve)) return false;

  if (!isString(options.privateKey) && !isString(options.publicKey)) return false;

  if (options.privateKey && !options.privateKey.startsWith("-----BEGIN PRIVATE KEY-----"))
    return false;

  if (options.publicKey && !options.publicKey.startsWith("-----BEGIN PUBLIC KEY-----"))
    return false;

  return true;
};
