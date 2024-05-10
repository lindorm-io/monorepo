import { isBuffer, isString } from "@lindorm/is";
import {
  EcKeyJwk,
  KryptosB64,
  KryptosDer,
  KryptosFrom,
  KryptosJwk,
  KryptosPem,
  OctKeyJwk,
  OkpKeyJwk,
  RsaKeyJwk,
} from "../../types";
import { _isOctSecret } from "./oct";

export const _isB64 = (arg: KryptosFrom): arg is KryptosB64 => {
  const typed = arg as KryptosB64;

  switch (typed.type) {
    case "EC":
      return Boolean(
        isString(typed.curve) &&
          ((isString(typed.privateKey) &&
            !typed.privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) ||
            (isString(typed.publicKey) &&
              !typed.publicKey.startsWith("-----BEGIN PUBLIC KEY-----"))),
      );

    case "oct":
      return Boolean(isString(typed.privateKey) && !_isOctSecret(typed.privateKey));

    case "OKP":
      return Boolean(
        isString(typed.curve) &&
          ((isString(typed.privateKey) &&
            !typed.privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) ||
            (isString(typed.publicKey) &&
              !typed.publicKey.startsWith("-----BEGIN PUBLIC KEY-----"))),
      );

    case "RSA":
      return Boolean(
        !isString(typed.curve) &&
          ((isString(typed.privateKey) &&
            !typed.privateKey.startsWith("-----BEGIN RSA PRIVATE KEY-----")) ||
            (isString(typed.publicKey) &&
              !typed.publicKey.startsWith("-----BEGIN RSA PUBLIC KEY-----"))),
      );

    default:
      return false;
  }
};

export const _isDer = (arg: KryptosFrom): arg is KryptosDer => {
  const typed = arg as KryptosDer;

  if (!typed.type) return false;

  return isBuffer(typed.privateKey) || isBuffer(typed.publicKey);
};

export const _isJwk = (arg: KryptosFrom): arg is KryptosJwk => {
  const typed = arg as KryptosJwk;

  if (typed.kty === "EC") {
    const ec = typed as EcKeyJwk;
    return isString(ec.crv) && (isString(ec.d) || isString(ec.x) || isString(ec.y));
  }

  if (typed.kty === "oct") {
    const oct = typed as OctKeyJwk;
    return isString(oct.k);
  }

  if (typed.kty === "OKP") {
    const okp = typed as OkpKeyJwk;
    return isString(okp.crv) && (isString(okp.d) || isString(okp.x));
  }

  if (typed.kty === "RSA") {
    const rsa = typed as RsaKeyJwk;
    return isString(rsa.e) && isString(rsa.n);
  }

  return false;
};

export const _isPem = (arg: KryptosFrom): arg is KryptosPem => {
  const typed = arg as KryptosPem;

  switch (typed.type) {
    case "EC":
      return Boolean(
        isString(typed.curve) &&
          ((isString(typed.privateKey) &&
            typed.privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) ||
            (isString(typed.publicKey) &&
              typed.publicKey.startsWith("-----BEGIN PUBLIC KEY-----"))),
      );

    case "oct":
      return Boolean(isString(typed.privateKey) && _isOctSecret(typed.privateKey));

    case "OKP":
      return Boolean(
        isString(typed.curve) &&
          ((isString(typed.privateKey) &&
            typed.privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) ||
            (isString(typed.publicKey) &&
              typed.publicKey.startsWith("-----BEGIN PUBLIC KEY-----"))),
      );

    case "RSA":
      return Boolean(
        !isString(typed.curve) &&
          ((isString(typed.privateKey) &&
            typed.privateKey.startsWith("-----BEGIN RSA PRIVATE KEY-----")) ||
            (isString(typed.publicKey) &&
              typed.publicKey.startsWith("-----BEGIN RSA PUBLIC KEY-----"))),
      );

    default:
      return false;
  }
};

export const _isRaw = (arg: KryptosFrom): arg is KryptosDer => {
  const typed = arg as KryptosDer;

  if (!typed.type) return false;

  return isBuffer(typed.privateKey) || isBuffer(typed.publicKey);
};
