import { Aegis } from "@lindorm/aegis";
import type { CachedIntrospectionPayload } from "../../../entities/CachedIntrospection.js";
import type { PylonIntrospection } from "../../../types/index.js";

/**
 * An introspection answer as a STORABLE payload.
 *
 * The claims are written in WIRE form (`Aegis.toWire`) rather than domain form,
 * because the column is plain JSON: `DomainClaims` carries real `Date` values
 * (`expiresAt`, `issuedAt`, `notBefore`, `authTime`), and proteus REJECTS a Date
 * inside a plain `@Field("json")` value outright (`assertSerialisableJsonFields`)
 * — it does not silently degrade to an ISO string. The wire form is dates-as-
 * unix-seconds, which is exactly what `Aegis.toDomain` reads back.
 *
 * An inactive answer stores `claims: null` — RFC 7662 §2.2 permits nothing but
 * `active: false`, and the negative is still a real entry.
 */
export const toCachedPayload = (
  introspection: PylonIntrospection,
): CachedIntrospectionPayload => {
  if (!introspection.active) return { active: false, claims: null };

  const { active: _active, ...claims } = introspection;

  return { active: true, claims: Aegis.toWire(claims) };
};
