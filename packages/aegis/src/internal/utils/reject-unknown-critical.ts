import { isArray } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import { isCritEligible } from "../header/is-crit-eligible.js";
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
 * ⚠ AEGIS DOES IMPLEMENT ONE CRITICAL EXTENSION, and this file used to say it
 * implemented none — so the refusal below was unconditional and no crit-carrying
 * token aegis minted had ever verified, on either wire. What decides a member now
 * is the header registry's {@link HeaderSpec.critEligible} column, and it is the
 * SAME cell the mint gate refuses on (`internal/header/assert-crit-eligible.ts`):
 * one column, both directions, so a token aegis mints is a token aegis verifies.
 * Today `oid` alone answers `true`.
 *
 * The two checks below decide which refusal a token gets:
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
 *     implement, i.e. one whose registry entry is `critEligible: false` or which
 *     has no registry entry at all. Mandated by RFC 7515 §4.1.11 on JOSE;
 *     DERIVED on COSE, per the note above. No §3.1 sentence says this.
 *
 * ⚠ A PARSE STILL ACCEPTS A CRIT-CARRYING TOKEN, and always did: the keyless
 * decode paths (`internal/wire/jose-token-wire.ts`,
 * `internal/wire/cose-token-wire.ts`) run `validateCrit` alone and never reach
 * here. That is correct — reading a token asserts nothing about understanding it
 * — but it means "aegis refuses an unrecognised crit" is a statement about
 * VERIFY and DECRYPT, never about `aegis.parse`.
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
  if (!isArray(crit)) return;

  // `validateCrit` has refused an empty array, a non-string member, an
  // IANA-registered name, and a member the header does not carry or carries
  // empty. What is left is a well-formed extension name, and the ONE fact that
  // decides it is the registry cell the MINT gate refuses on — read through the
  // SAME predicate that gate uses (`internal/header/is-crit-eligible.ts`), so
  // the two directions cannot express the column differently.
  //
  // ⚠ WHAT THIS BRANCH CAN AND CANNOT BE PROBED FOR. `validateCrit` has already
  // refused every IANA-registered name, and every registered parameter except
  // `oid` is IANA-registered — so on the READ path this loop only ever
  // distinguishes `true` from "no registry entry at all", and a weakened version
  // asking merely "is this registered" is indistinguishable from this one. That
  // is a fact about today's registry, not a property of the design, and it is
  // pinned as such in this file's tests. Sharing the predicate with the mint
  // gate is what makes the distinction testable at all.
  //
  // ⚠ The FIRST NON-ELIGIBLE member is reported, not `crit[0]`: with an eligible
  // extension in the list, naming the first member would report a parameter
  // aegis has no complaint about.
  for (const member of crit) {
    if (isCritEligible(member)) continue;

    throw new error(`Unsupported critical header parameter: ${String(member)}`, {
      code: `${format}_unsupported_crit_param`,
      data: { param: member },
      title: `${name} Unsupported Crit Param`,
      details: `The crit header marks an extension parameter as critical that Aegis does not understand, so the ${name} must be rejected.`,
    });
  }
};
