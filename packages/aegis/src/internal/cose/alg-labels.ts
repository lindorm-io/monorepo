import type { KryptosAlgorithm } from "@lindorm/kryptos";
import { CoseError } from "../../errors/index.js";

/**
 * OFFICIAL JOSE algorithm name <-> COSE algorithm label (IANA COSE Algorithms
 * registry). We emit the deprecated-but-universal polymorphic identifiers (RFC
 * 9864 deprecates them, but the installed base + @auth0/cose read these); the
 * curve for EdDSA (-8) is resolved from the key, not the label. These are the
 * NON-private-use registrations — the interop allowlist (`isOfficialCoseAlg`).
 */
const JOSE_TO_COSE_OFFICIAL: Readonly<Record<string, number>> = {
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

/**
 * PRIVATE-USE COSE labels (< -65536, RFC 9052 §8) for kryptos signing algorithms
 * with no OFFICIAL COSE-RFC registration in our map — currently the ML-DSA
 * (post-quantum) family. Emitted ONLY under proprietary mode (the interop gate
 * refuses them by default); the lenient read path maps them back so a
 * proprietary CWT still round-trips.
 */
const JOSE_TO_COSE_PRIVATE: Readonly<Partial<Record<KryptosAlgorithm, number>>> = {
  "ML-DSA-44": -65537,
  "ML-DSA-65": -65538,
  "ML-DSA-87": -65539,
};

const COSE_TO_JOSE: Readonly<Record<number, string>> = Object.fromEntries(
  [...Object.entries(JOSE_TO_COSE_OFFICIAL), ...Object.entries(JOSE_TO_COSE_PRIVATE)].map(
    ([alg, label]) => [label, alg],
  ),
);

/**
 * Interop gate (D5): true iff the algorithm has an OFFICIAL (non-private-use)
 * COSE label, i.e. it is COSE-RFC compliant. A non-proprietary `sign` refuses
 * anything this returns `false` for.
 */
export const isOfficialCoseAlg = (algorithm: KryptosAlgorithm): boolean =>
  algorithm in JOSE_TO_COSE_OFFICIAL;

/** The COSE integer label for a JOSE/kryptos signing or MAC algorithm. */
export const algToCoseLabel = (algorithm: KryptosAlgorithm): number => {
  const label = JOSE_TO_COSE_OFFICIAL[algorithm] ?? JOSE_TO_COSE_PRIVATE[algorithm];

  if (label === undefined) {
    throw new CoseError(`No COSE algorithm label for "${algorithm}"`, {
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
    throw new CoseError(`No algorithm for COSE label "${label}"`, {
      code: "cose_algorithm_not_supported",
      data: { label },
      title: "COSE Algorithm Not Supported",
      details: "The COSE algorithm label is not one this implementation supports.",
    });
  }

  return algorithm;
};
