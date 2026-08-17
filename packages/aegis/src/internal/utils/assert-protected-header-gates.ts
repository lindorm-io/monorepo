import type { Dict } from "@lindorm/types";
import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import { assertAlgorithmMatch } from "./assert-algorithm-match.js";
import { rejectUnknownCritical } from "./reject-unknown-critical.js";

/**
 * ⛔ THE TWO PROTECTED-HEADER GATES, IN ONE FIXED ORDER, FOR EVERY WIRE.
 *
 * Both refuse, and both refuse BEFORE the signature or AEAD cycle, so a hostile
 * header is answered without spending cryptography on it. What the order decides
 * is which refusal a token tripping BOTH gets — and that is observable output, so
 * it is a contract rather than an implementation detail.
 *
 * ⚠ CRIT FIRST — and that is AEGIS POLICY, not a specification requirement.
 * The two wires do not even stand on the same footing, so read the primary text
 * before repeating any stronger claim:
 *
 * - RFC 7515 §4.1.11 says it OUTRIGHT: *"If any of the listed extension Header
 *   Parameters are not understood and supported by the recipient, then the JWS is
 *   invalid."* On JOSE the refusal is spec-mandated.
 * - RFC 9052 §3.1 does NOT. Its `crit` definition says only that the parameter
 *   *"is used to indicate which protected header parameters an application that
 *   is processing a message is required to understand"* — a requirement with no
 *   stated consequence. §3.1's one fatal-error clause is about a DIFFERENT
 *   condition: *"If the 'crit' value list includes a label for which the header
 *   parameter is not in the protected-header-parameters bucket, this is a fatal
 *   error in processing the message"* — a MISPLACED label, not a not-understood
 *   one. It belongs to bullet 1 of `rejectUnknownCritical`'s MALFORMED branch and
 *   nowhere else; do not borrow it for the UNRECOGNISED branch, and never quote
 *   it with a leading ellipsis, which is precisely what hid the antecedent in an
 *   earlier version of this comment. On COSE the refusal is aegis DERIVING
 *   the obvious consequence: a processor required to understand a parameter, and
 *   unable to, cannot claim to have processed the message.
 *
 * Neither document says anything about PRECEDENCE over `alg`. Which refusal a
 * doubly-hostile token receives is unspecified by both.
 *
 * aegis answers `crit`, for reasons that are ours:
 *
 *  1. The crit refusal is what the specification is about — mandated on JOSE,
 *     derived on COSE — while the algorithm-match is aegis's own defence-in-depth
 *     that no RFC asks for at all. Answer the spec's question before ours.
 *  2. A critical extension the reader does not implement is the producer stating
 *     that the header cannot be correctly interpreted without it — so any further
 *     verdict about another parameter's VALUE rests on a reading the producer
 *     already said is insufficient.
 *  3. The weakest of the three, and stated precisely because it is easy to
 *     overstate: crit-first was the majority by CALL SITE (3 of 5 — the three
 *     JOSE kits against `CwsKit.verify` and `verifyCwt`), but a TIE by read path
 *     (`jws`/`jwt`/`jwe` against `cws`/`cwt`/`cwm`, 3–3). It is a tiebreak, not
 *     an argument; 1 and 2 are what carry the decision.
 *
 * ⚠ THIS ORDER WAS NOT SHARED BEFORE, and the two comments that said it was were
 * WRONG. `CwsKit.verify` and `verifyCwt` each carried a note saying the pair had
 * to stay inline "so the two wires cannot drift on when a hostile header is
 * answered" — while the three JOSE kits ran crit→alg and both COSE paths ran
 * alg→crit. They had already drifted, behind comments asserting they could not.
 * Duplication is not a drift guard; it is the drift mechanism. There is one pair
 * now, so there is nothing left to disagree.
 *
 * ⚠ THE SHAPE, counted two ways, because the two numbers differ and mixing them
 * has already produced a wrong claim here: SIX read paths (`jws` `jwt` `jwe`
 * `cws` `cwt` `cwm`) reach THIS PAIR through FOUR call sites — the three JOSE
 * kits plus `verifyCoseStructure`, which serves `CwsKit.verify` and `verifyCwt`,
 * and `verifyCwt` in turn serves BOTH `CwtKit` and `CwmKit`. Unifying the order
 * changed the verdict for THREE formats (`cws`, `cwt`, `cwm`) across TWO code
 * sites. `cwm` is the one that is easy to lose: it has no kit of its own on this
 * path, so a count of files misses it and its refusal changed all the same.
 *
 * ⚠ THOSE NUMBERS COUNT THIS PAIR, NOT `rejectUnknownCritical`, and the two are
 * not the same set — `CweKit.decrypt` calls the crit gate DIRECTLY, as a FIFTH
 * site, and runs no algorithm-match at all. That is not an omission: a
 * COSE_Encrypt0 carries the content encryption in label 1 rather than a
 * key-management `alg` to compare against a configured one, so there is no
 * second gate for an order to be stated between. So `cwe` is a seventh format
 * that refuses a hostile `crit` and simply has no place in this file.
 *
 * ⚠ Both callers must pass the INTEGRITY-PROTECTED header, JOSE-named. On COSE
 * that is the protected bucket alone — the unprotected one is covered by nothing
 * and RFC 9052 §3.1 does not permit `crit` in it. On JOSE the single header IS
 * that header.
 */
export const assertProtectedHeaderGates = ({
  protectedHeader,
  expectedAlgorithm,
  format,
  error,
  algDetails,
  algData,
}: {
  protectedHeader: { crit?: unknown; alg?: unknown } & Dict;
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
  rejectUnknownCritical({ header: protectedHeader, format, error });

  assertAlgorithmMatch({
    actual: protectedHeader.alg as string | undefined,
    expected: expectedAlgorithm,
    format,
    error,
    details: algDetails,
    data: algData,
  });
};
