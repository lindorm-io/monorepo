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
 * ⚠ A format's required members are a DEMAND, so they read `isClaimSatisfied`
 * rather than mere presence — a bare `=== undefined` check accepts an empty one.
 * RFC 9493 §3.2. Live on `security_event`, which requires `subjectId` and forbids
 * `subject`, so `sub_id` is the only thing naming the subject of the event.
 *
 * ⚠⚠ IT REPORTS IN THE **DOMAIN** VOCABULARY — `subjectId.phoneNumber`, never the
 * wire's `sub_id.phone_number`, matching `cnf-shape.ts` and `act-chain-shape.ts`.
 * An `InvalidEntry.key` is read by a caller who stated the claim in domain names
 * and never saw the wire's, and the same `invalid` field carries the policy
 * floor's entries.
 *
 * ⚠ `format` is ALSO a registry demand ({@link ClaimMemberSpec.required}),
 * enforced by the structure walker. This rule keeps its own check because it is
 * this function's PRECONDITION and because profile enforcement runs BEFORE any
 * wire assembly.
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

  // ⛔ `.get`, and the table is a `Map` — `subId.format` is a PRODUCER's string
  // validated only as text, so an object literal resolves `constructor` to
  // `Object`, the `?? []` never fires, and a bare `TypeError` escapes both public
  // doors.
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
