import type { KryptosAlgorithm } from "@lindorm/kryptos";
import { CoseError } from "../../errors/index.js";
import { ownEntry } from "./own-entry.js";

/**
 * OFFICIAL JOSE algorithm name <-> COSE algorithm label — the non-private-use
 * registrations behind `isOfficialCoseAlg`.
 *
 * ⚠ aegis emits the POLYMORPHIC identifiers, which RFC 9864 deprecates, because
 * the installed base and @auth0/cose read those. The EdDSA curve is therefore
 * resolved from the KEY, not from the label.
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
  // ML-DSA — RFC 9964 §5
  "ML-DSA-44": -48,
  "ML-DSA-65": -49,
  "ML-DSA-87": -50,
};

const COSE_TO_JOSE: Readonly<Record<number, string>> = Object.fromEntries(
  Object.entries(JOSE_TO_COSE_OFFICIAL).map(([alg, label]) => [label, alg]),
);

// ⚠ Both tables are read through `ownEntry`, never indexed directly: a plain index
// resolves an `Object.prototype` member name, so `table["toString"]` is a FUNCTION
// that reaches the CBOR encoder as an alg label. See own-entry.ts.

/**
 * Interop gate: true iff the algorithm has an OFFICIAL (non-private-use) COSE
 * label. A non-proprietary `sign` refuses anything this returns `false` for.
 *
 * ⚠ Every kryptos signing/MAC algorithm is registered, so this gate does not fire
 * for any real key; the enc-side (AES-CBC-HMAC) gate exercises the mechanism.
 */
export const isOfficialCoseAlg = (algorithm: KryptosAlgorithm): boolean =>
  ownEntry(JOSE_TO_COSE_OFFICIAL, algorithm) !== undefined;

/** The COSE integer label for a JOSE/kryptos signing or MAC algorithm. */
export const algToCoseLabel = (algorithm: KryptosAlgorithm): number => {
  const label = ownEntry(JOSE_TO_COSE_OFFICIAL, algorithm);

  if (label === undefined) {
    throw new CoseError(`No COSE algorithm label for "${algorithm}"`, {
      code: "cose_algorithm_not_supported",
      data: { algorithm },
      title: "COSE Algorithm Not Supported",
      details:
        "This signing/MAC algorithm has no mapped COSE label; supported COSE algorithms are ES*/EdDSA/PS*/RS*/HS*/ML-DSA-*.",
    });
  }

  return label;
};

/** The JOSE/kryptos algorithm name for a COSE integer label. */
export const coseLabelToAlg = (label: number): string => {
  const algorithm = ownEntry(COSE_TO_JOSE, label);

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
