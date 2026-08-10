// camelCase domain names of the AegisSensitive fields (@lindorm/aegis, registry
// `category: "sensitive"`). The claim translator (Aegis.toDomain) surfaces these
// as first-class domain claims, but `DomainClaims` does NOT declare them — aegis
// partitions them into its own `sensitive` bucket and, per OIDC Core §13.3,
// surfaces that bucket only when the token arrived encrypted.
//
// The introspection parser drops them for the same reason it drops the profile
// claims: an authorization server volunteering a national identity number into
// an authorization decision has no business reaching `ctx.state.access.claims`,
// which answers ONE question — may this request do this. Without this, the
// introspected arm resolved claims the verified arm suppresses, so the two
// provenances did not produce the same shape.
//
// Mirror of the AegisSensitive shape — keep in sync if that type gains or loses
// a field.
export const SENSITIVE_CLAIM_KEYS: ReadonlySet<string> = new Set([
  "nationalIdentityNumber",
  "nationalIdentityNumberVerified",
  "socialSecurityNumber",
  "socialSecurityNumberVerified",
]);
