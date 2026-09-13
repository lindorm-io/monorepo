import type { Dict } from "@lindorm/types";
import type { AegisProfile, AegisSensitive } from "../../types/index.js";
import type { TokenClaims } from "../../types/claims/domain/domain-claims.js";
import { extractAegisProfile } from "../utils/extract-aegis-profile.js";
import { extractSensitiveClaims } from "../utils/extract-sensitive-claims.js";
import { joseName, type NameSelector } from "./claims-registry.js";
import { wireToDomain } from "./translate.js";

/**
 * The four-bucket read shape — what EVERY door onto the registry resolves to, and
 * what a {@link VerifiedToken} carries for a JWT/CWT: the registered `claims`
 * (minus profile/sensitive), the non-domain `custom` bucket, the `profile` bag,
 * and the `sensitive` bag (surfaced only when the outer token was encrypted).
 */
export type DomainBuckets<C extends Dict = Dict> = {
  claims: TokenClaims;
  custom: C;
  profile: AegisProfile | undefined;
  sensitive: AegisSensitive | undefined;
};

const toBuckets = <C extends Dict = Dict>(
  wire: Dict,
  nameOf: NameSelector,
  mode: "token" | "dict",
): DomainBuckets<C> => {
  const { claims: domainAll, custom } = wireToDomain(wire, nameOf, mode);
  const { profile, rest: afterProfile } = extractAegisProfile(domainAll);
  const { sensitive, rest: claims } = extractSensitiveClaims(afterProfile);

  return { claims, custom: custom as C, profile, sensitive };
};

/**
 * A TOKEN's wire claim payload -> the four domain buckets, on either wire.
 *
 * ⚠ Wire-name lookup only. Which claim the ISSUER stated is decided by the
 * registered wire claim; a look-alike custom claim spelled in domain form must
 * never answer for it, because the presenter chooses that spelling and the issuer
 * chose the other one.
 *
 * ⚠ The confidentiality gate is deliberately NOT applied here. It is a rule about
 * TOKENS — a sensitive claim is surfaced only from one that arrived ENCRYPTED —
 * so it stays with the caller that knows whether the outer token was encrypted.
 *
 * ⛔ That rule is AEGIS POLICY, not a specification's. Do not attach a citation to
 * it. `claims` has the sensitive keys stripped either way, so an unencrypted token
 * carrying them in cleartext leaks nothing regardless.
 */
export const tokenToBuckets = <C extends Dict = Dict>(
  wire: Dict,
  nameOf: NameSelector,
): DomainBuckets<C> => toBuckets<C>(wire, nameOf, "token");

/**
 * The PUBLIC vocabulary door (`Aegis.toDomain`): a jose-keyed OR camel-keyed
 * claim dict -> the four domain buckets.
 *
 * ⚠ It answers to EITHER spelling, and that is the documented contract — its
 * input is a claim dict of unknown provenance (an introspection response, a
 * userinfo body over TLS, an already-domain-shaped set), not a token whose
 * audience decides an access decision. The token read above is deliberately
 * stricter; the two are separated by a named {@link ClaimReadMode}, not by a
 * second implementation.
 */
export const dictToBuckets = <C extends Dict = Dict>(wire: Dict): DomainBuckets<C> =>
  toBuckets<C>(wire, joseName, "dict");
