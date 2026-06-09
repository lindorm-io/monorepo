import { KryptosError } from "../../errors/index.js";
import type { KryptosAlgorithm, KryptosCurve, KryptosType } from "../../types/index.js";

type Input = {
  type: KryptosType;
  algorithm: KryptosAlgorithm;
  curve?: KryptosCurve | null;
};

export const resolveSignAlgorithmForCert = (input: Input): KryptosAlgorithm => {
  if (input.type === "oct") {
    throw new KryptosError("symmetric keys cannot have certificates", {
      code: "symmetric_key_certificate_unsupported",
      title: "Symmetric Key Certificate Unsupported",
      details: "Symmetric (oct) keys cannot be used to sign or carry X.509 certificates.",
      data: { type: input.type },
    });
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
      {
        code: "unsupported_certificate_sign_algorithm",
        title: "Unsupported Certificate Sign Algorithm",
        details: `The AKP algorithm "${String(input.algorithm)}" is not supported for X.509 certificate signing.`,
        data: { type: input.type, algorithm: input.algorithm },
      },
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
          {
            code: "unsupported_certificate_sign_curve",
            title: "Unsupported Certificate Sign Curve",
            details: `The EC curve "${input.curve ?? "unknown"}" cannot be mapped to an X.509 certificate signing algorithm.`,
            data: { type: input.type, curve: input.curve ?? null },
          },
        );
    }
  }

  if (input.type === "OKP") {
    if (input.curve === "Ed25519" || input.curve === "Ed448") {
      return "EdDSA";
    }
    throw new KryptosError(
      `OKP curve ${input.curve ?? "unknown"} cannot sign X.509 certificates (use ca-signed mode with an Ed25519/Ed448 CA)`,
      {
        code: "unsupported_certificate_sign_curve",
        title: "Unsupported Certificate Sign Curve",
        details: `The OKP curve "${input.curve ?? "unknown"}" cannot sign X.509 certificates; use ca-signed mode with an Ed25519 or Ed448 CA.`,
        data: { type: input.type, curve: input.curve ?? null },
      },
    );
  }

  throw new KryptosError(
    `Unsupported key type for X.509 certificate signing: ${String(input.type)}`,
    {
      code: "unsupported_certificate_sign_key_type",
      title: "Unsupported Certificate Sign Key Type",
      details: `The key type "${String(input.type)}" is not supported for X.509 certificate signing.`,
      data: { type: input.type },
    },
  );
};
