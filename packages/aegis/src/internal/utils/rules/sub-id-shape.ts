import { isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { SUBJECT_IDENTIFIER_REQUIRED_MEMBERS } from "../../claims/sub-id.js";
import type { InvalidEntry } from "../../../types/index.js";

/**
 * RFC 9493 — when `sub_id` is present it must be an object with a string
 * `format` plus the members that format requires. An unknown format is
 * accepted structurally (no extra required members).
 */
export const subIdShape = (claims: Dict): Array<InvalidEntry> => {
  const value = claims.subjectId;

  if (value === undefined) return [];

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
    if (subId[member] === undefined) {
      invalid.push({
        key: `sub_id.${member}`,
        message: `sub_id of format "${subId.format}" requires member "${member}"`,
      });
    }
  }

  return invalid;
};
