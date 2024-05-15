import { isBuffer, isString } from "@lindorm/is";
import { OctB64, OctDer, OctJwk, OctPem } from "../../../types";
import {
  _IsBufferFormatOptions,
  _IsJwkFormatOptions,
  _IsStringFormatOptions,
} from "../../../types/private/is-options";

export const _isOctB64 = (options: _IsStringFormatOptions): options is OctB64 => {
  if (options.type !== "oct") return false;
  if (options.curve) return false;

  if (!isString(options.privateKey) && !isString(options.publicKey)) return false;

  if (
    options.privateKey &&
    options.privateKey.startsWith("-----BEGIN OCT PRIVATE KEY-----")
  )
    return false;

  if (options.publicKey && options.publicKey.startsWith("-----BEGIN OCT PUBLIC KEY-----"))
    return false;

  return true;
};

export const _isOctDer = (options: _IsBufferFormatOptions): options is OctDer => {
  if (options.type !== "oct") return false;
  if (options.curve) return false;

  if (!isBuffer(options.privateKey)) return false;

  return true;
};

export const _isOctJwk = (options: _IsJwkFormatOptions): options is OctJwk => {
  if (options.kty !== "oct") return false;
  if (options.crv) return false;

  if (!isString(options.k)) return false;

  return true;
};

export const _isOctPem = (options: _IsStringFormatOptions): options is OctPem => {
  if (options.type !== "oct") return false;
  if (options.curve) return false;

  if (!isString(options.privateKey) && !isString(options.publicKey)) return false;

  if (
    options.privateKey &&
    !options.privateKey.startsWith("-----BEGIN OCT PRIVATE KEY-----")
  )
    return false;

  if (
    options.publicKey &&
    !options.publicKey.startsWith("-----BEGIN OCT PUBLIC KEY-----")
  )
    return false;

  return true;
};
