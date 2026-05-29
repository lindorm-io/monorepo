// Aegis-owned sensitive identity claim. Government-issued personal
// identifiers (national identity numbers, social security numbers) that
// are deliberately separated from AegisProfile so they can be guarded
// with stricter handling.
//
// Wire: nested under a single top-level "sensitive_identity" JWT claim,
// not spread alongside OIDC profile fields. The nested shape makes the
// boundary visible on the wire so relying parties can require this claim
// to arrive only inside a JWE-encrypted ID token (OIDC Core §13.3,
// signed-and-encrypted ID tokens; client-registered via
// id_token_encrypted_response_alg / id_token_encrypted_response_enc).
//
// Scope: government-issued personal identifiers used for deduplication
// and regulatory KYC. Examples include Swedish personnummer (NIN),
// Norwegian/Danish/Finnish national identity numbers (CPR, HETU), and
// US Social Security Numbers (SSN).
//
// Verified flags follow OIDC §5.1 conventions (paired boolean per field).

export type AegisSensitiveIdentity = {
  nationalIdentityNumber?: string | null;
  nationalIdentityNumberVerified?: boolean;
  socialSecurityNumber?: string | null;
  socialSecurityNumberVerified?: boolean;
};
