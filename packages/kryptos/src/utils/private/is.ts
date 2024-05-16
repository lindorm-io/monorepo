import {
  KryptosFrom,
  KryptosFromB64,
  KryptosFromDer,
  KryptosFromJwk,
  KryptosFromPem,
} from "../../types";
import { _isEcB64, _isEcDer, _isEcJwk, _isEcPem } from "./ec/is";
import { _isOctB64, _isOctDer, _isOctJwk, _isOctPem } from "./oct/is";
import { _isOkpB64, _isOkpDer, _isOkpJwk, _isOkpPem } from "./okp/is";
import { _isRsaB64, _isRsaDer, _isRsaJwk, _isRsaPem } from "./rsa/is";

export const _isB64 = (options: KryptosFrom): options is KryptosFromB64 => {
  const typed = options as KryptosFromB64;

  switch (typed.type) {
    case "EC":
      return _isEcB64(typed);

    case "oct":
      return _isOctB64(typed);

    case "OKP":
      return _isOkpB64(typed);

    case "RSA":
      return _isRsaB64(typed);

    default:
      return false;
  }
};

export const _isDer = (options: KryptosFrom): options is KryptosFromDer => {
  const typed = options as KryptosFromDer;

  switch (typed.type) {
    case "EC":
      return _isEcDer(typed);

    case "oct":
      return _isOctDer(typed);

    case "OKP":
      return _isOkpDer(typed);

    case "RSA":
      return _isRsaDer(typed);

    default:
      return false;
  }
};

export const _isJwk = (options: KryptosFrom): options is KryptosFromJwk => {
  const typed = options as KryptosFromJwk;

  switch (typed.kty) {
    case "EC":
      return _isEcJwk(typed);

    case "oct":
      return _isOctJwk(typed);

    case "OKP":
      return _isOkpJwk(typed);

    case "RSA":
      return _isRsaJwk(typed);

    default:
      return false;
  }
};

export const _isPem = (options: KryptosFrom): options is KryptosFromPem => {
  const typed = options as KryptosFromPem;

  switch (typed.type) {
    case "EC":
      return _isEcPem(typed);

    case "oct":
      return _isOctPem(typed);

    case "OKP":
      return _isOkpPem(typed);

    case "RSA":
      return _isRsaPem(typed);

    default:
      return false;
  }
};
