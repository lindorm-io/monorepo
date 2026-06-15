import type { KryptosAlgorithm } from "@lindorm/kryptos";
import { AegisError } from "../../errors/index.js";

/**
 * JOSE algorithm name <-> COSE algorithm label (IANA COSE Algorithms registry).
 * We emit the deprecated-but-universal polymorphic identifiers (RFC 9864
 * deprecates them, but the installed base + @auth0/cose read these); the curve
 * for EdDSA (-8) is resolved from the key, not the label.
 */
const JOSE_TO_COSE: Readonly<Record<string, number>> = {
  // ECDSA
  ES256: -7,
  ES384: -35,
  ES512: -36,
  // EdDSA (Ed25519 / Ed448 — curve from the key)
  EdDSA: -8,
  // RSASSA-PSS
  PS256: -37,
  PS384: -38,
  PS512: -39,
  // RSASSA-PKCS1-v1_5
  RS256: -257,
  RS384: -258,
  RS512: -259,
  // HMAC (for COSE_Mac0)
  HS256: 5,
  HS384: 6,
  HS512: 7,
};

const COSE_TO_JOSE: Readonly<Record<number, string>> = Object.fromEntries(
  Object.entries(JOSE_TO_COSE).map(([alg, label]) => [label, alg]),
);

/** The COSE integer label for a JOSE/kryptos signing or MAC algorithm. */
export const algToCoseLabel = (algorithm: KryptosAlgorithm): number => {
  const label = JOSE_TO_COSE[algorithm];

  if (label === undefined) {
    throw new AegisError(`No COSE algorithm label for "${algorithm}"`, {
      code: "cose_algorithm_not_supported",
      data: { algorithm },
      title: "COSE Algorithm Not Supported",
      details:
        "This signing/MAC algorithm has no mapped COSE label; supported COSE algorithms are ES*/EdDSA/PS*/RS*/HS*.",
    });
  }

  return label;
};

/** The JOSE/kryptos algorithm name for a COSE integer label. */
export const coseLabelToAlg = (label: number): string => {
  const algorithm = COSE_TO_JOSE[label];

  if (algorithm === undefined) {
    throw new AegisError(`No algorithm for COSE label "${label}"`, {
      code: "cose_algorithm_not_supported",
      data: { label },
      title: "COSE Algorithm Not Supported",
      details: "The COSE algorithm label is not one this implementation supports.",
    });
  }

  return algorithm;
};
