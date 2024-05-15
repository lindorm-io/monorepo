import { isBuffer, isString } from "@lindorm/is";
import { KryptosCurve, OkpB64, OkpDer, OkpJwk, OkpPem } from "../../../types";
import {
  _IsBufferFormatOptions,
  _IsJwkFormatOptions,
  _IsStringFormatOptions,
} from "../../../types/private/is-options";

const CURVES: Array<KryptosCurve> = ["Ed25519", "Ed448", "X25519", "X448"] as const;

export const _isOkpB64 = (options: _IsStringFormatOptions): options is OkpB64 => {
  if (options.type !== "OKP") return false;
  if (!options.curve || !CURVES.includes(options.curve)) return false;

  if (!isString(options.privateKey) && !isString(options.publicKey)) return false;

  if (options.privateKey && options.privateKey.startsWith("-----BEGIN PRIVATE KEY-----"))
    return false;

  if (options.publicKey && options.publicKey?.startsWith("-----BEGIN PUBLIC KEY-----"))
    return false;

  return true;
};

export const _isOkpDer = (options: _IsBufferFormatOptions): options is OkpDer => {
  if (options.type !== "OKP") return false;
  if (!options.curve || !CURVES.includes(options.curve)) return false;

  if (!isBuffer(options.privateKey) && !isBuffer(options.publicKey)) return false;

  return true;
};

export const _isOkpJwk = (options: _IsJwkFormatOptions): options is OkpJwk => {
  if (options.kty !== "OKP") return false;
  if (!options.crv || !CURVES.includes(options.crv)) return false;

  if (!isString(options.x)) return false;

  return true;
};

export const _isOkpPem = (options: _IsStringFormatOptions): options is OkpPem => {
  if (options.type !== "OKP") return false;
  if (!options.curve || !CURVES.includes(options.curve)) return false;

  if (!isString(options.privateKey) && !isString(options.publicKey)) return false;

  if (options.privateKey && !options.privateKey.startsWith("-----BEGIN PRIVATE KEY-----"))
    return false;

  if (options.publicKey && !options.publicKey?.startsWith("-----BEGIN PUBLIC KEY-----"))
    return false;

  return true;
};
