import { describe, expect, test } from "vitest";
import { Aegis } from "../../classes/Aegis.js";
import { dictToBuckets, tokenToBuckets } from "./resolve-domain-buckets.js";
import { coseName, joseName } from "./claims-registry.js";

// The COSE token read, bound to its name selector once for the table below.
const tokenToBucketsCose = (wire: any) => tokenToBuckets(wire, coseName);

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
    expect(dictToBuckets(JOSE_WIRE)).toMatchSnapshot();
  });

  // The bug this closes: the public translator resolved a NARROWER surface than
  // the token read path, so profile and sensitive claims stayed FLAT in `claims`
  // and every consumer re-derived the split from a hand-kept mirror list.
  test("should leave neither profile nor sensitive claims in claims", () => {
    const { claims } = dictToBuckets(JOSE_WIRE);

    expect(claims).not.toHaveProperty("email");
    expect(claims).not.toHaveProperty("givenName");
    expect(claims).not.toHaveProperty("nationalIdentityNumber");
    expect(claims.subject).toBe("user-1");
  });

  test("should route unregistered claims to custom", () => {
    expect(dictToBuckets(JOSE_WIRE).custom).toEqual({ tenant: "acme" });
  });

  // `toDomain` is the public door onto the same resolution. It exists so a
  // consumer never has to re-derive the registry, which it could not do while
  // the two doors disagreed.
  test("should give Aegis.toDomain the same bucketed shape", () => {
    expect(Aegis.toDomain(JOSE_WIRE)).toEqual(dictToBuckets(JOSE_WIRE));
  });

  // ⚠ The aegis confidentiality gate is NOT applied here. This input is a
  // claim dict of unknown provenance — an introspection answer, a userinfo body
  // over TLS — where the release decision was already made by the issuer
  // according to granted scope. the gate is a rule about TOKENS, and applying it
  // here would silently drop data the issuer deliberately released. The gate
  // stays in the token read path, which is the only place that knows whether the
  // token was encrypted.
  test("should surface sensitive claims unconditionally — no token encryption gate", () => {
    expect(dictToBuckets(JOSE_WIRE).sensitive).toEqual({
      nationalIdentityNumber: "ABC-123",
      nationalIdentityNumberVerified: true,
    });
  });

  // ⚠ These are the two TOKEN reads, one per wire — NOT the token read against
  // the public dict door, which resolves a different set on purpose (it answers
  // to the domain spelling; a token read does not). Comparing across that
  // boundary would pass only for a fixture carrying no domain-spelled key, and
  // would stop meaning "the wires agree" the moment one did.
  //
  // `cti` where JOSE says `jti` is the only naming divergence, and this dict
  // carries neither, so the two wires must agree exactly.
  test("should reach the same buckets from either wire's token read", () => {
    expect(tokenToBucketsCose(JOSE_WIRE)).toEqual(tokenToBuckets(JOSE_WIRE, joseName));
  });

  // The public dict door is the one that answers to EITHER spelling. Stating the
  // difference here is what stops the comparison above from being widened back
  // across it.
  test("the dict door resolves a domain spelling the token read refuses", () => {
    const camel = { issuer: "https://test.lindorm.io/", subject: "user-1" };

    expect(dictToBuckets(camel).claims).toEqual(camel);
    expect(tokenToBuckets(camel, joseName).claims).toEqual({});
  });

  test("should return undefined buckets when nothing qualifies", () => {
    const { profile, sensitive } = dictToBuckets({ iss: "https://x/", sub: "u" });

    expect(profile).toBeUndefined();
    expect(sensitive).toBeUndefined();
  });
});
