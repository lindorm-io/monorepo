import { isArray } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import { isCritEligible } from "./is-crit-eligible.js";

/**
 * Refuse a caller's `crit` naming a parameter aegis does not implement as a
 * critical extension — the NAME-side gate, and the twin of
 * `assert-crit-satisfied.ts`, which is the VALUE-side one. The two are asked in
 * that order because they are different questions: may this name stand in a
 * `crit` at all, and does the bucket carry a value for it.
 *
 * ⚠ IT READS ONE REGISTRY CELL, {@link HeaderSpec.critEligible}, through the ONE
 * predicate the verify side also calls ({@link isCritEligible}). That is the
 * whole design: a token aegis mints is a token aegis verifies, because both
 * directions turn on one column through one expression rather than two branches
 * that can drift. The read side's copy of that condition WOULD have been able to
 * drift undetected — see `reject-unknown-critical.test.ts` for why its
 * disagreement is unobservable through its own door.
 *
 * ⚠ IT TAKES THE CALLER'S WIRE-NAMED BAG, before ANY translation, and that
 * placement is load-bearing twice over:
 *
 *   - it is upstream of `criticalToWire` (JOSE) and `critToCoseLabels` (COSE),
 *     so a member is a JOSE wire name here on BOTH wires and this gate never
 *     holds a COSE label, never needs to know the interop mode, and cannot
 *     become a second opinion about spelling. The writer's one resolver stays
 *     the only one.
 *   - it is therefore what makes the DOMAIN spelling refusable at a WIRE door.
 *     `crit: ["objectId"]` reaches here as `objectId`, which the registry knows
 *     by no JOSE name, so both wires refuse it. Asked one step later, JOSE would
 *     already have remapped the member to `oid` and minted while COSE threw a
 *     label-resolution error — one call, two verdicts, chosen by encoding.
 *
 * It closes the FIRST AND SECOND of RFC 7515 §4.1.11's three producer
 * prohibitions, which the RFC states in one sentence — *"Producers MUST NOT
 * include Header Parameter names defined by this specification or [JWA] for use
 * with JWS, duplicate names, or names that do not occur as Header Parameter
 * names within the JOSE Header in the "crit" list."*
 *
 *   - FIRST (specification-defined names), closed by a SUPERSET rather than by
 *     transcribing the list: every such parameter is `critEligible: false`, and
 *     so is every name aegis does not register at all.
 *   - SECOND (duplicate names), closed by the `Set` in the loop below.
 *
 * The THIRD (a name the header does not carry) is `assert-crit-satisfied.ts` on
 * the write and `validate-crit.ts` on the read — it needs a finished bucket,
 * which is why it is not here.
 *
 * ⚠ THE DUPLICATE GUARD IS PRODUCER-SIDE ONLY, deliberately, and that mirrors
 * the RFC rather than falling short of it: §4.1.11 forbids duplicates to
 * PRODUCERS in the MUST NOT sentence above, while the recipient's own sentence
 * is a MAY — *"Recipients MAY consider the JWS to be invalid […] if any other
 * constraints on its use are violated."* aegis does not take that MAY, so a
 * FOREIGN token carrying a duplicate still verifies. Refusing it on the read
 * would be aegis inventing a mandate the specification declines to give, and it
 * would refuse a token that is not dangerous — merely non-conformant in a way
 * that changes nothing about what the token says.
 *
 * ⚠ The lookup is a `Map` read (`headerByJose`), which is what keeps a
 * CALLER-CONTROLLED member off the prototype chain. `crit: ["toString"]` has
 * twice found a member of `Object.prototype` in this package's crit path; a Map
 * has no chain to walk. `in` on a caller-influenced key is a BANNED construct
 * here.
 *
 * ⚠ A NON-ARRAY `crit` IS NOT THIS FUNCTION'S QUESTION and is passed on
 * untouched. Malformedness is answered by the codec guard on the write and by
 * `validate-crit.ts` on the read; giving it a second verdict here would make the
 * refusal a caller hears depend on which check happened to run first.
 */
export const assertCritEligible = ({
  header,
  format,
  error,
}: {
  /** The caller's WIRE-NAMED protected bag, before any label translation. */
  header: Dict;
  /** The wire format tag, which namespaces the refusal's code. */
  format: TokenFormatTag;
  /** The kit's own error class, so the refusal names the format it came from. */
  error: typeof AegisError;
}): void => {
  const crit = header.crit;

  if (!isArray(crit)) return;

  // ⚠ A `Set`, never `in` or a plain object — the members are CALLER-CONTROLLED
  // and a `Set` has no prototype chain, so `crit: ["toString","toString"]` is
  // counted rather than matched against `Object.prototype`. `in` on a
  // caller-influenced key is a BANNED construct in this package. (It cannot get
  // that far today — the eligibility check above refuses `toString` first — but
  // the membership test must be right on its own terms, not because something
  // upstream happens to shield it.)
  const seen = new Set<string>();

  for (const member of crit) {
    // ELIGIBILITY FIRST, and the order is the contract: `crit: ["alg","alg"]`
    // breaks both prohibitions at once, and the accurate verdict is the one
    // about the NAME — the producer must stop naming `alg` at all, not merely
    // stop naming it twice. Reporting the duplicate would send the caller to the
    // wrong repair.
    if (!isCritEligible(member)) {
      throw new error(`Header parameter "${String(member)}" cannot be marked critical`, {
        code: `${format}_crit_param_not_permitted`,
        data: { crit, parameter: member },
        title: `${format.toUpperCase()} Crit Parameter Not Permitted`,
        details:
          "crit names the extension parameters a recipient must understand before acting on the token, so it may only name parameters this library implements as extensions and spells on this wire. A parameter the specification itself defines is forbidden there outright, and a parameter aegis does not implement would mint a token no aegis recipient accepts.",
      });
    }

    // ⚠ `${format}_invalid_crit`, NOT `_crit_param_not_permitted`, and the split
    // is the fault it names: the member is a parameter a producer MAY mark
    // critical — the LIST is what is malformed. That is the same code the other
    // malformed-crit verdicts carry (`assert-crit-satisfied.ts` on the write,
    // `validate-crit.ts` on the read), so one broken `crit` reads as one kind of
    // fault however it is broken.
    if (seen.has(member)) {
      throw new error(`Header parameter "${member}" is named twice in crit`, {
        code: `${format}_invalid_crit`,
        data: { crit, parameter: member },
        title: `${format.toUpperCase()} Invalid Crit`,
        details:
          "crit lists the extension parameters a recipient must understand, and naming one twice states nothing the first mention did not. A duplicate is forbidden to producers outright, so a token carrying one is malformed for every conformant recipient — including recipients that would otherwise have honoured the extension.",
      });
    }

    seen.add(member);
  }
};
