import { camelKeys } from "@lindorm/case";
import { isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { AegisSensitiveIdentity } from "../../types/index.js";

// AegisSensitiveIdentity travels as a single nested top-level JWT claim
// ("sensitive_identity"), unlike AegisProfile whose fields are spread at
// the top level. Accept either snake_case (wire) or camelCase (already
// extracted / conduit-transformed) for both the outer claim name and
// inner field names so downstream parsing is permissive.

const SENSITIVE_IDENTITY_KEYS: ReadonlyArray<string> = [
  "sensitiveIdentity",
  "sensitive_identity",
];

/**
 * Extract AegisSensitiveIdentity from a dictionary that may carry it as
 * `sensitive_identity` (wire) or `sensitiveIdentity` (camel). Returns the
 * normalised camelCase object plus the leftover dict (with the consumed
 * key removed).
 */
export const extractSensitiveIdentity = (
  data: Dict,
): { sensitiveIdentity: AegisSensitiveIdentity | undefined; rest: Dict } => {
  const rest: Dict = { ...data };

  let raw: unknown;
  for (const key of SENSITIVE_IDENTITY_KEYS) {
    if (key in rest) {
      raw = rest[key];
      delete rest[key];
      break;
    }
  }

  if (!isObject(raw)) {
    return { sensitiveIdentity: undefined, rest };
  }

  const normalised = camelKeys(raw);

  if (Object.keys(normalised).length === 0) {
    return { sensitiveIdentity: undefined, rest };
  }

  return { sensitiveIdentity: normalised as AegisSensitiveIdentity, rest };
};
