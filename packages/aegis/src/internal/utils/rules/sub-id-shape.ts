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
 */
export const subIdShape = (claims: Dict): Array<InvalidEntry> => {
  const value = claims.subjectId;

  if (isClaimOmitted(value)) return [];

  if (!isObject(value)) {
    return [{ key: "sub_id", message: "sub_id must be an object" }];
  }

  const subId = value;

  if (!isString(subId.format)) {
    return [{ key: "sub_id.format", message: "sub_id.format must be a string" }];
  }

  const required = SUBJECT_IDENTIFIER_REQUIRED_MEMBERS[subId.format] ?? [];

  const invalid: Array<InvalidEntry> = [];

  for (const member of required) {
    if (isClaimSatisfied(subId[member])) continue;

    invalid.push({
      key: `sub_id.${member}`,
      message: `sub_id of format "${subId.format}" requires member "${member}"`,
    });
  }

  return invalid;
};
