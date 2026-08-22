import { AegisDomainError } from "../../errors/index.js";
import { criticalToWire } from "./critical-to-wire.js";
import { headerByDomain, headerByJose } from "./header-registry.js";

/**
 * Translate a DOMAIN verify/decrypt `critical` declaration into the WIRE names
 * the crit gate compares against — `["objectId"]` becomes `["oid"]`, and a custom
 * parameter passes through unchanged because it is spelled identically at both
 * tiers.
 *
 * ⚠ IT REUSES `criticalToWire`, the ONE domain→wire resolver the write passes
 * apply. A second resolver is how the two spellings come apart: members resolved
 * one way against a bag keyed the other means the comparison misses.
 *
 * ⛔ A WIRE SPELLING AT THE DOMAIN DOOR IS REFUSED, not quietly accepted. That
 * resolver is IDEMPOTENT — a wire name misses `headerByDomain` and falls through
 * unchanged — so without this check `critical: ["oid"]` would work at a door
 * whose whole purpose is that a caller never learns the wire vocabulary. It is
 * the mirror of the refusal a WIRE door makes for `crit: ["objectId"]`
 * (`internal/header/assert-crit-eligible.ts`), so one name means one thing per
 * tier.
 *
 * ⚠ `jwk` and `zip` spell the same at both tiers, so they resolve through
 * `headerByDomain` and never reach the refusal.
 *
 * ⚠ Both lookups are `Map` reads, so a CALLER-CONTROLLED member cannot resolve
 * through `Object.prototype`.
 */
export const declaredCritToWire = (
  critical: ReadonlyArray<string> | undefined,
): Array<string> | undefined => {
  if (critical === undefined) return undefined;

  for (const member of critical) {
    if (headerByDomain(member) !== undefined) continue;

    const spec = headerByJose(member);
    if (spec === undefined) continue;

    throw new AegisDomainError(
      `Critical header parameter "${member}" is named in the wire vocabulary`,
      {
        code: "crit_declaration_not_domain_named",
        // The domain spelling is READ OFF the registry entry, so a renamed
        // parameter cannot leave this message naming the old one.
        data: { parameter: member, expected: spec.domain },
        title: "Crit Declaration Not Domain Named",
        details:
          "The domain verify and decrypt doors take DOMAIN header names, so a registered parameter must be declared by its domain spelling. Naming it by its wire spelling here would make one door speak two vocabularies.",
      },
    );
  }

  return criticalToWire([...critical]);
};
