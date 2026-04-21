import type {
  KryptosFrom,
  KryptosFromBuffer,
  KryptosFromJwk,
  KryptosFromString,
} from "../../types/index.js";
import { isAkpB64, isAkpDer, isAkpJwk, isAkpPem } from "./akp/is.js";
import { isEcB64, isEcDer, isEcJwk, isEcPem } from "./ec/is.js";
import { isOctB64, isOctDer, isOctJwk, isOctPem, isOctUtf } from "./oct/is.js";
import { isOkpB64, isOkpDer, isOkpJwk, isOkpPem } from "./okp/is.js";
import { isRsaB64, isRsaDer, isRsaJwk, isRsaPem } from "./rsa/is.js";

export const isB64 = (options: KryptosFrom): options is KryptosFromString => {
  const typed = options as KryptosFromString;

  switch (typed.type) {
    case "AKP":
      return isAkpB64(typed);

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

export const isDer = (options: KryptosFrom): options is KryptosFromBuffer => {
  const typed = options as KryptosFromBuffer;

  switch (typed.type) {
    case "AKP":
      return isAkpDer(typed);

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
    case "AKP":
      return isAkpJwk(typed);

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

export const isPem = (options: KryptosFrom): options is KryptosFromString => {
  const typed = options as KryptosFromString;

  switch (typed.type) {
    case "AKP":
      return isAkpPem(typed);

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

export const isUtf = (options: KryptosFrom): options is KryptosFromString => {
  const typed = options as KryptosFromString;

  switch (typed.type) {
    case "oct":
      return isOctUtf(typed);

    default:
      return false;
  }
};
