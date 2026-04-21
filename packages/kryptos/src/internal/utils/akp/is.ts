import { B64 } from "@lindorm/b64";
import { isBuffer, isString } from "@lindorm/is";
import type { AkpBuffer, AkpJwk, AkpString } from "../../../types/index.js";
import type {
  IsBufferFormatOptions,
  IsJwkFormatOptions,
  IsStringFormatOptions,
} from "../../types/is-options.js";

export const isAkpB64 = (options: IsStringFormatOptions): options is AkpString => {
  if (options.type !== "AKP") return false;

  if (!isString(options.privateKey) && !isString(options.publicKey)) return false;

  if (options.privateKey && options.privateKey.startsWith("-----BEGIN PRIVATE KEY-----"))
    return false;

  if (options.publicKey && options.publicKey?.startsWith("-----BEGIN PUBLIC KEY-----"))
    return false;

  if (options.privateKey && !B64.isBase64Url(options.privateKey)) return false;

  if (options.publicKey && !B64.isBase64Url(options.publicKey)) return false;

  return true;
};

export const isAkpDer = (options: IsBufferFormatOptions): options is AkpBuffer => {
  if (options.type !== "AKP") return false;

  if (!isBuffer(options.privateKey) && !isBuffer(options.publicKey)) return false;

  return true;
};

export const isAkpJwk = (options: IsJwkFormatOptions): options is AkpJwk => {
  if (options.kty !== "AKP") return false;

  if (!isString(options.pub)) return false;

  return true;
};

export const isAkpPem = (options: IsStringFormatOptions): options is AkpString => {
  if (options.type !== "AKP") return false;

  if (!isString(options.privateKey) && !isString(options.publicKey)) return false;

  if (options.privateKey && !options.privateKey.startsWith("-----BEGIN PRIVATE KEY-----"))
    return false;

  if (options.publicKey && !options.publicKey?.startsWith("-----BEGIN PUBLIC KEY-----"))
    return false;

  return true;
};
