import { isBuffer, isString } from "@lindorm/is";
import { EcB64, EcDer, EcJwk, EcPem, EcRaw, KryptosCurve } from "../../../types";
import {
  _IsBufferFormatOptions,
  _IsJwkFormatOptions,
  _IsStringFormatOptions,
} from "../../../types/private/is-options";

const CURVES: Array<KryptosCurve> = ["P-256", "P-384", "P-521"] as const;

export const _isEcB64 = (options: _IsStringFormatOptions): options is EcB64 => {
  if (options.type !== "EC") return false;
  if (!options.curve || !CURVES.includes(options.curve)) return false;

  if (!isString(options.privateKey) && !isString(options.publicKey)) return false;

  if (options.privateKey && options.privateKey.startsWith("-----BEGIN PRIVATE KEY-----"))
    return false;

  if (options.publicKey && options.publicKey.startsWith("-----BEGIN PUBLIC KEY-----"))
    return false;

  return true;
};

export const _isEcDer = (options: _IsBufferFormatOptions): options is EcDer => {
  if (options.type !== "EC") return false;
  if (!options.curve || !CURVES.includes(options.curve)) return false;

  if (!isBuffer(options.privateKey) && !isBuffer(options.publicKey)) return false;

  return true;
};

export const _isEcJwk = (options: _IsJwkFormatOptions): options is EcJwk => {
  if (options.kty !== "EC") return false;
  if (!options.crv || !CURVES.includes(options.crv)) return false;

  if (!isString(options.x) || !isString(options.y)) return false;

  return true;
};

export const _isEcPem = (options: _IsStringFormatOptions): options is EcPem => {
  if (options.type !== "EC") return false;
  if (!options.curve || !CURVES.includes(options.curve)) return false;

  if (!isString(options.privateKey) && !isString(options.publicKey)) return false;

  if (options.privateKey && !options.privateKey.startsWith("-----BEGIN PRIVATE KEY-----"))
    return false;

  if (options.publicKey && !options.publicKey.startsWith("-----BEGIN PUBLIC KEY-----"))
    return false;

  return true;
};

export const _isEcRaw = (options: _IsBufferFormatOptions): options is EcRaw => {
  if (options.type !== "EC") return false;
  if (!options.curve || !CURVES.includes(options.curve)) return false;

  if (!isBuffer(options.privateKey) && !isBuffer(options.publicKey)) return false;

  return true;
};
