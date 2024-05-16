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
import { _generateEcKey } from "./ec/generate-key";
import { _generateOctKey } from "./oct/generate-key";
import { _generateOkpKey } from "./okp/generate-key";
import { _generateRsaKey } from "./rsa/generate-key";

type Options = EcGenerate | OctGenerate | OkpGenerate | RsaGenerate;

type Result =
  | Omit<EcDer, "algorithm" | "type" | "use">
  | Omit<OctDer, "algorithm" | "type" | "use">
  | Omit<OkpDer, "algorithm" | "type" | "use">
  | Omit<RsaDer, "algorithm" | "type" | "use">;

export const _generateKey = (options: Options): Result => {
  switch (options.type) {
    case "EC":
      return _generateEcKey(options);

    case "oct":
      return _generateOctKey(options);

    case "OKP":
      return _generateOkpKey(options);

    case "RSA":
      return _generateRsaKey(options);

    default:
      throw new KryptosError("Invalid key type");
  }
};
