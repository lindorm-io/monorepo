import { Aegis } from "@lindorm/aegis";
import type { CachedIntrospectionPayload } from "../../../entities/CachedIntrospection.js";
import type {
  PylonIntrospection,
  PylonIntrospectionActive,
} from "../../../types/index.js";

/**
 * The stored payload back as an introspection answer — the read twin of
 * `toCachedPayload`. `Aegis.toDomain` is the registry-driven inverse of
 * `Aegis.toWire`: it rebuilds the `Date` claims from their unix seconds and
 * camelCases everything it does not recognise into `custom` (`token_type` ->
 * `tokenType`, `username`), which is why the two buckets are merged back into
 * one flat claim set — a cache HIT must be indistinguishable from a MISS.
 */
export const fromCachedPayload = (
  payload: CachedIntrospectionPayload,
): PylonIntrospection => {
  if (!payload.active) return { active: false };

  const { claims, custom } = Aegis.toDomain(payload.claims ?? {});

  return { ...custom, ...claims, active: true } as PylonIntrospectionActive;
};
