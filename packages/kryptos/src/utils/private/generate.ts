import { KryptosError } from "../../errors";
import {
  EcDer,
  EcGenerate,
  OctDer,
  OctGenerate,
  OkpDer,
  OkpGenerate,
  RsaDer,
  RsaGenerate,
} from "../../types";
import { generateEcKey } from "./ec/generate-key";
import { generateOctKey } from "./oct/generate-key";
import { generateOkpKey } from "./okp/generate-key";
import { generateRsaKey } from "./rsa/generate-key";

type Options = EcGenerate | OctGenerate | OkpGenerate | RsaGenerate;

type Result =
  | Omit<EcDer, "algorithm" | "type" | "use">
  | Omit<OctDer, "algorithm" | "type" | "use">
  | Omit<OkpDer, "algorithm" | "type" | "use">
  | Omit<RsaDer, "algorithm" | "type" | "use">;

export const generateKey = (options: Options): Result => {
  switch (options.type) {
    case "EC":
      return generateEcKey(options);

    case "oct":
      return generateOctKey(options);

    case "OKP":
      return generateOkpKey(options);

    case "RSA":
      return generateRsaKey(options);

    default:
      throw new KryptosError("Invalid key type");
  }
};
