import { isBuffer, isString } from "@lindorm/is";
import { RsaB64, RsaDer, RsaJwk, RsaPem } from "../../../types";
import {
  _IsBufferFormatOptions,
  _IsJwkFormatOptions,
  _IsStringFormatOptions,
} from "../../../types/private/is-options";

export const _isRsaB64 = (options: _IsStringFormatOptions): options is RsaB64 => {
  if (options.type !== "RSA") return false;
  if (options.curve) return false;

  if (!isString(options.privateKey) && !isString(options.publicKey)) return false;

  if (
    options.privateKey &&
    options.privateKey.startsWith("-----BEGIN RSA PRIVATE KEY-----")
  )
    return false;

  if (options.publicKey && options.publicKey.startsWith("-----BEGIN RSA PUBLIC KEY-----"))
    return false;

  return true;
};

export const _isRsaDer = (options: _IsBufferFormatOptions): options is RsaDer => {
  if (options.type !== "RSA") return false;
  if (options.curve) return false;

  if (!isBuffer(options.privateKey) && !isBuffer(options.publicKey)) return false;

  return true;
};

export const _isRsaJwk = (options: _IsJwkFormatOptions): options is RsaJwk => {
  if (options.kty !== "RSA") return false;
  if (options.crv) return false;

  if (!isString(options.n) || !isString(options.e)) return false;

  return true;
};

export const _isRsaPem = (options: _IsStringFormatOptions): options is RsaPem => {
  if (options.type !== "RSA") return false;
  if (options.curve) return false;

  if (
    options.privateKey &&
    !options.privateKey.startsWith("-----BEGIN RSA PRIVATE KEY-----")
  )
    return false;

  if (
    options.publicKey &&
    !options.publicKey.startsWith("-----BEGIN RSA PUBLIC KEY-----")
  )
    return false;

  return true;
};
