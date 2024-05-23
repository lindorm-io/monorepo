import { KryptosError } from "../../errors";
import { KryptosFormat, KryptosFrom, KryptosOptions } from "../../types";
import { createDerFromB64 } from "./from/der-from-b64";
import { createDerFromDer } from "./from/der-from-der";
import { createDerFromJwk } from "./from/der-from-jwt";
import { createDerFromPem } from "./from/der-from-pem";
import { isB64, isDer, isJwk, isPem } from "./is";
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

    default:
      throw new KryptosError("Invalid key format");
  }
};
