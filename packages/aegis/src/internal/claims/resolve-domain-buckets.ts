import type { Dict } from "@lindorm/types";
import type { AegisProfile, AegisSensitive } from "../../types/index.js";
import type { DomainClaims } from "../../types/claims/domain/domain-claims.js";
import { extractAegisProfile } from "../utils/extract-aegis-profile.js";
import { extractSensitiveClaims } from "../utils/extract-sensitive-claims.js";
import { coseName, joseName, type NameSelector } from "./claims-registry.js";
import { wireToDomain } from "./translate.js";

/**
 * The four-bucket read shape — what BOTH doors onto the registry resolve to, and
 * what a {@link VerifiedToken} carries for a JWT/CWT: the registered `claims`
 * (minus profile/sensitive), the non-domain `custom` bucket, the `profile` bag,
 * and the `sensitive` bag (surfaced only when the outer token was encrypted).
 */
export type DomainBuckets<C extends Dict = Dict> = {
  claims: DomainClaims;
  custom: C;
  profile: AegisProfile | undefined;
  sensitive: AegisSensitive | undefined;
};

/**
 * Resolve a wire claim dict all the way to the four domain buckets: registered
 * claims, unregistered `custom`, the OIDC standard-claims `profile` bag, and the
 * `sensitive` bag.
 *
 * ONE step, shared by both doors, because there used to be two resolutions of
 * the same registry. The token read path ran the full three-step pipeline while
 * the public `Aegis.toDomain` stopped after the translator, leaving profile and
 * sensitive claims flat inside `claims` — so every consumer of the public door
 * re-derived the split from a hand-kept mirror of `AegisProfile` /
 * `AegisSensitive`, each with a "keep in sync" comment on it. Those lists exist
 * only because this step was not shared.
 *
 * ⚠ The OIDC Core §13.3 encryption gate is deliberately NOT applied here, and
 * this is the one real design decision in the shape. §13.3 is a rule about
 * TOKENS: sensitive claims may be surfaced only from an ENCRYPTED one. The input
 * here is a claim dict of unknown provenance — an introspection response, a
 * userinfo body that arrived over TLS — where the release decision was already
 * made by the issuer according to granted scope. Applying a token rule to it
 * would silently drop data the issuer deliberately released.
 *
 * So the gate stays with the caller that knows whether a token was encrypted:
 * the token read path passes `sensitive` through `encrypted ? sensitive :
 * undefined`. `rest` always has the sensitive keys stripped either way, so an
 * unencrypted token carrying them in cleartext leaks nothing regardless.
 */
export const resolveDomainBuckets = <C extends Dict = Dict>(
  wire: Dict,
  nameOf: NameSelector,
): DomainBuckets<C> => {
  const { claims: domainAll, custom } = wireToDomain(wire, nameOf);
  const { profile, rest: afterProfile } = extractAegisProfile(domainAll);
  const { sensitive, rest: claims } = extractSensitiveClaims(afterProfile);

  return { claims: claims as DomainClaims, custom: custom as C, profile, sensitive };
};

/** JOSE/camel-keyed wire dict -> the four domain buckets. */
export const joseToBuckets = <C extends Dict = Dict>(wire: Dict): DomainBuckets<C> =>
  resolveDomainBuckets<C>(wire, joseName);

/** COSE-name-keyed wire dict -> the four domain buckets. */
export const coseToBuckets = <C extends Dict = Dict>(wire: Dict): DomainBuckets<C> =>
  resolveDomainBuckets<C>(wire, coseName);
