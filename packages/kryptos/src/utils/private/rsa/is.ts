import { B64 } from "@lindorm/b64";
import { isBuffer, isString } from "@lindorm/is";
import { RsaDer, RsaJwk, RsaString } from "../../../types";
import {
  IsBufferFormatOptions,
  IsJwkFormatOptions,
  IsStringFormatOptions,
} from "../../../types/private";

export const isRsaB64 = (options: IsStringFormatOptions): options is RsaString => {
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

  if (options.privateKey && !B64.isBase64Url(options.privateKey)) return false;

  if (options.publicKey && !B64.isBase64Url(options.publicKey)) return false;

  return true;
};

export const isRsaDer = (options: IsBufferFormatOptions): options is RsaDer => {
  if (options.type !== "RSA") return false;
  if (options.curve) return false;

  if (!isBuffer(options.privateKey) && !isBuffer(options.publicKey)) return false;

  return true;
};

export const isRsaJwk = (options: IsJwkFormatOptions): options is RsaJwk => {
  if (options.kty !== "RSA") return false;
  if (options.crv) return false;

  if (!isString(options.n) || !isString(options.e)) return false;

  return true;
};

export const isRsaPem = (options: IsStringFormatOptions): options is RsaString => {
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
