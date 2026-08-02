import type { SignJwtContent } from "../domain/sign.js";

/**
 * The single domain vocabulary every profile draws from. All keys are
 * optional; individual profiles narrow this via `Pick`/`Partial` to make
 * required keys non-optional and forbidden keys absent. Wire claim names
 * never appear here — only domain names.
 */
export type SignContent = Partial<SignJwtContent>;

/**
 * `default` re-imposes the historical floor: `subject` and `expires` are
 * mandatory, everything else optional.
 */
export type DefaultContent = Required<Pick<SignContent, "subject" | "expires">> &
  Partial<Omit<SignContent, "subject" | "expires">>;

/**
 * Per-profile input types. Each makes its REQUIRED domain keys non-optional
 * (compile error if omitted) and leaves the rest optional. Forbidden wire
 * claims have no domain key here, so they cannot be expressed. `exp` is
 * derived from the profile lifetime, so `expires` is optional everywhere it is
 * not the historical floor.
 */
export type AccessTokenContent = Required<
  Pick<SignContent, "subject" | "audience" | "clientId">
> &
  Partial<
    Pick<
      SignContent,
      | "scope"
      | "confirmation"
      | "act"
      | "mayAct"
      | "authorizationDetails"
      | "roles"
      | "permissions"
      | "groups"
      | "entitlements"
      | "sessionId"
      | "authTime"
      | "authContextClassReference"
      | "authMethods"
      | "authFactorReference"
      | "authFactorCategories"
      | "levelOfAssurance"
      | "authenticatorAssuranceLevel"
      | "identityAssuranceLevel"
      | "grantType"
      | "sessionHint"
      | "subjectHint"
      | "expires"
      | "vectorOfTrust"
      | "vectorTrustMark"
      | "conformsTo"
    >
  >;

export type IdTokenContent = Required<Pick<SignContent, "subject" | "audience">> &
  Partial<
    Pick<
      SignContent,
      | "accessToken"
      | "authCode"
      | "authState"
      | "authTime"
      | "nonce"
      | "sessionId"
      | "authContextClassReference"
      | "authMethods"
      | "authFactorReference"
      | "authFactorCategories"
      | "levelOfAssurance"
      | "authenticatorAssuranceLevel"
      | "identityAssuranceLevel"
      | "federationAssuranceLevel"
      | "authorizedParty"
      | "vectorOfTrust"
      | "vectorTrustMark"
      | "sensitive"
      | "profile"
      | "expires"
    >
  >;

export type LogoutTokenContent = Required<Pick<SignContent, "audience" | "events">> &
  Partial<Pick<SignContent, "subject" | "sessionId" | "expires">>;

export type ErasureTokenContent = Required<
  Pick<SignContent, "audience" | "subject" | "events">
> &
  Partial<Pick<SignContent, "expires">>;

export type SecurityEventContent = Required<
  Pick<SignContent, "audience" | "subjectId" | "events">
> &
  Partial<Pick<SignContent, "transactionId">>;

export type DelegationContent = Required<
  Pick<SignContent, "issuer" | "subject" | "audience">
> &
  Partial<Pick<SignContent, "expires">>;

export type IntrospectionContent = Required<Pick<SignContent, "audience">> &
  Partial<Pick<SignContent, "claims" | "expires" | "conformsTo">>;

export type UserinfoContent = Required<Pick<SignContent, "subject" | "audience">> &
  Partial<Pick<SignContent, "profile" | "claims" | "expires">>;

export type JarmContent = Required<Pick<SignContent, "audience">> &
  Partial<Pick<SignContent, "claims" | "expires">>;

/**
 * Maps each built-in profile name to its input content type. Used by the
 * typed `mint` overload so the compiler enforces required/forbidden claims.
 */
export type ProfileContent = {
  default: DefaultContent;
  access_token: AccessTokenContent;
  id_token: IdTokenContent;
  logout_token: LogoutTokenContent;
  erasure_token: ErasureTokenContent;
  security_event: SecurityEventContent;
  delegation: DelegationContent;
  introspection: IntrospectionContent;
  userinfo: UserinfoContent;
  jarm: JarmContent;
};
