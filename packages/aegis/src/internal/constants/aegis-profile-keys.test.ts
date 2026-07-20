import { describe, expect, test } from "vitest";
import { AEGIS_PROFILE_WIRE_KEYS } from "./aegis-profile-keys.js";

// Drift guard: AEGIS_PROFILE_WIRE_KEYS is DERIVED from the claim registry
// (`category: "profile"` -> `spec.jose`). This pins the derived set to the exact
// wire names it previously carried as a hand-kept list, so a future registry
// edit (a new profile claim, a category flip, a renamed jose key) can't silently
// change what parseTokenPayload buckets as profile vs. custom.
const FROZEN_PROFILE_WIRE_KEYS = [
  "address",
  "email",
  "email_verified",
  "phone_number",
  "phone_number_verified",
  "picture",
  "birthdate",
  "family_name",
  "gender",
  "given_name",
  "locale",
  "middle_name",
  "name",
  "nickname",
  "preferred_username",
  "profile",
  "updated_at",
  "website",
  "zoneinfo",
  "display_name",
  "honorific",
  "legal_name",
  "legal_name_verified",
  "naming_system",
  "preferred_accessibility",
  "preferred_name",
  "pronouns",
  "department",
  "job_title",
  "occupation",
  "organization",
];

describe("AEGIS_PROFILE_WIRE_KEYS", () => {
  test("the registry-derived set equals the frozen profile wire-name list", () => {
    expect(AEGIS_PROFILE_WIRE_KEYS).toEqual(new Set(FROZEN_PROFILE_WIRE_KEYS));
  });
});
