import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import type { TokenProfile } from "../../types/index.js";
import { assembleCommonClaims } from "../utils/assemble-common-claims.js";
import { joseName } from "./claims-registry.js";
import { domainToJose, wireToDomain, wireToFloorClaims } from "./translate.js";

// The JOSE TOKEN read — what verify/parse run over a token's wire payload.
const joseToDomain = (wire: Dict) => wireToDomain(wire, joseName, "token");

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
  use: "both",
  typ: { presence: "none" },
  required: [],
  forbidden: [],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: [],
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
      authFactorCategories: ["knowledge", "possession"],
      authFactorReference: "2fa",
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

  // The write side snakes the address per OIDC Core §5.1, so the read side has
  // to camel it back or the round trip is asymmetric — handing snake keys into a
  // camelCase-typed shape. It used to share the `events` arm and pass through.
  test("should camel the address back on the way in", () => {
    const address = { streetAddress: "1 Byron Way", postalCode: "0001" };

    expect(joseToDomain(domainToJose({ address })).claims.address).toEqual(address);
  });

  // ⚠ The reason `events` cannot share the address arm: a SET events map is
  // keyed by event-type URIs (RFC 8417 §2.2). Those are identifiers, and
  // case-converting one rewrites the URI.
  test("should NOT case-convert the keys of a SET events map", () => {
    const events = {
      "https://schemas.openid.net/secevent/risc/event-type/account-disabled": {
        reason: "hijacking",
      },
    };

    expect(joseToDomain(domainToJose({ events })).claims.events).toEqual(events);
  });
});

