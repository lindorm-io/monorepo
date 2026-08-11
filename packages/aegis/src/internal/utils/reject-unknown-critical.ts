import type { Dict } from "@lindorm/types";
import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import { validateCrit } from "./validate-crit.js";

/**
 * The `crit` enforcement, for BOTH wires.
 *
 * RFC 7515 §4.1.11 (JOSE) and RFC 9052 §3.1 (COSE) state the same requirement in
 * the same words: `crit` names the integrity-protected header parameters a
 * recipient is REQUIRED to understand, and a recipient that does not understand
 * one MUST reject the message. aegis implements no critical extension at all, so
 * EVERY parameter a producer marks critical is unrecognised and the answer is
 * always a refusal. The two checks below only decide which refusal:
 *
 *  1. MALFORMED — `crit` is not a non-empty array of strings, names an
 *     IANA-registered parameter (`crit` is for extensions only), or names a
 *     parameter that is not in the header it was read from. RFC 9052 §3.1 calls
 *     the last one out explicitly: *"if the crit value list includes a label for
 *     which the header parameter is not in the protected-header-parameters
 *     bucket, this is a fatal error in processing the message."*
 *  2. UNRECOGNISED — a well-formed member naming an extension aegis does not
 *     implement.
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
