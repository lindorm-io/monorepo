import type { IKryptos } from "@lindorm/kryptos";
import { ShaKit } from "@lindorm/sha";
import type { ShaAlgorithm } from "@lindorm/types";
import { coseByJose } from "../header/header-registry.js";
import type { ComputedCertBinding } from "../utils/verify-cert-binding.js";
import type { CoseLabel } from "./cose-label.js";
import { parseCoseCertHash } from "./cose-hash-algorithms.js";

/** The COSE header label a `COSE_CertHash` rides under (RFC 9360 §2 `x5t`). */
const X5T_LABEL = coseByJose("x5t#S256");

/**
 * The `ShaKit` method that recomputes a digest under each algorithm.
 *
 * ⚠ TWO THINGS CARRY THE EXHAUSTIVENESS, and both are load-bearing: the scrutinee
 * is the `ShaAlgorithm` UNION (TS cannot exhaustiveness-check a `string`), and the
 * DECLARED RETURN TYPE excludes `undefined`, so an unhandled member leaves a
 * reachable end and `TS2366` fires. MEASURED both ways: deleting a case fails the
 * build; deleting a case AND widening the return type to `string | undefined`
 * compiles clean.
 *
 * ⚠ `header/cose-wire-header.ts#coseValueToWire` reaches the same guarantee by the
 * OTHER route — a `default` binding `const exhaustive: never` — and the reason is
 * visible in its signature: it returns `… | undefined`, so `TS2366` can never fire
 * there and the explicit `never` is the only backstop available (`noImplicitReturns`
 * is off repo-wide). Neither form is the house idiom to the exclusion of the other;
 * which one applies is decided by whether the return type admits `undefined`.
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
 * RESOLVE A COSE CERTIFICATE BINDING THE DOMAIN HEADER CANNOT CARRY.
 *
 * RFC 9360 §2's `COSE_CertHash = [ hashAlg, hashValue ]` admits any algorithm from
 * the COSE Algorithms registry, and RFC 9054 marks SHA-384 (`-43`) and SHA-512
 * (`-44`) `Recommended: Yes` — so a conformant issuer may bind with either. JOSE
 * registers exactly two thumbprint parameters (RFC 7517 §4.8/§4.9), so neither has
 * a domain header field to travel in and `verifyCertBinding` has no string to
 * compare.
 *
 * ⭐ SO THE COMPARISON HAPPENS HERE, WHERE BOTH HALVES EXIST, and what leaves is a
 * VERDICT rather than a value. This function holds the wire (it reads a raw COSE
 * label map) and the key (it hashes the leaf's DER); `verifyCertBinding` holds the
 * MODE POLICY and stays wire-agnostic — it is told whether a binding matched, never
 * how the wire spelled one. Routing the computed digest through
 * `certificateThumbprint` instead would report a SHA-512 digest under a parameter
 * RFC 7515 §4.1.8 defines as SHA-256.
 *
 * `undefined` where there is nothing for the mode to decide about: no `x5t`, a
 * malformed `COSE_CertHash`, an algorithm outside `HASH_ALGORITHM`, or one JOSE
 * carries itself — SHA-256 and SHA-1 ride the domain header and are compared as
 * strings by `verifyCertBinding`, so resolving them twice would be two answers to
 * one question.
 *
 * ⚠ THE PROTECTED BUCKET ONLY. A binding the signature (or, for a COSE_Encrypt0,
 * the AAD) does not cover is one any holder could rewrite, so the caller passes
 * the bucket its cryptography authenticated and never the unprotected one.
 */
export const resolveWideCertBinding = (
  protectedMap: Map<CoseLabel, unknown> | undefined,
  kryptos: IKryptos,
): ComputedCertBinding | undefined => {
  // THE ONE structural parse of RFC 9360 §2's CDDL, shared with the codec —
  // `cose-hash-algorithms.ts`. `undefined` covers an absent `x5t`, a malformed
  // `COSE_CertHash`, and an algorithm the table does not carry.
  const parsed = parseCoseCertHash(protectedMap?.get(X5T_LABEL));

  if (parsed === undefined) return undefined;

  const { algorithm, digest } = parsed;

  // A `jose` cell means JOSE carries this digest, so the domain header already has
  // it and this path must not answer for it too.
  if (algorithm.jose !== undefined) return undefined;

  const leaf = kryptos.certificate("der")?.chain[0];

  // The binding is asserted and UNPROVABLE — the same state an absent chain puts
  // a SHA-256 one in, and `verifyCertBinding` owns that policy for both.
  if (leaf === undefined) return { algorithm: algorithm.name, matches: undefined };

  return {
    algorithm: algorithm.name,
    // `ShaKit` answers base64url, which is the spelling both stored digests use,
    // so the comparison is between two encodings of the same bytes.
    matches: digestOf(algorithm.sha, leaf) === Buffer.from(digest).toString("base64url"),
  };
};
