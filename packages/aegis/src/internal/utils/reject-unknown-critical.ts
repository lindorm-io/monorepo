import type { Dict } from "@lindorm/types";
import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import { validateCrit } from "./validate-crit.js";

/**
 * The `crit` enforcement, for BOTH wires.
 *
 * ⚠ THE TWO WIRES DO NOT SAY THE SAME THING, and an earlier version of this
 * paragraph claimed they did ("state the same requirement in the same words …
 * MUST reject the message"). They agree on the DUTY and differ on whether a
 * consequence is written down:
 *
 * - RFC 7515 §4.1.11 states it outright: *"If any of the listed extension Header
 *   Parameters are not understood and supported by the recipient, then the JWS
 *   is invalid."*
 * - RFC 9052 §3.1 states the duty with NO consequence attached: `crit` indicates
 *   *"which protected header parameters an application that is processing a
 *   message is required to understand"*. Its one fatal-error clause is quoted
 *   under bullet 1 below and belongs to a DIFFERENT condition. So the COSE
 *   refusal for a not-understood member is aegis deriving the obvious
 *   consequence — a processor required to understand a parameter, and unable to,
 *   cannot claim to have processed the message — not a quotable mandate.
 *
 * aegis implements no critical extension at all, so EVERY parameter a producer
 * marks critical is unrecognised and the answer is always a refusal. The two
 * checks below only decide which refusal:
 *
 *  1. MALFORMED — `crit` is not a non-empty array of strings, names an
 *     IANA-registered parameter (`crit` is for extensions only), or names a
 *     parameter that is not in the header it was read from. RFC 9052 §3.1 calls
 *     the last one out explicitly, and THIS is the sentence with the fatal-error
 *     clause — note the antecedent, which is the misplaced label and nothing
 *     else: *"If the 'crit' value list includes a label for which the header
 *     parameter is not in the protected-header-parameters bucket, this is a
 *     fatal error in processing the message."* ⛔ Do not lift this quote to
 *     bullet 2; it does not cover a not-understood member.
 *  2. UNRECOGNISED — a well-formed member naming an extension aegis does not
 *     implement. Mandated by RFC 7515 §4.1.11 on JOSE; DERIVED on COSE, per the
 *     note above. No §3.1 sentence says this.
 *
 * ⚠ `header` MUST be the INTEGRITY-PROTECTED header, JOSE-named. On COSE that is
 * the protected bucket alone (the unprotected one carries no crit — the writer
 * refuses to put one there) and the integer labels are already translated back to
 * their JOSE names by the read path, which is what lets one implementation serve
 * both wires. On JOSE the single protected header IS that header.
 */
export const rejectUnknownCritical = ({
  header,
  format,
  error,
}: {
  header: { crit?: unknown } & Dict;
  /** The wire format tag, which namespaces the two error codes. */
  format: TokenFormatTag;
  error: typeof AegisError;
}): void => {
  const name = format.toUpperCase();

  const malformed = validateCrit(header);
  if (malformed) {
    throw new error(`Invalid crit header: ${malformed}`, {
      code: `${format}_invalid_crit`,
      data: { crit: header.crit },
      title: `${name} Invalid Crit`,
      details:
        "The crit header is malformed; it must be a non-empty array of strings naming extension parameters present in the header.",
    });
  }

  const crit = header.crit;
  if (!Array.isArray(crit)) return;

  // `validateCrit` has already refused an empty array, and aegis implements no
  // crit extension, so the FIRST member is the whole answer — there is no
  // subset of the list that could be understood.
  const param = crit[0];

  throw new error(`Unsupported critical header parameter: ${param}`, {
    code: `${format}_unsupported_crit_param`,
    data: { param },
    title: `${name} Unsupported Crit Param`,
    details: `The crit header marks an extension parameter as critical that Aegis does not understand, so the ${name} must be rejected.`,
  });
};
