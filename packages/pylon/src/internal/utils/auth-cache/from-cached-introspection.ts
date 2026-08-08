import { Aegis } from "@lindorm/aegis";
import type { CachedIntrospectionPayload } from "../../../entities/CachedIntrospection.js";
import type {
  PylonIntrospection,
  PylonIntrospectionActive,
} from "../../../types/index.js";

/**
 * The stored payload back as an introspection answer — the read twin of
 * `toCachedIntrospection`. `Aegis.toDomain` is the registry-driven inverse of
 * `Aegis.toWire`: it rebuilds the `Date` claims from their unix seconds and
 * camelCases everything it does not recognise into a bucket (`token_type` ->
 * `tokenType`). That is an RFC 7662 §2.2 RESPONSE member rather than a claim, so
 * it is merged back onto the flat answer — a cache HIT must be indistinguishable
 * from a MISS. (`username` needs no such handling: it is a REGISTERED claim, so
 * it comes back in `claims` like `sub` does.)
 *
 * The EXTENSION claims never went through that translation — `toCachedIntrospection`
 * stored them beside the wire claims precisely so their keys survive — so they
 * are restored verbatim.
 */
export const fromCachedIntrospection = (
  payload: CachedIntrospectionPayload,
): PylonIntrospection => {
  if (!payload.active) return { active: false };

  const { claims, custom: responseMembers } = Aegis.toDomain(payload.claims ?? {});

  return {
    ...responseMembers,
    ...claims,
    active: true,
    custom: payload.custom ?? {},
  } as PylonIntrospectionActive;
};
