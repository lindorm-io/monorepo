import { KryptosError } from "../../errors";
import {
  GenerateKryptosOptions,
  JweAlgorithm,
  JwtAlgorithm,
  KryptosAlgorithm,
} from "../../types";
import { _getEcSigAlgorithm } from "./ec/algorithm";
import { _getOctSigAlgorithm } from "./oct/algorithm";
import { _getOkpSigAlgorithm } from "./okp/algorithm";
import { _getRsaEncAlgorithm, _getRsaSigAlgorithm } from "./rsa/algorithm";

const _getEncAlgorithm = (options: GenerateKryptosOptions): JweAlgorithm => {
  switch (options.type) {
    case "EC":
      return "ECDH-ES";

    case "oct":
      return "dir";

    case "OKP":
      throw new KryptosError("OKP keys cannot be used for encryption");

    case "RSA":
      return _getRsaEncAlgorithm(options);

    default:
      throw new KryptosError("Unsupported type");
  }
};

const _getSigAlgorithm = (options: GenerateKryptosOptions): JwtAlgorithm => {
  switch (options.type) {
    case "EC":
      return _getEcSigAlgorithm(options);

    case "oct":
      return _getOctSigAlgorithm(options);

    case "OKP":
      return _getOkpSigAlgorithm(options);

    case "RSA":
      return _getRsaSigAlgorithm(options);

    default:
      throw new KryptosError("Unsupported type");
  }
};

export const _getAlgorithm = (options: GenerateKryptosOptions): KryptosAlgorithm => {
  switch (options.use) {
    case "enc":
      return _getEncAlgorithm(options);

    case "sig":
      return _getSigAlgorithm(options);

    default:
      throw new KryptosError("Unsupported use");
  }
};
