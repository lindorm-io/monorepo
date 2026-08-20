import type { Dict } from "@lindorm/types";
import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import { assertAlgorithmMatch } from "./assert-algorithm-match.js";
import { rejectUnknownCritical } from "./reject-unknown-critical.js";

/**
 * ⛔ THE TWO PROTECTED-HEADER GATES, IN ONE FIXED ORDER, FOR EVERY WIRE.
 *
 * Both refuse BEFORE the signature or AEAD cycle, so a hostile header is answered
 * without spending cryptography on it. What the order decides is which refusal a
 * token tripping BOTH gets — observable output, so a contract rather than an
 * implementation detail.
 *
 * ⚠ CRIT FIRST, AND THAT IS AEGIS POLICY, not a specification requirement. The
 * two wires do not stand on the same footing:
 *
 * - RFC 7515 §4.1.11 says it OUTRIGHT: *"If any of the listed extension Header
 *   Parameters are not understood and supported by the recipient, then the JWS is
 *   invalid."* On JOSE the refusal is spec-mandated.
 * - RFC 9052 §3.1 does NOT. Its `crit` definition says only that the parameter
 *   *"is used to indicate which protected header parameters an application that
 *   is processing a message is required to understand"* — a requirement with no
 *   stated consequence. ⛔ §3.1's one fatal-error clause is about a DIFFERENT
 *   condition, a MISPLACED label rather than a not-understood one: *"If the
 *   'crit' value list includes a label for which the header parameter is not in
 *   the protected-header-parameters bucket, this is a fatal error in processing
 *   the message"*. It belongs to `rejectUnknownCritical`'s MALFORMED branch and
 *   nowhere else — do not borrow it for the UNRECOGNISED branch, and never quote
 *   it with a leading ellipsis, which hides the antecedent that makes it a
 *   different rule. On COSE the refusal is aegis deriving the obvious
 *   consequence: a processor required to understand a parameter, and unable to,
 *   cannot claim to have processed the message.
 *
 * Neither document says anything about PRECEDENCE over `alg`, so which refusal a
 * doubly-hostile token receives is unspecified by both. aegis answers `crit`:
 *  1. The crit refusal is what the specification is about — mandated on JOSE,
 *     derived on COSE — while the algorithm-match is aegis's own
 *     defence-in-depth that no RFC asks for. Answer the spec's question first.
 *  2. A critical extension the reader does not implement is the producer stating
 *     that the header cannot be correctly interpreted without it, so any further
 *     verdict about another parameter's VALUE rests on a reading the producer
 *     already called insufficient.
 *
 * ⚠ ONE PAIR SERVES SIX READ PATHS. The three JOSE kits reach it directly;
 * `verifyCoseStructure` serves `CwsKit.verify` and `verifyCwt`, and `verifyCwt`
 * in turn serves BOTH `CwtKit` and `CwmKit` — so `cwm` has no kit of its own on
 * this path and a count of files misses it.
 *
 * ⚠ `CweKit.decrypt` CALLS THE CRIT GATE DIRECTLY and runs no algorithm-match,
 * which is not an omission: a COSE_Encrypt0 carries the content encryption in
 * label 1 rather than a key-management `alg` to compare against a configured one,
 * so there is no second gate for an order to be stated between.
 *
 * ⛔ Both callers must pass the INTEGRITY-PROTECTED header, JOSE-named, and the
 * SAME bucket's unregistered params. On COSE that is the protected bucket alone —
 * the unprotected one is covered by nothing and RFC 9052 §3.1 does not permit
 * `crit` in it. On JOSE the single header IS that header.
 */
export const assertProtectedHeaderGates = ({
  protectedHeader,
  unknown,
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
  unknown: Dict;
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
   * JWE wire overrides it because it has always reported the value under `alg`.
   */
  algData?: Dict;
}): void => {
  rejectUnknownCritical({ header: protectedHeader, unknown, declared, format, error });

  assertAlgorithmMatch({
    actual: protectedHeader.alg as string | undefined,
    expected: expectedAlgorithm,
    format,
    error,
    details: algDetails,
    data: algData,
  });
};
