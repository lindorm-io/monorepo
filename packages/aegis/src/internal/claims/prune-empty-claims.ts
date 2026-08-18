import type { Dict } from "@lindorm/types";
import { isClaimSatisfied } from "../utils/rules/is-claim-satisfied.js";
import { claimByCoseName, claimByJose } from "./claims-registry.js";

/**
 * Drop the claims whose EMPTY value the registry says carries nothing — the
 * second half of {@link normaliseClaims}, and the payload-side twin of
 * `internal/header/prune-empty-headers.ts`. Both are registry-driven and both run
 * on the write side only; the header one keys by JOSE name alone, because a
 * header bag never reaches an emission boundary cose-keyed.
 *
 * TWO rules, and the registry decides both:
 *
 *   1. A REGISTERED claim is pruned when its value is empty and its
 *      {@link ClaimSpec.whenEmpty} cell says `"prune"`. The cell is required, so
 *      every claim has answered; there is no fallback for a claim to land in.
 *   2. An UNREGISTERED key is NEVER pruned. A raw kit-sign wire dict and an
 *      opaque payload have no registry entry, and aegis does not reshape what it
 *      has not declared — that is what keeps the opaque door honest, and it is
 *      why this replaced a hardcoded protected-key set: the set could only ever
 *      name the exceptions it had thought of.
 *
 * TOP LEVEL only, deliberately — and the reason CHANGED once the registry
 * learned to describe a structure. It used to be that a claim's inner members
 * were undeclared, so recursing here would have been rule 2 broken one level
 * down. A claim whose codec declares `children` now states a `whenEmpty` verdict
 * for each member, and that verdict is honoured where the structure is BUILT
 * (`internal/claims/translate.ts`), not here: the translator is the only place
 * that knows which member a key is, and by the time a bag reaches this boundary
 * it is WIRE-KEYED — a key here is a wire name, and resolving it back to a
 * member would mean re-deriving what the translator has already decided. (The
 * bag is not FLAT: a structured claim's value is a nested object at this
 * boundary. What is true is that this walk visits the TOP LEVEL only.) So the
 * two levels are answered in two places on purpose, and this one still walks the
 * top level alone — which keeps rule 2 intact for the members that remain
 * undeclared (an RFC 9396 `actions` array, an RFC 8417 event payload).
 *
 * The dict is walked, not the registry, so insertion ORDER survives — the wire
 * bytes are order-sensitive and the corpus pins them. The registry is still the
 * authority; it is simply consulted per key rather than iterated.
 *
 * Both wire vocabularies resolve: the JOSE name (`JwtKit.sign` is handed a
 * jose-keyed dict) and the COSE name (`signCwt` a cose-keyed one, where RFC 8392
 * renames `jti` to `cti`). Those are the only two spellings a claims dict reaches
 * the emission boundary in.
 */
export const pruneEmptyClaims = <T extends Dict = Dict>(dict: T): T => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(dict)) {
    const spec = claimByJose(key) ?? claimByCoseName(key);

    // `!isClaimSatisfied`, not a bare `isEmpty`: this is the same emptiness the
    // profile floor asks about, and `is-claim-satisfied.ts` cites this column as
    // agreeing with it — so the two must not be able to drift apart.
    if (spec?.whenEmpty === "prune" && !isClaimSatisfied(value)) continue;

    result[key] = value;
  }

  return result as T;
};
