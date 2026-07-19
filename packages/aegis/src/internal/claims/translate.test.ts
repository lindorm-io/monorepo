import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import { extractDomainClaims } from "../utils/extract-claims.js";
import type { TokenProfile } from "../../types/index.js";
import { assembleCommonClaims } from "../utils/assemble-common-claims.js";
import { domainToJose, joseToDomain } from "./translate.js";

// Freeze time so the `expires("1h")` / `new Date()` calls resolve to a stable
// instant (the pinned snapshot, not a race).
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ALGORITHM = "ES512" as const;

// A policy-FREE profile: no auto-injection, no required/forbidden, per-token
// issuer, no lifetime. With it, `assembleCommonClaims` performs ONLY the domain
// envelope resolution + hash derivation, so `domainToJose(common)` is the pure
// content -> wire map (pinned by the snapshot below).
const permissiveProfile: TokenProfile = {
  name: "parity",
  typ: { presence: "none" },
  required: [],
  forbidden: [],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: { iat: false, jti: false, nbf: false, iss: false },
  issuer: "per-token",
  lifetime: null,
  encryptable: false,
  validate: () => [],
};

const assembleCtx = { algorithm: ALGORITHM, issuer: null };

describe("domainToJose — content -> wire mapping", () => {
  test("the full domain vocabulary maps to the expected wire dict", () => {
    const content: Dict = {
      // std envelope
      issuer: "https://issuer.lindorm.io/",
      subject: "user-1",
      audience: ["https://rs.lindorm.io/"],
      notBefore: new Date("2024-01-01T07:59:00.000Z"),
      expires: "1h",
      // oidc / oauth arrays
      scope: ["read", "write"],
      authMethods: ["pwd", "otp"],
      roles: ["admin"],
      groups: ["g1"],
      permissions: ["read"],
      entitlements: ["e1"],
      authFactor: ["knowledge"],
      conformsTo: ["urn:lindorm:profile:fapi"],
      // scalars
      authContextClassReference: "urn:acr:high",
      authorizedParty: "client-1",
      vectorOfTrust: "P1.Cc",
      vectorTrustMark: "https://vtm/",
      grantType: "authorization_code",
      sessionId: "sid-1",
      transactionId: "txn-1",
      clientId: "client-1",
      tenantId: "tenant-1",
      sessionHint: "sih-1",
      subjectHint: "suh-1",
      nonce: "n-1",
      authTime: new Date("2024-01-01T07:55:00.000Z"),
      levelOfAssurance: 3,
      authenticatorAssuranceLevel: 2,
      identityAssuranceLevel: 3,
      federationAssuranceLevel: 1,
      // bespoke
      confirmation: { thumbprint: "jkt-1", keyId: "kid-1" },
      act: {
        subject: "actor",
        issuer: "https://delegator/",
        clientId: "c-2",
        act: { subject: "root-actor" },
      },
      mayAct: { subject: "may-actor" },
      subjectId: { format: "iss_sub", iss: "https://i/", sub: "u" },
      events: { "urn:lindorm:event:rtbf": {} },
      authorizationDetails: [{ type: "payment", amount: 10 }],
      // hash inputs (both mappers derive the hash from these)
      accessToken: "the-access-token",
      authCode: "the-auth-code",
      authState: "the-auth-state",
    };
    const options = { tokenId: "jti-1", issuedAt: new Date("2024-01-01T08:00:00.000Z") };

    const common = assembleCommonClaims(assembleCtx, permissiveProfile, content, options);

    expect(domainToJose(common)).toMatchSnapshot();
  });

  test("an all-empty confirmation collapses to no cnf", () => {
    const content: Dict = { subject: "s", confirmation: {} };
    const common = assembleCommonClaims(assembleCtx, permissiveProfile, content, {});

    expect(domainToJose(common).cnf).toBeUndefined();
  });

  test("no expires ⇒ no exp; explicit envelope honoured, never invented", () => {
    const content: Dict = { subject: "s" };
    const common = assembleCommonClaims(assembleCtx, permissiveProfile, content, {});

    const wire = domainToJose(common);
    expect(wire.exp).toBeUndefined();
    expect(wire.iat).toBeUndefined();
    expect(wire.jti).toBeUndefined();
    expect(wire.nbf).toBeUndefined();
    expect(wire.sub).toBe("s");
  });

  test("registered profile/sensitive claims map by the registry, matching snakeKeys", () => {
    // Profile/sensitive fields reach the wire today via `snakeKeys` (mechanical).
    // The registry-driven translator produces the SAME wire names + values.
    const common: Dict = {
      givenName: "Ada",
      familyName: "Lovelace",
      emailVerified: true,
      preferredUsername: "ada",
      nationalIdentityNumber: "123",
      nationalIdentityNumberVerified: true,
      address: { streetAddress: "1 Byron Way", postalCode: "0001" },
    };

    expect(domainToJose(common)).toEqual({
      given_name: "Ada",
      family_name: "Lovelace",
      email_verified: true,
      preferred_username: "ada",
      national_identity_number: "123",
      national_identity_number_verified: true,
      address: { street_address: "1 Byron Way", postal_code: "0001" },
    });
  });
});

