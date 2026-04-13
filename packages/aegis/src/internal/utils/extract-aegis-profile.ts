import { camelKeys } from "@lindorm/case";
import { Dict } from "@lindorm/types";
import { AegisProfile } from "../../types";
import { AEGIS_PROFILE_WIRE_KEYS } from "../constants/aegis-profile-keys";

// AegisProfile field names in camelCase form. Built once from the
// snake_case wire-key set so that we can extract profile fields from
// objects that already use camelCase (e.g. conduit-transformed responses).
const AEGIS_PROFILE_CAMEL_KEYS: ReadonlySet<string> = new Set(
  Object.keys(
    camelKeys(Object.fromEntries([...AEGIS_PROFILE_WIRE_KEYS].map((k) => [k, 1]))),
  ),
);

/**
 * Extract AegisProfile fields from a dictionary that may use either
 * snake_case wire names or camelCase domain names. Returns the profile
 * (always camelCase) and the leftover non-profile keys (preserving their
 * original key form).
 *
 * Replaces the previous Wire/Camel split — one function handles both
 * naming conventions.
 */
export const extractAegisProfile = (
  data: Dict,
): { profile: AegisProfile | undefined; rest: Dict } => {
  const profileWire: Dict = {};
  const profileCamel: Dict = {};
  const rest: Dict = {};

  for (const [key, value] of Object.entries(data)) {
    if (AEGIS_PROFILE_WIRE_KEYS.has(key)) {
      profileWire[key] = value;
    } else if (AEGIS_PROFILE_CAMEL_KEYS.has(key)) {
      profileCamel[key] = value;
    } else {
      rest[key] = value;
    }
  }

  const hasWire = Object.keys(profileWire).length > 0;
  const hasCamel = Object.keys(profileCamel).length > 0;

  if (!hasWire && !hasCamel) {
    return { profile: undefined, rest };
  }

  // Convert wire keys to camel and merge with already-camel fields.
  const merged: Dict = {
    ...(hasWire ? camelKeys(profileWire) : {}),
    ...profileCamel,
  };

  return { profile: merged as AegisProfile, rest };
};
