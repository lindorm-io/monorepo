import { KryptosError } from "../../errors/index.js";
import type { KryptosAlgorithm, KryptosCurve, KryptosType } from "../../types/index.js";

type Input = {
  type: KryptosType;
  algorithm: KryptosAlgorithm;
  curve?: KryptosCurve | null;
};

export const resolveSignAlgorithmForCert = (input: Input): KryptosAlgorithm => {
  if (input.type === "oct") {
    throw new KryptosError("symmetric keys cannot have certificates");
  }

  if (input.type === "AKP") {
    if (
      input.algorithm === "ML-DSA-44" ||
      input.algorithm === "ML-DSA-65" ||
      input.algorithm === "ML-DSA-87"
    ) {
      return input.algorithm;
    }
    throw new KryptosError(
      `Unsupported AKP algorithm for X.509 certificate signing: ${String(input.algorithm)}`,
    );
  }

  if (input.type === "RSA") {
    if (
      input.algorithm === "RS256" ||
      input.algorithm === "RS384" ||
      input.algorithm === "RS512"
    ) {
      return input.algorithm;
    }
    return "RS256";
  }

  if (input.type === "EC") {
    if (
      input.algorithm === "ES256" ||
      input.algorithm === "ES384" ||
      input.algorithm === "ES512"
    ) {
      return input.algorithm;
    }
    switch (input.curve) {
      case "P-256":
        return "ES256";
      case "P-384":
        return "ES384";
      case "P-521":
        return "ES512";
      default:
        throw new KryptosError(
          `Cannot derive signing algorithm for EC curve: ${input.curve ?? "unknown"}`,
        );
    }
  }

  if (input.type === "OKP") {
    if (input.curve === "Ed25519" || input.curve === "Ed448") {
      return "EdDSA";
    }
    throw new KryptosError(
      `OKP curve ${input.curve ?? "unknown"} cannot sign X.509 certificates (use ca-signed mode with an Ed25519/Ed448 CA)`,
    );
  }

  throw new KryptosError(
    `Unsupported key type for X.509 certificate signing: ${String(input.type)}`,
  );
};
