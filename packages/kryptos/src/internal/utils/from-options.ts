import { KryptosError } from "../../errors/index.js";
import type { KryptosFormat, KryptosFrom, KryptosOptions } from "../../types/index.js";
import { createDerFromB64 } from "./from/der-from-b64.js";
import { createDerFromDer } from "./from/der-from-der.js";
import { createDerFromJwk } from "./from/der-from-jwk.js";
import { createDerFromPem } from "./from/der-from-pem.js";
import { createDerFromUtf } from "./from/der-from-utf.js";
import { isB64, isDer, isJwk, isPem, isUtf } from "./is.js";
import { parseJwkOptions, parseStdOptions } from "./parse-options.js";

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
