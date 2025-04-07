import { B64 } from "@lindorm/b64";
import { isBuffer, isString } from "@lindorm/is";
import { OctBuffer, OctJwk, OctString } from "../../../types";
import {
  IsBufferFormatOptions,
  IsJwkFormatOptions,
  IsStringFormatOptions,
} from "../../../types/private";

export const isOctB64 = (options: IsStringFormatOptions): options is OctString => {
  if (options.type !== "oct") return false;
  if (options.curve) return false;

  if (!isString(options.privateKey)) return false;

  if (options.privateKey.startsWith("-----BEGIN OCT PRIVATE KEY-----")) return false;

  if (options.publicKey && options.publicKey.length) return false;

  if (!B64.isBase64Url(options.privateKey)) return false;

  return true;
};

export const isOctDer = (options: IsBufferFormatOptions): options is OctBuffer => {
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

export const isOctPem = (options: IsStringFormatOptions): options is OctString => {
  if (options.type !== "oct") return false;
  if (options.curve) return false;

  if (!isString(options.privateKey)) return false;

  if (!options.privateKey.startsWith("-----BEGIN OCT PRIVATE KEY-----")) return false;

  if (options.publicKey && options.publicKey.length) return false;

  return true;
};

export const isOctUtf = (options: IsStringFormatOptions): options is OctString => {
  if (options.type !== "oct") return false;
  if (options.curve) return false;

  if (!isString(options.privateKey)) return false;

  if (options.privateKey.startsWith("-----BEGIN OCT PRIVATE KEY-----")) return false;

  if (options.publicKey && options.publicKey.length) return false;

  return true;
};
