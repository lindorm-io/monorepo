// Wire form of AegisSensitiveIdentity — nested under a single top-level
// "sensitive_identity" claim in the JWT body. Inner keys are snake_case
// per OIDC/JWT convention.
export type SensitiveIdentityInnerWire = {
  national_identity_number?: string | null;
  national_identity_number_verified?: boolean;
  social_security_number?: string | null;
  social_security_number_verified?: boolean;
};

export type SensitiveIdentityClaimWire = {
  sensitive_identity?: SensitiveIdentityInnerWire;
};
