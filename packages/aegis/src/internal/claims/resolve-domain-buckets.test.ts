import { describe, expect, test } from "vitest";
import { Aegis } from "../../classes/Aegis.js";
import { coseToBuckets, joseToBuckets } from "./resolve-domain-buckets.js";

// A flat claim dict of the shape an introspection or userinfo response carries:
// registered claims, profile claims (OIDC standard claims), sensitive claims,
// and something unregistered.
const JOSE_WIRE = {
  iss: "https://test.lindorm.io/",
  sub: "user-1",
  email: "user@example.com",
  email_verified: true,
  given_name: "Ada",
  national_identity_number: "ABC-123",
  national_identity_number_verified: true,
  tenant: "acme",
};

describe("resolveDomainBuckets", () => {
  test("should bucket profile and sensitive claims off the domain layer", () => {
    expect(joseToBuckets(JOSE_WIRE)).toMatchSnapshot();
  });

  // The bug this closes: the public translator resolved a NARROWER surface than
  // the token read path, so profile and sensitive claims stayed FLAT in `claims`
  // and every consumer re-derived the split from a hand-kept mirror list.
  test("should leave neither profile nor sensitive claims in claims", () => {
    const { claims } = joseToBuckets(JOSE_WIRE);

    expect(claims).not.toHaveProperty("email");
    expect(claims).not.toHaveProperty("givenName");
    expect(claims).not.toHaveProperty("nationalIdentityNumber");
    expect(claims.subject).toBe("user-1");
  });

  test("should route unregistered claims to custom", () => {
    expect(joseToBuckets(JOSE_WIRE).custom).toEqual({ tenant: "acme" });
  });

  // `toDomain` is the public door onto the same resolution. It exists so a
  // consumer never has to re-derive the registry, which it could not do while
  // the two doors disagreed.
  test("should give Aegis.toDomain the same bucketed shape", () => {
    expect(Aegis.toDomain(JOSE_WIRE)).toEqual(joseToBuckets(JOSE_WIRE));
  });

  // ⚠ The OIDC Core §13.3 encryption gate is NOT applied here. This input is a
  // claim dict of unknown provenance — an introspection answer, a userinfo body
  // over TLS — where the release decision was already made by the issuer
  // according to granted scope. §13.3 is a rule about TOKENS, and applying it
  // here would silently drop data the issuer deliberately released. The gate
  // stays in the token read path, which is the only place that knows whether the
  // token was encrypted.
  test("should surface sensitive claims unconditionally — no token encryption gate", () => {
    expect(joseToBuckets(JOSE_WIRE).sensitive).toEqual({
      nationalIdentityNumber: "ABC-123",
      nationalIdentityNumberVerified: true,
    });
  });

  test("should reach the same buckets from the COSE door", () => {
    // Identical content, spelled for the COSE wire: `cti` where JOSE says `jti`
    // is the only divergence, and this dict carries neither, so the two doors
    // must agree exactly.
    expect(coseToBuckets(JOSE_WIRE)).toEqual(joseToBuckets(JOSE_WIRE));
  });

  test("should return undefined buckets when nothing qualifies", () => {
    const { profile, sensitive } = joseToBuckets({ iss: "https://x/", sub: "u" });

    expect(profile).toBeUndefined();
    expect(sensitive).toBeUndefined();
  });
});
