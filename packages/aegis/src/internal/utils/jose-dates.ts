import type { Dict } from "@lindorm/types";
import { JwtError } from "../../errors/index.js";
import { CLAIM_SPECS, claimsWith, joseName } from "../claims/claims-registry.js";
import { isNotStated } from "../claims/is-not-stated.js";
import { isNumericDate } from "../claims/is-numeric-date.js";
import { codecFor } from "../registry/param-spec.js";

const NUMERIC_DATE_SPECS = CLAIM_SPECS.filter(
  (spec) => codecFor(spec, "jose").kind === "date",
);

const TEMPORAL_SPECS = claimsWith("temporal");

/**
 * Convert a JOSE wire payload's NumericDate temporal claims to `Date`s for the
 * temporal/identity matchers. The COSE claim codec already decodes them inside
 * the kit, so this is what puts both wires in the same shape before the shared
 * matcher pass — and it is deliberately NOT applied to the payload a result
 * reports, which stays exactly as the wire carried it.
 *
 * Every NumericDate claim the registry declares is checked, and one stated as
 * anything but a number of seconds since the epoch that a date can hold is
 * refused; only the temporal claims are lifted. An absent or `null` temporal
 * claim lifts to `undefined`, so the matchers see "not present"; `0` is the
 * epoch (RFC 7519 §2).
 */
export const withJoseDates = (payload: Dict): Dict => {
  const invalid = NUMERIC_DATE_SPECS.map(joseName).filter(
    (name) => !isNotStated(payload[name]) && !isNumericDate(payload[name]),
  );

  if (invalid.length > 0) {
    throw new JwtError("Malformed NumericDate claim", {
      code: "jwt_claims_invalid",
      data: { invalid },
      title: "Malformed NumericDate Claim",
      details:
        "One or more NumericDate claims hold something other than a number of seconds since the epoch that a date can hold, so the instant cannot be read (RFC 7519 §2); see the invalid list for the claim keys.",
    });
  }

  return {
    ...payload,
    ...Object.fromEntries(
      TEMPORAL_SPECS.map((spec) => {
        const value = payload[joseName(spec)];

        return [
          joseName(spec),
          isNumericDate(value) ? new Date(value * 1000) : undefined,
        ];
      }),
    ),
  };
};
