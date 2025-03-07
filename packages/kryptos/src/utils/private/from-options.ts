import { KryptosError } from "../../errors";
import { KryptosFormat, KryptosFrom, KryptosOptions } from "../../types";
import {
  createDerFromB64,
  createDerFromDer,
  createDerFromJwk,
  createDerFromPem,
} from "./from";
import { createDerFromUtf } from "./from/der-from-utf";
import { isB64, isDer, isJwk, isPem, isUtf } from "./is";
import { parseJwkOptions, parseStdOptions } from "./parse-options";

export const fromOptions = (format: KryptosFormat, arg: KryptosFrom): KryptosOptions => {
  switch (format) {
    case "b64":
      if (!isB64(arg)) throw new KryptosError("Invalid key format");
      return { ...parseStdOptions(arg), ...createDerFromB64(arg) };

    case "der":
      if (!isDer(arg)) throw new KryptosError("Invalid key format");
      return { ...parseStdOptions(arg), ...createDerFromDer(arg) };

    case "jwk":
      if (!isJwk(arg)) throw new KryptosError("Invalid key format");
      return { ...parseJwkOptions(arg), ...createDerFromJwk(arg) };

    case "pem":
      if (!isPem(arg)) throw new KryptosError("Invalid key format");
      return { ...parseStdOptions(arg), ...createDerFromPem(arg) };

    case "utf":
      if (!isUtf(arg)) throw new KryptosError("Invalid key format");
      return { ...parseStdOptions(arg), ...createDerFromUtf(arg) };

    default:
      throw new KryptosError("Invalid key format");
  }
};
