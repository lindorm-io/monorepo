import { isObject, isArray, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";
import { isClaimOmitted } from "./is-claim-omitted.js";

/**
 * ⚠⚠ THIS RULE IS THE REMAINDER OF A LARGER ONE, AND THE REMAINDER IS THE POINT.
 *
 * It used to enforce FIVE facts about the RFC 8693 actor chain. The claim
 * registry now declares `act`/`may_act` as a recursive member set
 * (`internal/claims/act-members.ts`), and of the five exactly ONE is subsumed:
 *
 *   - THE RECURSION, subsumed — as a DECLARATION, not as a code path. The
 *     registry states the nesting once (`act`'s member set names itself), so the
 *     generic walker in `internal/claims/translate.ts` descends on its own, in
 *     BOTH directions and under every profile including none, where this rule
 *     only ever runs for the three that name it. ⚠ `validateActor` below STILL
 *     descends by hand, and must: the three rules it carries are not in the
 *     walker, so there is nothing there to carry them down. What the declaration
 *     removed is the need for a SECOND statement of the nesting — not this
 *     function's own descent, which goes when its rules do.
 *
 * ⛔⛔ THE MEMBER ALLOWLIST IS NOT SUBSUMED — IT IS DELETED, ON PURPOSE, AND
 * NOTHING REPLACES IT. `PERMITTED_MEMBERS` refused an actor member outside a
 * fixed five. The registry declares the actor set **OPEN** (`open: "verbatim"`),
 * because RFC 8693 §4.1 defines the members as "claims that identify the actor"
 * and §4.4 names `email` as one, so an undeclared actor member is now CARRIED.
 * ⛔ Do NOT "restore" the allowlist here or make the walker refuse an undeclared
 * member: the same walker serves the OIDC Core §5.1.1 `address` and the RFC 9396
 * `authorization_details` element, and closing it would break all three
 * conformances at once. What DOES survive of that rule is narrower and lives in
 * the walker: two members that resolve to the SAME key are refused, so a
 * look-alike cannot displace a declared one.
 *
 * ⛔ THE OTHER THREE ARE **NOT** SUBSUMED, AND THAT IS WHY THIS FILE SURVIVES.
 * The walker's disposal for a value it cannot describe is a DROP, not a refusal:
 * a non-object actor walks to `undefined` and the claim is left off, a member
 * whose value fails its own codec is skipped by `encodeMember`'s probe read. So
 * `act: "service-1"` and `act: { subject: 1 }` would both mint a token — the
 * second one carrying `act: {}`, an actor that identifies nobody — where today
 * they are refused with the position named. Turning the walker's drop into a
 * refusal is a change to every structured claim in both directions (and cuts
 * across the top-level asymmetry recorded in `translate.ts`), so it is not made
 * as a side effect of migrating one claim. Until it is, these three live here.
 *
 * ⚠ THE DEPTH BOUND WAS NEVER PART OF THIS RULE. `maxChainDepth` is a VERIFIER's
 * option (`internal/utils/validate-actor.ts`), not a shape fact — how far a
 * credential may travel is a deployment's policy, and a member set could not
 * express it in any case.
 */

// The two chain ROOTS. Each is validated independently; a token may carry one,
// both or neither.
const CHAIN_CLAIMS = ["act", "mayAct"] as const;

// The actor members that must be a string when the actor names them. `audience`
// is not among them — RFC 7519 §4.1.3 defines `aud` as string-OR-array — and
// `act` is the recursive one.
const STRING_MEMBERS = ["subject", "issuer", "clientId"] as const;

/**
 * `aud` inside an actor, validated only when the actor NAMES it.
 *
 * ⚠ IT CHECKS THE ELEMENTS, and it did not before — `isArray` alone accepted
 * `audience: [1, 2]` while the message beside it promised "array of strings". A
 * predicate that admits what its own message forbids is worse than no predicate:
 * a reader takes the message as the contract, and the one thing that would have
 * told them otherwise is the thing agreeing with them. RFC 7519 §4.1.3 defines
 * `aud` as "a StringOrURI value" or "an array of case-sensitive strings", so the
 * message was right and the check was wrong.
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
 * RFC 8693 — `act`/`mayAct` are recursive actor objects. Validates the VALUE
 * SHAPE of each member the actor names, at every depth of each chain present.
 * (Domain-keyed: `mayAct`, not the wire `may_act`.) WHICH members an actor may
 * name is not this rule's business and is not anybody's: the registry declares the
 * set OPEN — see the file docstring.
 */
export const actChainShape = (claims: Dict): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  for (const claim of CHAIN_CLAIMS) {
    if (isClaimOmitted(claims[claim])) continue;

    validateActor(claims[claim], claim, invalid);
  }

  return invalid;
};
