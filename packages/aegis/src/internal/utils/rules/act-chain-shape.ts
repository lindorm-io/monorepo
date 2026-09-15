import { isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";
import { isClaimOmitted } from "./is-claim-omitted.js";

/**
 * The VALUE-SHAPE half of the RFC 8693 actor-chain rule, run at the POLICY gate
 * of the profiles that declare it.
 *
 * The claim registry declares `act`/`may_act` as a recursive member set
 * (`internal/claims/act-members.ts`), so the generic walker in
 * `internal/claims/translate.ts` carries the NESTING on its own, in both
 * directions and under every profile. ⚠ `validateActor` below still descends by
 * hand and must: the policy gate hands this rule a plain claims dict, where no
 * walker runs to carry a check down.
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
 * ⚠ IT ANSWERS FIRST AT MINT. Every member in `STRING_MEMBERS` carries a `text`
 * codec and the nested actor an object one, and the walker refuses a value failing
 * either on the WRITE side by itself; on the profiles that carry this rule the
 * policy gate runs BEFORE wire assembly, so at mint this rule answers first for
 * those, with every fault in one report.
 *
 * ⛔ AT VERIFY IT REPORTS NOTHING. It reads what the token read produced, and
 * `internal/claims/translate.ts` has already disposed of every fault it names: a
 * non-object actor is refused at any depth, a `text` member the read cannot decode
 * is dropped rather than carried, and a tail key resolving to a declared member's
 * key is refused. An actor member aegis does not declare is not measured here at
 * all — it rides the open tail, `aud` included. ⇒ Nothing may be moved out of the
 * read on the grounds that this rule would catch it at verify.
 *
 * ⚠ THE DEPTH BOUND IS NOT PART OF THIS RULE. `maxChainDepth` is a VERIFIER's
 * option (`internal/utils/validate-actor.ts`), not a shape fact.
 */

// The two chain ROOTS. Each is validated independently; a token may carry one,
// both or neither.
const CHAIN_CLAIMS = ["act", "mayAct"] as const;

// The actor members that must be a string when the actor names them — every
// DECLARED member but `act`, which is the recursive one.
const STRING_MEMBERS = ["subject", "issuer", "clientId"] as const;

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
