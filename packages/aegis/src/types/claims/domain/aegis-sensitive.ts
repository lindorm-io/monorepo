// Aegis-owned sensitive identity claims. Government-issued personal
// identifiers (national identity numbers, social security numbers) kept
// deliberately separate from AegisProfile so they can be guarded with
// stricter handling.
//
// Wire: FLAT individual top-level claims (`national_identity_number`,
// `social_security_number`, and their OIDC §5.1 verified flags), exactly
// like any other registered claim — they are NOT nested under a wrapper.
// The registry marks each with `category: "sensitive"`, which drives two
// guarantees (OIDC Core §13.3, signed-and-encrypted ID tokens):
//   - mint forces encryption when any sensitive field is present, and omits
//     them entirely when no recipient key resolves (never emitted in clear);
//   - read only surfaces them from an ENCRYPTED token (jwe/cwe) — on an
//     unencrypted token they are SUPPRESSED, so a flat sensitive claim in
//     cleartext never reaches a consumer.
//
// Scope: government-issued personal identifiers used for deduplication and
// regulatory KYC. Examples include Swedish personnummer (NIN),
// Norwegian/Danish/Finnish national identity numbers (CPR, HETU), and US
// Social Security Numbers (SSN).
//
// Verified flags follow OIDC §5.1 conventions (paired boolean per field).

export type AegisSensitive = {
  nationalIdentityNumber?: string | null;
  nationalIdentityNumberVerified?: boolean;
  socialSecurityNumber?: string | null;
  socialSecurityNumberVerified?: boolean;
};
