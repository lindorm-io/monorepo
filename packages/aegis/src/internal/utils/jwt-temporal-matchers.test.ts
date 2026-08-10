import { describe, expect, test } from "vitest";
import { claimByJose } from "../claims/claims-registry.js";
import {
  createDomainTemporalMatchers,
  createTemporalMatchers,
  type TemporalMatcherOptions,
} from "./jwt-temporal-matchers.js";

const NOW = new Date("2024-01-01T08:00:00.000Z");

const WIRE_CLAIMS = ["exp", "nbf", "iat", "auth_time"] as const;

// The four registry temporal claims, wire name → domain name. Written out rather
// than derived so a registry rename has to face this table.
const DOMAIN_BY_WIRE: Record<(typeof WIRE_CLAIMS)[number], string> = {
  exp: "expiresAt",
  nbf: "notBefore",
  iat: "issuedAt",
  auth_time: "authTime",
};

/**
 * ONE implementation, two key namespaces. Every case below asserts the two
 * builders produce the SAME operators under each namespace's own names — which
 * is the whole reason `assert` and `verify` cannot disagree about time.
 */
describe("temporal matchers — wire and domain namespaces", () => {
  const expectSameConditions = (options: TemporalMatcherOptions) => {
    const wire = createTemporalMatchers(options) as Record<string, unknown>;
    const domain = createDomainTemporalMatchers(options);

    expect(Object.keys(domain).sort()).toEqual(
      Object.keys(wire)
        .map((key) => DOMAIN_BY_WIRE[key as (typeof WIRE_CLAIMS)[number]])
        .sort(),
    );

    for (const key of Object.keys(wire)) {
      const domainKey = DOMAIN_BY_WIRE[key as (typeof WIRE_CLAIMS)[number]];

      expect(domainKey, `${key} has a domain name`).toBeDefined();
      expect(domain[domainKey], `${key} ↔ ${domainKey}`).toEqual(wire[key]);
    }
  };

  test("should build the same optional bounds for every temporal claim", () => {
    expectSameConditions({ clockTolerance: 0, currentDate: NOW });
  });

  test("should apply the same clock tolerance on both", () => {
    expectSameConditions({ clockTolerance: 300, currentDate: NOW });
  });

  test.each(WIRE_CLAIMS)("should skip %s identically on both", (claim) => {
    expectSameConditions({
      clockTolerance: 0,
      currentDate: NOW,
      verifyExpiration: claim !== "exp",
      verifyNotBefore: claim !== "nbf",
      verifyIssuedAt: claim !== "iat",
      verifyAuthTime: claim !== "auth_time",
    });
  });

  test("should build the same maxTokenAge bound on both", () => {
    expectSameConditions({ clockTolerance: 30, currentDate: NOW, maxTokenAge: 600 });
  });

  // The domain names are the registry's, never a second hard-coded table.
  test("should take every domain name from the registry", () => {
    for (const wire of WIRE_CLAIMS) {
      expect(claimByJose(wire)?.domain, wire).toBe(DOMAIN_BY_WIRE[wire]);
    }
  });

  test("should require issuedAt when maxTokenAge is set", () => {
    const domain = createDomainTemporalMatchers({
      clockTolerance: 0,
      currentDate: NOW,
      maxTokenAge: 600,
    });

    expect(domain.issuedAt).toEqual({
      $exists: true,
      $lte: NOW,
      $gte: new Date("2024-01-01T07:50:00.000Z"),
    });
  });

  test("should tolerate an absent claim on the domain side too", () => {
    const domain = createDomainTemporalMatchers({ clockTolerance: 0, currentDate: NOW });

    expect(domain.expiresAt).toEqual({
      $or: [{ $exists: false }, { $gte: NOW }],
    });
  });
});
