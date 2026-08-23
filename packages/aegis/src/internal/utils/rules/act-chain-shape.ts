import { isObject, isArray, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";
import { isClaimOmitted } from "./is-claim-omitted.js";

/**
 * The VALUE-SHAPE remainder of the RFC 8693 actor-chain rule.
 *
 * The claim registry declares `act`/`may_act` as a recursive member set
 * (`internal/claims/act-members.ts`), so the generic walker in
 * `internal/claims/translate.ts` carries the NESTING on its own, in both
 * directions and under every profile. ⚠ `validateActor` below still descends by
 * hand and must: the rules it carries are not in the walker, so there is nothing
 * there to carry them down.
 *
 * ⛔⛔ THERE IS NO MEMBER ALLOWLIST, AND NOTHING REPLACES IT. The registry
 * declares the actor set OPEN (`open: "verbatim"`) — RFC 8693 §4.1, RFC 8693 §4.4
 * — so an undeclared actor member is CARRIED. Do NOT add one here or make the
 * walker refuse an undeclared member: the same walker serves the OIDC Core §5.1.1
 * `address` and the RFC 9396 `authorization_details` element, so closing it
 * breaks all three conformances at once. What the walker DOES refuse is two
 * members resolving to the SAME key, so a look-alike cannot displace a declared
 * one.
 *
 * ⛔ THE VALUE-SHAPE RULES ARE NOT SUBSUMED, AND THAT IS WHY THIS FILE EXISTS.
 * The walker's disposal for a value it cannot describe is a DROP, not a refusal:
 * a non-object actor walks to `undefined` and the claim is left off, and a member
 * whose value fails its own codec is skipped by `encodeIfReadable`'s probe read. So
 * `act: "service-1"` and `act: { subject: 1 }` would both mint a token — the
 * second carrying `act: {}`, an actor that identifies nobody — where here they
 * are refused with the position named.
 *
 * ⚠ THE DEPTH BOUND IS NOT PART OF THIS RULE. `maxChainDepth` is a VERIFIER's
 * option (`internal/utils/validate-actor.ts`), not a shape fact.
 */

// The two chain ROOTS. Each is validated independently; a token may carry one,
// both or neither.
const CHAIN_CLAIMS = ["act", "mayAct"] as const;

// The actor members that must be a string when the actor names them. `audience`
// is not among them (RFC 7519 §4.1.3) and `act` is the recursive one.
const STRING_MEMBERS = ["subject", "issuer", "clientId"] as const;

/**
 * `aud` inside an actor, validated only when the actor NAMES it. RFC 7519 §4.1.3.
 *
 * ⚠ IT CHECKS THE ELEMENTS: `isArray` alone admits `audience: [1, 2]` while the
 * message beside it promises an array of strings, and a predicate that admits
 * what its own message forbids is worse than no predicate.
 */
const validateAudience = (
  audience: unknown,
  path: string,
  invalid: Array<InvalidEntry>,
): void => {
  if (isClaimOmitted(audience)) return;
  if (isString(audience)) return;
  if (isArray(audience) && audience.every(isString)) return;

  invalid.push({
    key: `${path}.audience`,
    message: `"${path}.audience" must be a string or array of strings`,
  });
};

const validateActor = (
  actor: unknown,
  path: string,
  invalid: Array<InvalidEntry>,
): void => {
  if (!isObject(actor)) {
    invalid.push({ key: path, message: `"${path}" must be an object` });
    return;
  }

  for (const member of STRING_MEMBERS) {
    if (isClaimOmitted(actor[member])) continue;
    if (isString(actor[member])) continue;

    invalid.push({
      key: `${path}.${member}`,
      message: `"${path}.${member}" must be a string`,
    });
  }

  validateAudience(actor.audience, path, invalid);

  if (isClaimOmitted(actor.act)) return;

  validateActor(actor.act, `${path}.act`, invalid);
};

/**
 * Validate the VALUE SHAPE of each member the actor names, at every depth of each
 * chain present. Domain-keyed: `mayAct`, not the wire `may_act`. RFC 8693.
 */
export const actChainShape = (claims: Dict): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  for (const claim of CHAIN_CLAIMS) {
    if (isClaimOmitted(claims[claim])) continue;

    validateActor(claims[claim], claim, invalid);
  }

  return invalid;
};
