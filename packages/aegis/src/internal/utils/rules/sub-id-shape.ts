import { isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { SUBJECT_IDENTIFIER_REQUIRED_MEMBERS } from "../../claims/sub-id.js";
import type { InvalidEntry } from "../../../types/index.js";
import { isClaimOmitted } from "./is-claim-omitted.js";
import { isClaimSatisfied } from "./is-claim-satisfied.js";

/**
 * RFC 9493 — when `sub_id` is present it must be an object with a string
 * `format` plus the members that format requires. An unknown format is
 * accepted structurally (no extra required members).
 *
 * ⚠ A format's required members are a DEMAND, so they read `isClaimSatisfied`,
 * not mere presence — and RFC 9493 says so in as many words, per format rather
 * than as a general principle: §3.2.1 "The 'uri' member is REQUIRED and MUST NOT
 * be null or empty", §3.2.2 the same for 'email', §3.2.3 "Both the 'iss' member
 * and the 'sub' member are REQUIRED and MUST NOT be null or empty". A bare
 * `=== undefined` check accepted every one of those. Live on `security_event`,
 * which requires `subjectId` and forbids `subject`, making `sub_id` the only
 * thing naming the subject of the event.
 *
 * ⚠⚠ IT REPORTS IN THE **DOMAIN** VOCABULARY — `subjectId.phoneNumber`, never the
 * wire's `sub_id.phone_number` — and it was the ONE shape rule that did not. Its
 * siblings already do: `cnf-shape.ts` reports `confirmation.thumbprint` where the
 * wire says `cnf.jkt`, and `act-chain-shape.ts` reports `mayAct.…` where the wire
 * says `may_act`. An `InvalidEntry.key` is read by a caller who stated the claim
 * in domain names and never saw the wire's, and the same `invalid` field carries
 * the policy floor's own entries — so one field spoke two vocabularies depending
 * on which rule filled it. The member half of that was invisible while the
 * translator carried `sub_id` verbatim and the two spellings agreed;
 * `internal/claims/sub-id-members.ts` splits them, and this is the side a
 * consumer wrote.
 *
 * ⚠ `format` IS ALSO A REGISTRY DEMAND NOW ({@link ClaimMemberSpec.required} on
 * the declared member), enforced by the structure walker in both directions and
 * under every profile. This rule keeps its own `format` check because it is this
 * function's PRECONDITION — there is no requirement row to look up without one —
 * and because a profile enforcement runs BEFORE any wire assembly, so it is the
 * earlier of the two places to speak.
 */
export const subIdShape = (claims: Dict): Array<InvalidEntry> => {
  const value = claims.subjectId;

  if (isClaimOmitted(value)) return [];

  if (!isObject(value)) {
    return [{ key: "subjectId", message: "subjectId must be an object" }];
  }

  const subId = value;

  if (!isString(subId.format)) {
    return [{ key: "subjectId.format", message: "subjectId.format must be a string" }];
  }

  // ⛔ `.get`, and the table is a `Map` — `subId.format` is a PRODUCER'S string,
  // validated only as text, so an object literal would resolve `constructor` to
  // `Object` and the `?? []` would never fire. See the table's own note for the
  // measurement; it threw a bare `TypeError` out of both public doors.
  const required = SUBJECT_IDENTIFIER_REQUIRED_MEMBERS.get(subId.format) ?? [];

  const invalid: Array<InvalidEntry> = [];

  for (const member of required) {
    if (isClaimSatisfied(subId[member])) continue;

    invalid.push({
      key: `subjectId.${member}`,
      message: `subjectId of format "${subId.format}" requires member "${member}"`,
    });
  }

  return invalid;
};