describe("joseToDomain — the two read modes decode identically", () => {
  // A wire dict of ONLY the claims the FLOOR mode resolves, so both modes parse
  // the SAME set (txn/events/profile/sensitive are the domain mode's extension —
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
    afc: ["knowledge", "possession"],
    afr: "2fa",
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

  // The READ direction's frozen record. Its write twin is snapshotted above; this
  // is the only thing pinning the DECODED OUTPUT, so every per-claim decoder —
  // date, array scalar-tolerance, audience wrap, every bespoke builder — is
  // covered over the full 38-key wire dict at once.
  //
  // ⚠ It exists because the mode-equality test below CANNOT stand in for it: both
  // sides of that comparison run the same `decodeValue`, so a decoder change moves
  // them together and it stays green. Flipping `roles` from `array/"spaced"` to
  // `array/"strict"` — a wire `"admin editor"` silently decoding to `undefined` —
  // is exactly that shape, and it is this snapshot that catches it.
  test("the decoded claims match their frozen record", () => {
    expect(joseToDomain(wire).claims).toMatchSnapshot();
  });

  // The two modes share ONE set of per-claim decoders; the only things that may
  // differ are WHICH claims are resolved and how the leftovers are keyed. Over a
  // dict both modes fully resolve, the decoded claims must be equal — that is
  // what makes the floor mode a scope restriction rather than a second codec.
  // A SECONDARY check: it pins the scope-restriction property, not the decoders.
  test("the floor mode decodes registered claims IDENTICALLY to the domain mode", () => {
    expect(wireToFloorClaims(wire, joseName).claims).toEqual(joseToDomain(wire).claims);
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

  // ⚠ A TOKEN states a claim under its WIRE name and under nothing else. The
  // domain spelling is a name the PRESENTER chooses, so admitting it here would
  // let a custom claim answer for the registered one it resembles — which is how
  // a wire `aud: ["someone-else"]` beside a custom `audience: [me]` used to pass
  // an audience floor. Everything the pass does not resolve lands in `custom`.
  test("a token read resolves the wire name and NOT the domain spelling", () => {
    const camel: Dict = {
      subject: "user-1",
      issuer: "https://i/",
      tokenId: "jti-1",
      authMethods: ["pwd"],
    };
    const { claims, custom } = joseToDomain(camel);

    expect(claims).toEqual({});
    expect(custom).toEqual(camel);
  });

  // The PUBLIC vocabulary door is the one that answers to either spelling: its
  // input is a claim dict of unknown provenance, not a token deciding an access
  // decision. `Aegis.toDomain` documents that tolerance as its contract.
  test("the dict read accepts the domain spelling", () => {
    const camel: Dict = {
      subject: "user-1",
      issuer: "https://i/",
      tokenId: "jti-1",
      authMethods: ["pwd"],
    };
    const { claims } = wireToDomain(camel, joseName, "dict");

    expect(claims).toEqual(camel);
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

describe("auth factor claims — `afr` is the RESOLVED single factor, `afc` the categories", () => {
  const domain: Dict = {
    authFactorReference: "phrh",
    authFactorCategories: ["possession", "inherence"],
  };

  test("domain -> wire maps to the two distinct wire names", () => {
    expect(domainToJose(domain)).toEqual({
      afr: "phrh",
      afc: ["possession", "inherence"],
    });
  });

  test("domain -> wire -> domain round-trips both claims", () => {
    expect(joseToDomain(domainToJose(domain)).claims).toEqual(domain);
  });

  test("`afr` is a scalar: an array value decodes to undefined", () => {
    const { claims } = joseToDomain({ afr: ["2fa"] });
    expect(claims.authFactorReference).toBeUndefined();
  });

  test('`afc` is a strict array: a scalar decodes to undefined (no "spaced" split)', () => {
    const { claims } = joseToDomain({ afc: "knowledge possession" });
    expect(claims.authFactorCategories).toBeUndefined();
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
  test("the domain mode extracts txn/events that the floor mode leaves in custom", () => {
    const wire: Dict = { iss: "https://i/", txn: "txn-1", events: { "urn:e": {} } };

    // Floor mode: txn/events carry no `domainClaim` mark, so they fall through to
    // `custom` — unresolved and, crucially, under their ORIGINAL keys.
    expect(wireToFloorClaims(wire, joseName).custom).toEqual({
      txn: "txn-1",
      events: { "urn:e": {} },
    });

    // Domain mode: they are registered, so they resolve to their domain names.
    const { claims, custom } = joseToDomain(wire);
    expect(claims.transactionId).toBe("txn-1");
    expect(claims.events).toEqual({ "urn:e": {} });
    expect(custom).toEqual({});
  });
});

/**
 * The floor read is what the profiled verify pipeline asks "is this claim present
 * ON THE WIRE". Its two divergences from the domain read are deliberate and
 * load-bearing, so they are pinned here rather than left to be discovered by a
 * later simplification.
 */
describe("wireToFloorClaims — the verify-floor read mode", () => {
  const ISSUER = "https://test.lindorm.io/";

  test("leaves an UNRESOLVED key in custom VERBATIM, never case-converted", () => {
    // The whole point: a wire `expires_at` that camelCased to `expiresAt` would
    // satisfy an exp-presence floor it has no business satisfying.
    const { claims, custom } = wireToFloorClaims(
      {
        iss: ISSUER,
        expires_at: 978307200,
        token_introspection: { active: true },
        acme_flag: "x",
      },
      joseName,
    );

    expect(claims.expiresAt).toBeUndefined();
    expect(custom).toEqual({
      expires_at: 978307200,
      token_introspection: { active: true },
      acme_flag: "x",
    });
  });

  test("resolves ONLY the domainClaim-marked claims; a profile claim stays in custom", () => {
    const { claims, custom } = wireToFloorClaims(
      {
        iss: ISSUER,
        given_name: "Given",
        email: "user@example.com",
      },
      joseName,
    );

    expect(claims).toEqual({ issuer: ISSUER });
    expect(custom).toEqual({ given_name: "Given", email: "user@example.com" });
  });

  test("maps the wire sub_id to the domain subjectId (RFC 9493)", () => {
    const { claims, custom } = wireToFloorClaims(
      {
        iss: ISSUER,
        sub_id: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
      },
      joseName,
    );

    expect(claims).toMatchObject({
      issuer: ISSUER,
      subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
    });
    expect(custom).toEqual({});
  });

  // The floor asks "is this claim present ON THE WIRE". A key spelled like a
  // claim the floor resolves, that the pass did not consume, can only be a
  // LOOK-ALIKE — the real one would have been consumed under its wire name — so
  // it is DROPPED, not carried through in `custom`. The floor's caller flattens
  // the two dicts together, and leaving it in is what would let a presenter's
  // `audience` answer for an absent `aud`.
  test("drops a key spelled like a claim the floor resolves", () => {
    const { claims, custom } = wireToFloorClaims(
      { subjectId: { format: "opaque", id: "abc" } },
      joseName,
    );

    expect(claims).toEqual({});
    expect(custom).toEqual({});
  });

  // Only the RESOLVED set is filtered. A profile may require a claim under its
  // WIRE spelling, or one the floor does not resolve at all, and both have to
  // survive verbatim or the floor reports a present claim as missing.
  test("keeps an unresolved claim and a wire-spelled required claim verbatim", () => {
    const { custom } = wireToFloorClaims(
      { token_introspection: { active: true }, events: { "urn:e": {} }, acme: 1 },
      joseName,
    );

    expect(custom).toEqual({
      token_introspection: { active: true },
      events: { "urn:e": {} },
      acme: 1,
    });
  });

  test("resolves the wire sub_id", () => {
    const { claims, custom } = wireToFloorClaims(
      { sub_id: { format: "opaque", id: "abc" } },
      joseName,
    );

    expect(claims).toMatchObject({ subjectId: { format: "opaque", id: "abc" } });
    expect(custom).toEqual({});
  });

  test("drops a non-object sub_id", () => {
    expect(
      wireToFloorClaims({ sub_id: "not-an-object" }, joseName).claims.subjectId,
    ).toBeUndefined();
  });

  test("maps the wire conforms_to to the domain conformsTo", () => {
    const { claims, custom } = wireToFloorClaims(
      {
        conforms_to: ["urn:lindorm:profile:fapi", "urn:lindorm:profile:pci"],
      },
      joseName,
    );

    expect(claims.conformsTo).toEqual([
      "urn:lindorm:profile:fapi",
      "urn:lindorm:profile:pci",
    ]);
    expect(custom).toEqual({});
  });

  test("accepts the wire conforms_to as an array or a space-delimited string", () => {
    expect(
      wireToFloorClaims({ conforms_to: ["a", "b"] }, joseName).claims.conformsTo,
    ).toEqual(["a", "b"]);
    expect(wireToFloorClaims({ conforms_to: "a b" }, joseName).claims.conformsTo).toEqual(
      ["a", "b"],
    );
  });

  test("marks a wrongly-typed claim CONSUMED, so it lands in neither bucket", () => {
    // Preserved defect (finding #10): the key is consumed before decoding, so a
    // numeric `nonce` is invisible to a forbidden-claim check. Pinned so the
    // repair is a deliberate change, not an accident of a later refactor.
    const { claims, custom } = wireToFloorClaims({ iss: ISSUER, nonce: 12345 }, joseName);

    expect(claims.nonce).toBeUndefined();
    expect(custom.nonce).toBeUndefined();
  });
});
