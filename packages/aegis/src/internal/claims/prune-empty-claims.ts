import { isEmpty } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { claimByCoseName, claimByJose } from "./claims-registry.js";

/**
 * Drop the claims whose EMPTY value the registry says carries nothing — the
 * second half of {@link normaliseClaims}, and the only prune aegis performs.
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
 * TOP LEVEL only, deliberately. A registered claim's inner members are its own
 * declared structure (an RFC 9396 `actions` array, an RFC 8417 event payload, an
 * OIDC `address` member) which the registry does not describe, so recursing would
 * be rule 2 broken one level down.
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

    if (spec?.whenEmpty === "prune" && isEmpty(value)) continue;

    result[key] = value;
  }

  return result as T;
};
