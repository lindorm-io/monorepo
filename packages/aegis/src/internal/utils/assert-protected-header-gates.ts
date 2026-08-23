import type { Dict } from "@lindorm/types";
import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import { assertAlgorithmMatch } from "./assert-algorithm-match.js";
import { rejectUnknownCritical } from "./reject-unknown-critical.js";

/**
 * ⛔ THE TWO PROTECTED-HEADER GATES, IN ONE FIXED ORDER.
 *
 * Both refuse BEFORE the signature or AEAD cycle, so a hostile header is answered
 * without spending cryptography on it. What the order decides is which refusal a
 * token tripping BOTH gets — observable output, so a contract rather than an
 * implementation detail.
 *
 * ⚠ CRIT FIRST, AND THAT IS AEGIS POLICY — neither RFC 7515 §4.1.11 nor
 * RFC 9052 §3.1 states a precedence over `alg`. aegis answers `crit` because a
 * critical extension the reader does not implement is the producer saying the
 * header cannot be correctly interpreted without it, so any verdict about another
 * parameter's VALUE rests on a reading the producer already called insufficient.
 * The algorithm-match is aegis's own defence-in-depth.
 *
 * ⛔ A caller must pass the INTEGRITY-PROTECTED header, JOSE-named, and the
 * SAME bucket's custom params. On COSE that is the protected bucket alone; the
 * unprotected one is covered by nothing. On JOSE the single header IS that header.
 */
export const assertProtectedHeaderGates = ({
  protectedHeader,
  custom,
  declared,
  expectedAlgorithm,
  format,
  error,
  algDetails,
  algData,
}: {
  protectedHeader: { crit?: unknown; alg?: unknown } & Dict;
  /**
   * The same bucket's params no registry row answers for — a `crit` may name one
   * ({@link rejectUnknownCritical}).
   */
  custom: Dict;
  /**
   * The custom critical parameters the CALLER takes responsibility for — its
   * `crit` verify/decrypt option, forwarded verbatim to
   * {@link rejectUnknownCritical}.
   */
  declared: ReadonlyArray<string> | undefined;
  /** The algorithm of the configured key. */
  expectedAlgorithm: string;
  /** The wire format tag, which namespaces both refusals. */
  format: TokenFormatTag;
  error: typeof AegisError;
  /**
   * What the algorithm the header names is being compared AGAINST, in the wire's
   * own words — a signing algorithm, a key-management one, or a COSE protected
   * header's. The three are different facts, so they keep different wording.
   */
  algDetails: string;
  /**
   * The algorithm refusal's `data` bag. Defaults to `{ algorithm: actual }`; the
   * JWE wire overrides it to report the value under `alg`.
   */
  algData?: Dict;
}): void => {
  rejectUnknownCritical({ header: protectedHeader, custom, declared, format, error });

  assertAlgorithmMatch({
    actual: protectedHeader.alg as string | undefined,
    expected: expectedAlgorithm,
    format,
    error,
    details: algDetails,
    data: algData,
  });
};
