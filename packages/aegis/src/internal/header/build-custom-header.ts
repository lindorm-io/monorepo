import { isUndefined } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { AegisError } from "../../errors/index.js";
import { headerByJose } from "./header-registry.js";
import { isSpecDefinedHeaderParam } from "./is-spec-defined-header-param.js";

/**
 * Validate ONE caller `custom` bucket and return the entries that reach the wire.
 * The ONE place either wire decides whether a key may ride as an unregistered
 * header parameter — `build-jose-header.ts` over `custom.header`,
 * `build-cose-headers.ts` over both COSE buckets.
 *
 * ⚠ THE TWO REFUSALS ARE WHAT KEEPS `header` THE ONLY DOOR FOR A REGISTERED
 * PARAMETER. Without them `custom` is an override door: `alg` written there makes
 * the assembled header describe crypto that did not happen, and `cty` travels raw
 * past the registry codec that shapes every other emission of it.
 *
 *   - a KIT-OWNED name (the kit's `KitCapabilities.reserved` row) throws
 *     `header_kit_owned_in_custom`. Checked FIRST: it is a SUBSET of the next
 *     refusal, and "put it in `header`" would send the caller to a bag whose type
 *     Omits it ({@link KitOwnedHeaderParam}).
 *   - any other name A SPECIFICATION DEFINES throws `header_registered_in_custom`,
 *     whether aegis implements it or not ({@link isSpecDefinedHeaderParam}). One
 *     aegis implements belongs in `header`; one it does not belongs nowhere,
 *     because a conformant reader would give it its published meaning while aegis
 *     honoured none of it.
 *
 * ⚠ THE SECOND REFUSAL READS THE SAME PREDICATE `validate-crit.ts` DOES. Two
 * separate lists disagree, and a name `custom` admits while `crit` refuses mints a
 * token aegis reads back as MALFORMED. ⇒ No `crit` aegis mints is malformed to
 * aegis's own read gate — and that is ALL the shared predicate buys: the verifier's
 * DECLARATION is a separate question and is still required
 * (`internal/utils/reject-unknown-critical.ts`).
 *
 * ⚠ `crit` NEEDS NO RULE HERE — it is registered, so the second refusal answers
 * `custom.unprotected.crit` on its own. `build-cose-headers.ts` rule 1a answers it
 * FIRST regardless: RFC 9052 §3.1 is a fact about the WIRE and this file's rule is
 * aegis's own split policy, so the wire's constraint is what a caller hears.
 *
 * ⚠ A VALUE IS NOT SHAPED, only `undefined` is dropped. An unregistered parameter
 * has no registry row, so there is no codec and no `whenEmpty` cell — an empty
 * string is what the caller asked to write. The `undefined` drop is the one rule
 * that holds without a row.
 *
 * ⚠ `Object.keys`/`Object.entries`, NEVER `in`: every key here is
 * CALLER-CONTROLLED, and the registry lookup is a `Map` read, so a `toString` key
 * resolves to no spec rather than to `Object.prototype`.
 *
 * ⛔ THE BAG IT BUILDS IS `Object.create(null)` — the ASSIGNMENT half of the same
 * rule. `bag["__proto__"] = value` on a plain object sets the prototype instead of
 * the parameter, so the caller's request vanishes. The read side answers it the
 * same way (`internal/utils/jose-header.ts`, `cose-wire-header.ts`), which is what
 * lets a `__proto__` custom parameter round-trip at all.
 */
export const buildCustomHeader = ({
  custom,
  owned,
  bucket,
  error,
}: {
  /** ONE caller `custom` bucket, verbatim from the kit's options. */
  custom: Record<string, unknown> | undefined;
  /** The kit's `KitCapabilities.reserved` row, as a set. */
  owned: ReadonlySet<string>;
  /**
   * Which bucket this bag is, so a refusal names the field the caller wrote:
   * `header` on JOSE, `protected`/`unprotected` on COSE — the two envelopes spell
   * their buckets differently (`types/header/wire-envelope.ts`).
   */
  bucket: "header" | "protected" | "unprotected";
  /** The kit's own error class, so the refusal names the format it came from. */
  error: typeof AegisError;
}): Dict => {
  const bag: Dict = Object.create(null);

  if (!custom) return bag;

  for (const [key, value] of Object.entries(custom)) {
    if (owned.has(key)) {
      throw new error(`Header parameter "${key}" is key-derived and cannot be set`, {
        code: "header_kit_owned_in_custom",
        data: { parameter: key, bucket },
        title: "Kit-Owned Header Parameter In Custom",
        details:
          "This header parameter is derived from the signing/encrypting key or computed by the crypto operation, so the kit always sets it; no caller bag accepts it, custom included.",
      });
    }

    if (headerByJose(key) !== undefined || isSpecDefinedHeaderParam(key)) {
      throw new error(
        `Header parameter "${key}" is specification-defined and cannot be custom`,
        {
          code: "header_registered_in_custom",
          data: { parameter: key, bucket },
          title: "Specification-Defined Header Parameter In Custom",
          details:
            "The custom bag carries parameters no specification defines. This one is defined — by aegis's header registry, by the IANA JOSE header parameter registry, or both. A parameter aegis implements belongs in the header bag, where its value codec and its bucket placement apply; one aegis does not implement cannot be carried at all, because a reader would give it the meaning its specification assigns while nothing here honoured it.",
        },
      );
    }

    if (isUndefined(value)) continue;

    bag[key] = value;
  }

  return bag;
};
