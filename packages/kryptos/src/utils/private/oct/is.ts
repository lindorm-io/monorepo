import { isBuffer, isString } from "@lindorm/is";
import { OctB64, OctDer, OctJwk, OctPem } from "../../../types";
import {
  IsBufferFormatOptions,
  IsJwkFormatOptions,
  IsStringFormatOptions,
} from "../../../types/private";

export const isOctB64 = (options: IsStringFormatOptions): options is OctB64 => {
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

export const isOctDer = (options: IsBufferFormatOptions): options is OctDer => {
  if (options.type !== "oct") return false;
  if (options.curve) return false;

  if (!isBuffer(options.privateKey)) return false;

  return true;
};

export const isOctJwk = (options: IsJwkFormatOptions): options is OctJwk => {
  if (options.kty !== "oct") return false;
  if (options.crv) return false;

  if (!isString(options.k)) return false;

  return true;
};

export const isOctPem = (options: IsStringFormatOptions): options is OctPem => {
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
