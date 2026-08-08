import type { DomainClaims } from "@lindorm/aegis";
import type { Dict } from "@lindorm/types";

/**
 * HOW the access credential was established. The two carry different trust
 * models — `verified` means pylon checked the signature itself against a key it
 * trusts; `introspected` means the authorization server asserted the token is
 * live and told us its claims (RFC 7662). Neither is "better"; a gate that
 * genuinely needs one over the other must say so at gate time.
 */
export type PylonAccessProvenance = "verified" | "introspected";

/**
 * The resolved access credential — the ONE shape both credential paths produce,
 * so every downstream gate reads the same fields regardless of how the token was
 * established. Populated by `useAccessToken`; `null` until it runs.
 *
 * Deliberately four fields:
 * - `custom` IS here — both paths genuinely produce one (aegis buckets the
 *   unregistered claims off a verified token, and RFC 7662 §2.2 lets the
 *   authorization server return arbitrary members), so it is never the
 *   half-present field the exclusions below guard against.
 * - `confirmation`/`cnf` is NOT here — it is already inside `claims`
 *   (`claims.confirmation`, aegis `PopClaims`), on both paths.
 * - `header` is NOT here — an opaque token has no header, and on the verified
 *   path it is derivable from `token`. A half-present derived field invites
 *   `null` reaches.
 * - `dpop` is NOT here — a parsed proof is a per-request artifact of the DPoP
 *   binding check, not resolved credential data.
 * - `active` is NOT here — it is a rejection signal the middleware consumes; an
 *   inactive token never produces a resolved access at all.
 */
export type PylonResolvedAccess = {
  provenance: PylonAccessProvenance;
  /** Always present, domain-keyed camelCase on BOTH paths. */
  claims: DomainClaims;
  /**
   * The claims the aegis registry does not know, camelCase-keyed — ALWAYS an
   * object, `{}` when the credential carried none, on BOTH paths. Untyped on
   * purpose: a deployment knows its own extension claims and casts
   * (`access.custom as MyClaims`); threading a generic through every context
   * type to say the same thing costs far more than it buys.
   */
  custom: Dict;
  /** The presented credential — what was verified or introspected. */
  token: string;
};