describe("joseToDomain — read parity with extractDomainClaims", () => {
  // A wire dict of ONLY the claims extractDomainClaims extracts, so both parse
  // the SAME set (txn/events/profile/sensitive are the intended extension —
  // covered separately below).
  const wire: Dict = {
    iss: "https://issuer.lindorm.io/",
    sub: "user-1",
    aud: ["https://rs.lindorm.io/"],
    exp: 1704099600,
    iat: 1704096000,
    nbf: 1704095940,
    jti: "jti-1",
    scope: "read write", // space-delimited string → split
    amr: ["pwd"],
    roles: "admin editor", // space-delimited string → split
    groups: ["g1"],
    permissions: ["read"],
    entitlements: ["e1"],
    afr: ["knowledge"],
    conforms_to: ["urn:lindorm:profile:fapi"],
    acr: "urn:acr:high",
    azp: "client-1",
    vot: "P1.Cc",
    vtm: "https://vtm/",
    gty: "authorization_code",
    sid: "sid-1",
    client_id: "client-1",
    tenant_id: "tenant-1",
    sih: "sih-1",
    suh: "suh-1",
    nonce: "n-1",
    auth_time: 1704095700,
    loa: 3,
    aal: 2,
    ial: 3,
    fal: 1,
    at_hash: "at-hash-value",
    c_hash: "c-hash-value",
    s_hash: "s-hash-value",
    cnf: { jkt: "jkt-1", kid: "kid-1" },
    act: { sub: "actor", iss: "https://delegator/", client_id: "c-2" },
    may_act: { sub: "may-actor" },
    sub_id: { format: "iss_sub", iss: "https://i/", sub: "u" },
    authorization_details: [{ type: "payment" }],
  };

  test("registered claims decode IDENTICALLY to extractDomainClaims", () => {
    const { claims: expected } = extractDomainClaims(wire);
    expect(joseToDomain(wire).claims).toEqual(expected);
  });

  test("value decoders match (dates → Date, string arrays split, audience wraps)", () => {
    const { claims } = joseToDomain({
      exp: 1704099600,
      aud: "single-resource", // string → [string]
      scope: "a b c", // split on space
      amr: ["pwd"], // array, NOT split
    });
    expect(claims.expiresAt).toEqual(new Date(1704099600 * 1000));
    expect(claims.audience).toEqual(["single-resource"]);
    expect(claims.scope).toEqual(["a", "b", "c"]);
    expect(claims.authMethods).toEqual(["pwd"]);
  });

  test("camelCase-tolerance: domain-form input parses as the wire form does", () => {
    const camel: Dict = {
      subject: "user-1",
      issuer: "https://i/",
      tokenId: "jti-1",
      authMethods: ["pwd"],
    };
    const { claims } = joseToDomain(camel);
    expect(claims).toEqual({
      subject: "user-1",
      issuer: "https://i/",
      tokenId: "jti-1",
      authMethods: ["pwd"],
    });
  });

  test("unregistered claims go to custom, camelCased, value untouched", () => {
    const { claims, custom } = joseToDomain({
      sub: "user-1",
      token_introspection: { active: true },
      acme_flag: "x",
    });
    expect(claims).toEqual({ subject: "user-1" });
    expect(custom).toEqual({
      tokenIntrospection: { active: true },
      acmeFlag: "x",
    });
  });
});

describe("custom claim case flip (R18 — Aegis-side, kits verbatim)", () => {
  test("write snake_cases the key, read camelCases it back, value untouched", () => {
    const domain: Dict = { acmeFlagValue: { keep: "AS-IS" } };
    const wire = domainToJose(domain);
    expect(wire).toEqual({ acme_flag_value: { keep: "AS-IS" } });

    const { custom } = joseToDomain(wire);
    expect(custom).toEqual({ acmeFlagValue: { keep: "AS-IS" } });
  });
});

describe("registry-complete extension (intentional, inert until Phase 4/13)", () => {
  test("joseToDomain now extracts txn/events that extractDomainClaims left in rest", () => {
    const wire: Dict = { iss: "https://i/", txn: "txn-1", events: { "urn:e": {} } };

    // Old mapper: txn/events fall through to `rest` (unextracted).
    const { rest } = extractDomainClaims(wire);
    expect(rest).toEqual({ txn: "txn-1", events: { "urn:e": {} } });

    // Translator: they are registered, so they resolve to their domain names.
    const { claims, custom } = joseToDomain(wire);
    expect(claims.transactionId).toBe("txn-1");
    expect(claims.events).toEqual({ "urn:e": {} });
    expect(custom).toEqual({});
  });
});
