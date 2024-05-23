import {
  KryptosFrom,
  KryptosFromB64,
  KryptosFromDer,
  KryptosFromJwk,
  KryptosFromPem,
} from "../../types";
import { isEcB64, isEcDer, isEcJwk, isEcPem } from "./ec/is";
import { isOctB64, isOctDer, isOctJwk, isOctPem } from "./oct/is";
import { isOkpB64, isOkpDer, isOkpJwk, isOkpPem } from "./okp/is";
import { isRsaB64, isRsaDer, isRsaJwk, isRsaPem } from "./rsa/is";

export const isB64 = (options: KryptosFrom): options is KryptosFromB64 => {
  const typed = options as KryptosFromB64;

  switch (typed.type) {
    case "EC":
      return isEcB64(typed);

    case "oct":
      return isOctB64(typed);

    case "OKP":
      return isOkpB64(typed);

    case "RSA":
      return isRsaB64(typed);

    default:
      return false;
  }
};

export const isDer = (options: KryptosFrom): options is KryptosFromDer => {
  const typed = options as KryptosFromDer;

  switch (typed.type) {
    case "EC":
      return isEcDer(typed);

    case "oct":
      return isOctDer(typed);

    case "OKP":
      return isOkpDer(typed);

    case "RSA":
      return isRsaDer(typed);

    default:
      return false;
  }
};

export const isJwk = (options: KryptosFrom): options is KryptosFromJwk => {
  const typed = options as KryptosFromJwk;

  switch (typed.kty) {
    case "EC":
      return isEcJwk(typed);

    case "oct":
      return isOctJwk(typed);

    case "OKP":
      return isOkpJwk(typed);

    case "RSA":
      return isRsaJwk(typed);

    default:
      return false;
  }
};

export const isPem = (options: KryptosFrom): options is KryptosFromPem => {
  const typed = options as KryptosFromPem;

  switch (typed.type) {
    case "EC":
      return isEcPem(typed);

    case "oct":
      return isOctPem(typed);

    case "OKP":
      return isOkpPem(typed);

    case "RSA":
      return isRsaPem(typed);

    default:
      return false;
  }
};
