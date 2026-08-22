import type { IKryptos } from "@lindorm/kryptos";
import { ShaKit } from "@lindorm/sha";
import type { ShaAlgorithm } from "@lindorm/types";
import { coseByJose } from "../header/header-registry.js";
import type { ComputedCertBinding } from "../utils/verify-cert-binding.js";
import type { CoseLabel } from "./cose-label.js";
import { parseCoseCertHash } from "./cose-hash-algorithms.js";

/** The COSE header label a `COSE_CertHash` rides under. RFC 9360 §2. */
const X5T_LABEL = coseByJose("x5t#S256");

/**
 * The `ShaKit` method that recomputes a digest under each algorithm.
 *
 * ⚠ Two things carry the exhaustiveness, both load-bearing: the scrutinee is the
 * `ShaAlgorithm` UNION (TS cannot exhaustiveness-check a `string`), and the
 * declared return type excludes `undefined`, so an unhandled member leaves a
 * reachable end and `TS2366` fires. Widen the return to `string | undefined` and
 * a missing case compiles clean.
 *
 * ⚠ `header/cose-wire-header.ts#coseValueToWire` uses the other form — a `default`
 * binding `const exhaustive: never` — because it returns `… | undefined`, so
 * `TS2366` can never fire there. Which form applies is decided by whether the
 * return type admits `undefined`.
 */
const digestOf = (algorithm: ShaAlgorithm, der: Buffer): string => {
  switch (algorithm) {
    case "SHA1":
      return ShaKit.S1(der);
    case "SHA256":
      return ShaKit.S256(der);
    case "SHA384":
      return ShaKit.S384(der);
    case "SHA512":
      return ShaKit.S512(der);
  }
};

/**
 * RESOLVE A COSE CERTIFICATE BINDING THE DOMAIN HEADER CANNOT CARRY. A conformant
 * issuer may bind with SHA-384 or SHA-512 (RFC 9360 §2, RFC 9054 §3.2), and JOSE
 * registers only two thumbprint parameters (RFC 7515 §4.1.7, RFC 7515 §4.1.8), so
 * `verifyCertBinding` has no string to compare.
 *
 * ⭐ The comparison happens HERE, where both halves exist, and what leaves is a
 * VERDICT rather than a value: this function holds the wire and the key, while
 * `verifyCertBinding` holds the MODE POLICY and stays wire-agnostic. Routing the
 * computed digest through `certificateThumbprint` instead reports a SHA-512 digest
 * under the SHA-256 parameter, RFC 7515 §4.1.8.
 *
 * `undefined` where the mode has nothing to decide: no `x5t`, a malformed
 * `COSE_CertHash`, an algorithm outside `HASH_ALGORITHM`, or one JOSE carries
 * itself — resolving those twice would be two answers to one question.
 *
 * ⚠ THE PROTECTED BUCKET ONLY. A binding the cryptography does not cover is one
 * any holder could rewrite.
 */
export const resolveWideCertBinding = (
  protectedMap: Map<CoseLabel, unknown> | undefined,
  kryptos: IKryptos,
): ComputedCertBinding | undefined => {
  // The ONE structural parse of RFC 9360 §2's CDDL, shared with the codec.
  const parsed = parseCoseCertHash(protectedMap?.get(X5T_LABEL));

  if (parsed === undefined) return undefined;

  const { algorithm, digest } = parsed;

  // A `jose` cell means the domain header already carries this digest, so this
  // path must not answer for it too.
  if (algorithm.jose !== undefined) return undefined;

  const leaf = kryptos.certificate("der")?.chain[0];

  // Asserted and UNPROVABLE — the same state an absent chain puts a SHA-256 one
  // in, and `verifyCertBinding` owns that policy for both.
  if (leaf === undefined) return { algorithm: algorithm.name, matches: undefined };

  return {
    algorithm: algorithm.name,
    // `ShaKit` answers base64url, the spelling both stored digests use.
    matches: digestOf(algorithm.sha, leaf) === Buffer.from(digest).toString("base64url"),
  };
};
