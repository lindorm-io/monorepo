import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import { isClaimSatisfied } from "../utils/rules/is-claim-satisfied.js";
import { claimByCoseName, claimByJose } from "./claims-registry.js";

/**
 * REFUSE the claims whose EMPTY value the registry says cannot be disposed of at
 * all — the refusing step of {@link normaliseClaims}, and the sibling of
 * `prune-empty-claims.ts`. Two functions over ONE column
 * ({@link ClaimSpec.whenEmpty}), read through the same pair of lookups.
 *
 * ⚠ `isClaimSatisfied`, NOT a bare `isEmpty`: this is the same emptiness the
 * prune asks about (`prune-empty-claims.ts`) and the same one a profile `required`
 * rule asks about (`internal/utils/rules/require-present.ts`), so the emission
 * verdict and the profile floor cannot drift apart.
 *
 * ⭐ `AegisDomainError` carrying the claim's DOMAIN name, because the profile floor
 * refuses the same empty value in the same class and the same vocabulary
 * (`internal/profiles/enforce-policy.ts` throws `AegisDomainError`, and
 * `require-present.ts` names the claim by the domain-keyed rule list). The floor
 * only speaks about claims some profile NAMES, so which of the two layers answers
 * a given call depends on the profile the caller registered — and a caller
 * choosing a profile must not thereby choose an error class.
 *
 * ⚠ TOP LEVEL and BOTH WIRE VOCABULARIES, like the prune: a claims dict reaches
 * emission jose-keyed (`JwtKit.sign`) or cose-keyed (`internal/cose/sign-cwt.ts`),
 * and `jti`/`cti` is the one claim those two spellings diverge on (RFC 8392
 * §3.1.7). An UNREGISTERED key is never refused — it has answered nothing.
 *
 * ⚠ WRITE SIDE ONLY, like the prune. A read reports what a producer WROTE.
 *
 * pinned: refuse-empty-claims.test.ts.
 */
export const refuseEmptyClaims = (dict: Dict): void => {
  for (const [key, value] of Object.entries(dict)) {
    const spec = claimByJose(key) ?? claimByCoseName(key);

    if (spec?.whenEmpty !== "refuse") continue;
    if (isClaimSatisfied(value)) continue;

    throw new AegisDomainError(`Claim "${spec.domain}" carries no value`, {
      code: "claim_empty_value",
      data: { claim: spec.domain, whenEmpty: "refuse" },
      title: "Claim Carries No Value",
      details:
        "This claim states something the recipient acts on, so an empty one can be neither emitted nor removed: dropping it turns an unsatisfiable statement into no statement at all, and emitting it mints a token asserting something the issuer cannot have meant. The value has to be supplied, or the claim left out.",
    });
  }
};
