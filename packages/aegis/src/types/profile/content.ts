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
      // RFC 7662 §2.2. Introspection describes an ACCESS token, so a username an
      // introspection answer may report about one is a claim that token may assert
      // about itself — minting it must not be reachable only through the
      // policy-free `default` profile, or it could arrive by introspection alone.
      // NOT `preferredUsername`: that is the OIDC Core §5.1 PROFILE field, which
      // reaches an id token through `IdTokenContent`'s `profile` container and is
      // deliberately absent here.
      | "username"
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
 *
 * A VERIFY-ONLY profile (`use: "verify"`) maps to `never`: there is no content
 * it accepts, because there is no token of that kind we are entitled to issue.
 * That is the type-level half of the runtime refusal — the compiler kills the
 * call site, and `jwt_profile_not_mintable` covers a caller who casts past it.
 */
export type ProfileContent = {
  default: DefaultContent;
  access_token: AccessTokenContent;
  external_access_token: never;
  id_token: IdTokenContent;
  logout_token: LogoutTokenContent;
  erasure_token: ErasureTokenContent;
  security_event: SecurityEventContent;
  delegation: DelegationContent;
  introspection: IntrospectionContent;
  userinfo: UserinfoContent;
  jarm: JarmContent;
};

/**
 * Resolves a profile NAME to the content type `mint` accepts for it: a built-in
 * name gets its own `Pick`, any other name gets the open {@link SignContent}
 * escape hatch for a runtime-registered profile.
 *
 * This is ONE signature on purpose. The pair it replaced — a typed overload over
 * `keyof ProfileContent` plus a loose one over `string & {}` — leaked, because
 * `string & {}` accepts a BUILT-IN name as readily as a custom one: an inline
 * literal carrying a claim the profile does not `Pick` failed the typed overload,
 * fell through to the loose one, and compiled as `SignContent`, which admits
 * nearly the whole vocabulary. Resolving the content type from the name inside a
 * single signature removes the fall-through rather than ordering around it, and
 * the compiler reports the real problem — the offending key against
 * `AccessTokenContent` — instead of a two-overload mismatch.
 *
 * A verify-only name resolves to `never` through the SAME lookup, which is why
 * the fall-through must stay closed: reintroduce the loose overload and
 * `mint("external_access_token", …)` compiles again as `SignContent`.
 */
export type ProfileContentFor<P extends string> = P extends keyof ProfileContent
  ? ProfileContent[P]
  : SignContent;
