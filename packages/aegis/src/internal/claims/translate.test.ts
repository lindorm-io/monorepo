import { SYNTHETIC_SPEC } from "../../__fixtures__/synthetic-spec.js";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import type { AegisDomainError } from "../../errors/index.js";
import type { TokenProfile } from "../../types/index.js";
import { assembleCommonClaims } from "../utils/assemble-common-claims.js";
import { CLAIM_SPECS, claimByDomain, coseName, joseName } from "./claims-registry.js";
import type { ClaimMemberSpec } from "../registry/claim-spec.js";
import { wireName } from "../registry/wire-key.js";
import {
  decodeClaim,
  domainToJose,
  domainToWire,
  encodeClaim,
  unreadableClaims,
  wireToDomain,
  wireToFloorClaims,
} from "./translate.js";

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
  policy: [],
  autoInject: [],
  issuer: "per-token",
  lifetime: null,
  encryptable: false,
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

  // ⚠⚠ COLLAPSING IT TO NO `cnf` AT ALL SILENTLY HANDS THE AUDIENCE A BEARER
  // TOKEN where the caller asked for a bound one (RFC 7800 §3), which is what the
  // `cnf` registry entry's "an empty one confirms no key and is refused" means.
  test("an all-empty confirmation is refused rather than minted as a bearer token", () => {
    const content: Dict = { subject: "s", confirmation: {} };
    const common = assembleCommonClaims(assembleCtx, permissiveProfile, content, {});

    expect(() => domainToJose(common)).toThrow(
      expect.objectContaining({ code: "claim_structure_invalid" }),
    );
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

  // The write side snakes the address (OIDC Core §5.1.1), so the read side has to
  // camel it back or the round trip is asymmetric — handing snake keys into a
  // camelCase-typed shape.
  test("should camel the address back on the way in", () => {
    const address = { streetAddress: "1 Byron Way", postalCode: "0001" };

    expect(joseToDomain(domainToJose({ address })).claims.address).toEqual(address);
  });

  // ⚠ EACH MEMBER DECODES THROUGH ITS OWN CODEC, so a foreign token cannot put a
  // number into a field the public `AegisProfileAddress` type declares as a
  // string. ⚠ SCOPE: this is the member resolved under its WIRE spelling. A
  // member presented under its DOMAIN spelling is REFUSED instead — a key that
  // resolves onto a declared member's outgoing key is a collision whether or not
  // that member is present.
  test("should not report an address member whose value is not what the member declares", () => {
    const wire = { address: { street_address: 42, locality: "Stockholm" } };

    expect(joseToDomain(wire).claims.address).toEqual({ locality: "Stockholm" });
  });

  // ⚠⚠ SYMMETRY: A MEMBER AEGIS WRITES IS A MEMBER AEGIS CAN READ BACK.
  //
  // A member declares a value shape and the read side enforces it, so the write
  // side must enforce the same one — otherwise aegis signs a token asserting a
  // member its own reader reports as never stated.
  //
  // ⚠ IT TAKES A WRONGLY-TYPED VALUE, NOT A `null`. A `null` member is an ABSENCE
  // ({@link isNotStated}), so it is omitted on both sides for a different reason
  // and states nothing about codec symmetry — see the boundary row below. Reaching
  // a wrong TYPE needs a cast past `AegisProfileAddress`, which is the honest
  // shape of this class: the declared type admits no value its own codec rejects.
  test("should refuse a wrongly-typed address member on BOTH sides, not just on the read", () => {
    const address = { region: 42 as unknown as string, locality: "Stockholm" };

    // The write side. This is the half that closes the disagreement.
    expect(domainToJose({ address }).address).toEqual({ locality: "Stockholm" });

    // The read side, for a token some other issuer wrote that way anyway.
    expect(joseToDomain({ address }).claims.address).toEqual({
      locality: "Stockholm",
    });
  });

  // ⚠⚠ THE SAME SYMMETRY, ONE LEVEL OUT. The row above states it for a MEMBER of
  // a structure; a top-level claim declares a value shape in the same registry and
  // is read back through the same decoder, so depth cannot be what decides whether
  // aegis signs a claim its own reader reports as never stated.
  test("should refuse a wrongly-typed top-level claim on BOTH sides, exactly as it does one level in", () => {
    expect(domainToJose({ subject: 42 as unknown as string })).toEqual({});
    expect(joseToDomain({ sub: 42 }).claims).toEqual({});
  });

  // The strict-array form of the same rule: `amr` tolerates no scalar on read
  // (`internal/claims/translate.ts#case "strict"`), so it must take none on write.
  test("should refuse a scalar for a top-level array claim whose codec tolerates none", () => {
    expect(domainToJose({ authMethods: "pwd" as unknown as Array<string> })).toEqual({});
    expect(joseToDomain({ amr: "pwd" }).claims).toEqual({});
  });

  // The CONTRAST that keeps the two rows above from being read as "a scalar is
  // dropped": an array claim whose codec DOES tolerate one keeps it, because the
  // read side keeps it. `aud` wraps (RFC 7519 §4.1.3) and `scope` splits.
  test("should carry a scalar for a top-level array claim whose codec tolerates one", () => {
    expect(domainToJose({ audience: "a" as unknown as Array<string> })).toEqual({
      aud: "a",
    });
    expect(joseToDomain({ aud: "a" }).claims.audience).toEqual(["a"]);

    expect(domainToJose({ scope: "a b" as unknown as Array<string> })).toEqual({
      scope: "a b",
    });
    expect(joseToDomain({ scope: "a b" }).claims.scope).toEqual(["a", "b"]);
  });

  // The WRITE half of the spaced policy: `spaced` states the WIRE FORM — the
  // value of the claim on the wire is one space-delimited string (RFC 8693
  // §4.2) — so the write side JOINS the domain list where the read side splits
  // it. `[]` joins to `""`, and whether that empty string rides is the
  // registry's `whenEmpty` column at emission, never this codec's.
  test("should join a spaced array claim to its space-delimited wire string", () => {
    expect(domainToJose({ scope: ["read", "write"] })).toEqual({ scope: "read write" });
    expect(domainToJose({ scope: [] })).toEqual({ scope: "" });
    expect(joseToDomain(domainToJose({ scope: ["read", "write"] })).claims.scope).toEqual(
      ["read", "write"],
    );
  });

  // The wire form cannot spell a space INSIDE a scope-token — space IS the
  // delimiter (RFC 6749 §3.3) — so a member containing one joins to bytes
  // identical to two members, and the read side reports the members those bytes
  // delimit.
  test("should re-read a member containing a space as the members it delimits", () => {
    expect(domainToJose({ scope: ["read write"] })).toEqual({ scope: "read write" });
    expect(joseToDomain({ scope: "read write" }).claims.scope).toEqual(["read", "write"]);
    expect(joseToDomain(domainToJose({ scope: ["read write"] })).claims.scope).toEqual([
      "read",
      "write",
    ]);
  });

  // The lindorm authority lists are STRICT arrays: RFC 9068 §2.2.3.1 provides
  // `roles` no string form, so a scalar under one of these names is not a
  // shorter spelling of the list — it reads as unstated, exactly as `amr` does,
  // and the write side refuses what its own reader would not keep. The array
  // itself rides untouched.
  test("should refuse a scalar for the lindorm authority lists on BOTH sides", () => {
    expect(domainToJose({ roles: "admin editor" as unknown as Array<string> })).toEqual(
      {},
    );
    expect(joseToDomain({ roles: "admin editor" }).claims.roles).toBeUndefined();
    expect(joseToDomain({ conforms_to: "strict" }).claims.conformsTo).toBeUndefined();

    expect(domainToJose({ roles: ["admin", "editor"] })).toEqual({
      roles: ["admin", "editor"],
    });
  });

  // The BOUNDARY row: the same two doors, the same member, a `null` instead — and
  // the same bytes, for a different reason. It is here rather than folded into
  // the row above because the two are separate rules that happen to agree on a
  // TEXT member, and they come apart the moment the member's codec is a
  // structure or the member is undeclared (see `classes/address-claim-wire.test.ts`).
  test("should treat a null address member as unstated on BOTH sides", () => {
    const address = { region: null, locality: "Stockholm" };

    expect(domainToJose({ address }).address).toEqual({ locality: "Stockholm" });
    expect(joseToDomain({ address }).claims.address).toEqual({
      locality: "Stockholm",
    });
  });

  // The contrast that keeps the rule above from being read as "empty members are
  // dropped": `""` IS a text value, so the codec accepts it and the member's own
  // `whenEmpty: "keep"` is what decides — which is the division of labour that
  // column's docstring claims.
  test("should carry an EMPTY-STRING address member, which the codec accepts", () => {
    const address = { postalCode: "", locality: "Stockholm" };

    expect(domainToJose({ address }).address).toEqual({
      postal_code: "",
      locality: "Stockholm",
    });
    expect(joseToDomain(domainToJose({ address })).claims.address).toEqual(address);
  });

  // The OPEN half: a declared member set is not an allowlist. The undeclared
  // member keeps the mechanical case flip at EVERY depth, which is what the
  // blanket conversion did and what a top-level-only flip would silently stop
  // doing — the round trip is what makes the depth observable.
  test("should carry an undeclared address member at every depth, in both directions", () => {
    const address = {
      streetAddress: "1 Byron Way",
      deliveryNote: { doorCode: "1234" },
    };

    expect(domainToJose({ address }).address).toEqual({
      street_address: "1 Byron Way",
      delivery_note: { door_code: "1234" },
    });
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
    roles: ["admin", "editor"],
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
  // them together and it stays green. Flipping `scope` from `array/"spaced"` to
  // `array/"strict"` — a wire `"read write"` silently decoding to `undefined` —
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
  // domain spelling is a name the PRESENTER chooses, so admitting it here lets a
  // custom claim answer for the registered one it resembles — a wire
  // `aud: ["someone-else"]` beside a custom `audience: [me]` passing an audience
  // floor. Everything the pass does not resolve lands in `custom`.
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

describe("custom claim case flip (Aegis-side, kits verbatim)", () => {
  test("write snake_cases the key, read camelCases it back, value untouched", () => {
    const domain: Dict = { acmeFlagValue: { keep: "AS-IS" } };
    const wire = domainToJose(domain);
    expect(wire).toEqual({ acme_flag_value: { keep: "AS-IS" } });

    const { custom } = joseToDomain(wire);
    expect(custom).toEqual({ acmeFlagValue: { keep: "AS-IS" } });
  });
});

describe("registry-complete extension", () => {
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

  /**
   * ⛔⛔ THE FLOOR READ IS WHERE `__proto__` ARRIVES UNCONVERTED. Unlike the
   * camelCase modes it declares `customKey: (key) => key`, so a wire key reaches
   * the custom bag as written — and this door rebuilds that bag a SECOND time to
   * drop the names a floor claim would shadow. Both rebuilds must DEFINE their
   * keys: an assignment makes `__proto__` the bag's prototype instead of a member,
   * which DROPS it — and the floor payload is what a profile is judged against, so
   * a dropped claim is a claim set the token did not present.
   *
   * ⚠ THIS CALLS AN INTERNAL FUNCTION, NOT A PUBLIC DOOR, and the distinction is
   * the point: the second rebuild lives in `wireToFloorClaims`, so a measurement
   * taken at `wireToDomain` passes while this one fails. What a PUBLIC door
   * observes is different again — `aegis.verify(token, { profile })` reports the
   * TOKEN-mode bag (case-converted, `custom: { proto: … }`), never this one, which
   * `internal/utils/verify-token.ts` consumes into `enforceVerifyFloor` and
   * discards. So this row pins the FLOOR JUDGEMENT's input, not anything a caller
   * receives.
   *
   * ⚠ ASSERT ON THE PROPERTY AND THE PROTOTYPE. `Object.keys`/`JSON.stringify`
   * render a swapped prototype as absent, so either alone reads clean on exactly
   * the hostile input.
   */
  test("carries a `__proto__` wire key as an own key and swaps no prototype", () => {
    const { custom } = wireToFloorClaims(
      JSON.parse(
        `{"iss":"${ISSUER}","__proto__":{"aud":"https://victim.example/"}}`,
      ) as Dict,
      joseName,
    );

    expect((custom as Dict).aud).toBeUndefined();
    expect(Object.getPrototypeOf(custom)).toBe(Object.prototype);
    expect(Object.keys(custom as Dict)).toContain("__proto__");
    expect(({} as Dict).aud).toBeUndefined();
  });

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

  // ⚠ REPORTING A NON-OBJECT `sub_id` AS ABSENT tells the profile floor that a
  // token states no subject identifier when it states one this package cannot
  // read. A declared structure refuses a value that contradicts it at every door,
  // and the floor read is a door.
  test("refuses a non-object sub_id rather than reporting the token as stating none", () => {
    expect(() => wireToFloorClaims({ sub_id: "not-an-object" }, joseName)).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "subjectId",
          invalid: [{ key: "subjectId", message: 'Claim "subjectId" must be an object' }],
        },
      }) as unknown as Error,
    );
  });

  // ⚠ `null` IS NOT A CONTRADICTION, IT IS AN ABSENCE — the sibling of the row
  // above, and the whole of the boundary between them. A wire `null` is the ONLY
  // spelling of absence JSON and CBOR can carry, so this is the case a stranger's
  // token actually exercises.
  test("reads a null sub_id as a claim the token does not state", () => {
    const { claims, custom } = wireToFloorClaims({ sub_id: null }, joseName);

    expect(claims.subjectId).toBeUndefined();
    expect(custom).toEqual({});
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

  // `conforms_to` is a STRICT array — lindorm's own claim, so there is no
  // registered string form for a scalar to spell (its registry `spec` cell is
  // policy) and a foreign scalar reads as unstated, like `groups`/`entitlements`.
  test("accepts the wire conforms_to as an array; a scalar reads as unstated", () => {
    expect(
      wireToFloorClaims({ conforms_to: ["a", "b"] }, joseName).claims.conformsTo,
    ).toEqual(["a", "b"]);
    expect(
      wireToFloorClaims({ conforms_to: "a b" }, joseName).claims.conformsTo,
    ).toBeUndefined();
  });

  test("marks a wrongly-typed claim CONSUMED, so it lands in neither bucket", () => {
    // ⚠ A PRESERVED SHORTFALL: the pass marks a key CONSUMED before its codec
    // rejects the value, so a wrongly-typed claim lands in neither `claims` nor
    // `custom` — a numeric `nonce` is invisible to a forbidden-claim check that
    // reads either bucket. Pinned so the repair is a deliberate change rather than
    // an accident of a later refactor.
    const { claims, custom } = wireToFloorClaims({ iss: ISSUER, nonce: 12345 }, joseName);

    expect(claims.nonce).toBeUndefined();
    expect(custom.nonce).toBeUndefined();
  });
});

/**
 * The claim read resolves a name by asking whether the payload CARRIES it, and
 * the payload is a stranger's: a decoded token, or the dict a public door was
 * handed. `in` walks the prototype chain, so it answers YES for `toString`,
 * `constructor`, `valueOf`, `hasOwnProperty` and `__proto__` on every object
 * literal there is.
 *
 * ⚠ TWO DIFFERENT PROPOSITIONS ARE PINNED BELOW:
 *   1. NO REGISTERED NAME COLLIDES with an `Object.prototype` member — DERIVED
 *      from the registry, so it goes red the day a claim named `constructor` is
 *      registered.
 *   2. THE LOOKUP DOES NOT WALK THE PROTOTYPE — a separate fact, and the only one
 *      surviving the registry changing underneath it.
 * ⛔ The first does NOT imply the second: with proposition 1 alone, swapping
 * `Object.hasOwn` for `in` leaves the whole suite at its baseline. A collision is
 * not the only way to reach the fault — ANY library in the process that writes to
 * `Object.prototype` supplies one, and then a token states a claim it does not
 * carry. The polluted-prototype test is proposition 2.
 */
describe("a stranger's payload cannot answer through Object.prototype", () => {
  const PROTOTYPE_MEMBERS: ReadonlyArray<string> = Object.getOwnPropertyNames(
    Object.prototype,
  );

  test("no registered claim's DOMAIN or WIRE name is an Object.prototype member", () => {
    // DERIVED from the registry, both vocabularies, because both are looked up:
    // the token read asks for the wire name, the dict door asks for the domain
    // name first and the wire name second.
    const collisions = CLAIM_SPECS.filter(
      (spec) =>
        PROTOTYPE_MEMBERS.includes(spec.domain) ||
        PROTOTYPE_MEMBERS.includes(joseName(spec)) ||
        PROTOTYPE_MEMBERS.includes(coseName(spec)),
    ).map((spec) => spec.domain);

    expect(collisions).toEqual([]);
  });

  test("a payload carrying prototype-member keys resolves them into custom, verbatim", () => {
    // `__proto__` must be an OWN key, which an object literal cannot give it —
    // `{ __proto__: x }` sets the prototype instead. JSON.parse is the door a
    // real token comes through, and it makes the key own.
    const wire = JSON.parse(
      '{"iss":"https://issuer.lindorm.test","toString":"not a function","constructor":"not a constructor","__proto__":{"injected":true},"hasOwnProperty":42}',
    ) as Dict;

    const { claims, custom } = joseToDomain(wire);

    expect(claims.issuer).toBe("https://issuer.lindorm.test");
    // Every prototype-named key is UNREGISTERED, so it belongs in `custom` with
    // its VALUE untouched — and nothing it names may reach the claims bucket.
    //
    // ⚠ `__proto__` arrives as `proto`, and that is the token read's ordinary
    // `customKey: camelCase` doing its job, not a special case: `camelCase`
    // strips the underscores. Asserted rather than glossed over, because it is
    // the one prototype-named key whose SURVIVING SPELLING matters — a `custom`
    // bucket handed back with a literal `__proto__` key would be a pollution
    // hazard for whatever the consumer spreads it into.
    expect(Object.keys(custom).sort()).toEqual([
      "constructor",
      "hasOwnProperty",
      "proto",
      "toString",
    ]);
    expect(custom.toString).toBe("not a function");
    expect(custom.constructor).toBe("not a constructor");
    expect(custom.hasOwnProperty).toBe(42);
    expect(custom.proto).toEqual({ injected: true });
  });

  test("the DICT door — which also asks by DOMAIN name — answers the same way", () => {
    const wire = JSON.parse(
      '{"subject":"user-1","valueOf":"not a function","propertyIsEnumerable":["nope"]}',
    ) as Dict;

    const { claims, custom } = wireToDomain(wire, joseName, "dict");

    expect(claims.subject).toBe("user-1");
    expect(custom).toEqual({
      valueOf: "not a function",
      propertyIsEnumerable: ["nope"],
    });
  });

  test("an EMPTY payload resolves no claim at all", () => {
    // The sharpest form of the same question: with `in`, every prototype member
    // is present on `{}`, so a registry name that collided would resolve out of
    // an empty object. Nothing may.
    const { claims, custom } = joseToDomain({});

    expect(claims).toEqual({});
    expect(custom).toEqual({});
  });

  test("a POLLUTED Object.prototype cannot make a token state a claim it omits", () => {
    // ⛔⛔ THE MECHANISM ITSELF, and the only test here that survives the registry
    // changing. The two above rest on "no registered name is an
    // `Object.prototype` member" — true today, and a proposition about the
    // REGISTRY rather than about the LOOKUP. This one needs no collision at all:
    // it puts a REGISTERED wire name onto the prototype, which is what any
    // library in the process that writes to `Object.prototype` does by accident.
    //
    // With `in`, `wireLookup` answers YES for `aud` on a payload that carries no
    // `aud`, and the decoder then reads the polluted value as the claim — so a
    // token would state an audience its issuer never wrote, which is an access
    // decision handed to whatever else is loaded in the process.
    //
    // ⚠ `defineProperty` non-enumerable, so the pollution cannot reach `custom`
    // through `Object.entries` and be caught for the wrong reason: the ONLY way it
    // can be observed is the lookup asking about it.
    Object.defineProperty(Object.prototype, "aud", {
      value: ["evil-rs"],
      configurable: true,
      enumerable: false,
      writable: true,
    });

    try {
      const { claims, custom } = joseToDomain({ sub: "user-1" });

      expect(claims.subject).toBe("user-1");
      expect(claims.audience).toBeUndefined();
      expect(custom).toEqual({});
    } finally {
      // A `finally` because a leaked `Object.prototype.aud` would corrupt every
      // test that runs after this one in the same worker.
      delete (Object.prototype as Dict).aud;
    }
  });

  test("the DICT door resolves the DOMAIN spelling when a dict carries BOTH", () => {
    // ⚠ THE ONE READ MODE WHOSE LOOKUP IS DELIBERATELY PERMISSIVE, and precedence
    // is the entire content of that permission. `eitherLookup` asks for the domain
    // name FIRST — but which half wins is only observable when a dict carries both
    // spellings, and reversing the two ternary arms is otherwise invisible.
    //
    // Domain-first is the right way round because this door's input is a claim
    // dict of unknown provenance that may ALREADY be domain-shaped (an aegis read
    // handed back in), and the domain spelling is the one this package produced.
    // ⚠ It is the opposite of the TOKEN modes, where only the wire name may answer
    // — there the presenter chooses the domain spelling and the issuer chose the
    // other one, so accepting either would hand the decision to the presenter.
    const { claims } = wireToDomain(
      { sub: "wire-spelling", subject: "domain-spelling" },
      joseName,
      "dict",
    );

    expect(claims.subject).toBe("domain-spelling");
  });

  /**
   * ⛔⛔ `events` IS THE STRUCTURED CLAIM WITH NO MEMBER SET, so `eventsMap`
   * passes the object through instead of rebuilding it and the claim never reaches
   * the `emit` that keeps `act`'s tail safe. This row is what makes that reachable
   * from the outside: rewriting either arm to rebuild the map with
   * `out[key] = value` makes a `__proto__` event-type key the map's PROTOTYPE and
   * DROPS the member, so every event type the token does not state answers with
   * the producer's payload.
   *
   * ⚠ ASSERT ON THE PROPERTY AND THE PROTOTYPE. `Object.keys`/`JSON.stringify`
   * render a swapped prototype as absent, so either alone reads clean on exactly
   * this input.
   */
  test("carries a `__proto__` event-type key as an own key", () => {
    const events = JSON.parse(
      '{"urn:lindorm:event:rtbf":{},"__proto__":{"injected":true}}',
    ) as Dict;

    const read = joseToDomain({ events }).claims.events as Dict;

    expect(Object.getPrototypeOf(read)).toBe(Object.prototype);
    expect(Object.keys(read)).toContain("__proto__");
    expect(Object.getOwnPropertyDescriptor(read, "__proto__")?.value).toEqual({
      injected: true,
    });

    // The event type the token DID state is untouched, so the row cannot pass by
    // the read having dropped everything.
    expect(read["urn:lindorm:event:rtbf"]).toEqual({});
  });
});

/**
 * THE STRUCTURE WALKER'S DIRECTION GUARD.
 *
 * `walkObject` runs the SAME code for writing and reading, which is what makes
 * it worth having — and is exactly why a rule that holds in only one direction
 * cannot be left to it. `whenEmpty` is such a rule: `ParamSpec.whenEmpty` states
 * that the prune decides what AEGIS EMITS, because a read reports what a
 * PRODUCER wrote, and rewriting a foreign token's empty member into an absence
 * would make aegis misreport a stranger's token.
 *
 * ⚠ THE REGISTRY'S OWN `"prune"` MEMBERS CANNOT OBSERVE IT. Both of them —
 * `authorization-details-members.ts`'s `type` and `sub_id`'s `format` — also carry
 * `required: true`, so an empty value is refused before the prune could be seen
 * choosing anything, in either direction; every other declared member is
 * `whenEmpty: "keep"`. ⇒ The synthetic member below is the only thing that
 * observes the rule, and a `"prune"` member arriving WITHOUT a `required` cell
 * would not announce itself — a symmetric walk is symmetric by construction.
 */
describe("walkObject — the structure walker's direction guard", () => {
  const member = (
    domain: string,
    wire: string,
    whenEmpty: "keep" | "prune",
  ): ClaimMemberSpec => ({
    domain,
    spec: SYNTHETIC_SPEC,
    wire: { jose: wireName(wire), cose: wireName(wire) },
    codec: { kind: "text" },
    whenEmpty,
    sample: "sample",
  });

  /** A synthetic structured claim carrying one member of each verdict. */
  const structured: ClaimMemberSpec = {
    domain: "synthetic",
    spec: SYNTHETIC_SPEC,
    wire: { jose: wireName("synthetic"), cose: wireName("synthetic") },
    codec: {
      kind: "object",
      children: () => [
        member("kept", "kept", "keep"),
        member("pruned", "pruned", "prune"),
      ],
      open: "closed",
    },
    whenEmpty: "keep",
    sample: {},
  };

  test("a prune member's EMPTY value does not reach the wire", () => {
    expect(encodeClaim(structured, { kept: "", pruned: "" }, joseName)).toEqual({
      kept: "",
    });
  });

  test("a prune member's NON-empty value reaches the wire", () => {
    // Without this, the test above would also pass for a walker that dropped
    // every `prune` member unconditionally.
    expect(encodeClaim(structured, { kept: "a", pruned: "b" }, joseName)).toEqual({
      kept: "a",
      pruned: "b",
    });
  });

  test("a prune member's EMPTY value IS reported when a producer wrote one", () => {
    // ⭐ THE DIRECTION HALF. A foreign token states `pruned: ""`; the issuer said
    // "empty", and a read that silently converted that into "said nothing" would
    // report a token the issuer did not write. `whenEmpty` has no vote here.
    expect(decodeClaim(structured, { kept: "", pruned: "" }, joseName)).toEqual({
      kept: "",
      pruned: "",
    });
  });

  /**
   * ⛔⛔ AN OPEN TAIL'S KEY IS THE PRODUCER'S OWN. `act` is `open: "verbatim"`
   * (RFC 8693 §4.1), so an undeclared member reaches the emit under the spelling
   * the token wrote — and `__proto__` is a legal JSON member name that
   * `JSON.parse` makes an ordinary own property. The emit DEFINES its key; under
   * `out[outKey] = outValue` the member is DROPPED and becomes the actor's
   * PROTOTYPE, so every name the actor does not state answers with the producer's
   * value instead of `undefined`.
   *
   * ⚠ ASSERT ON THE PROPERTY AND THE PROTOTYPE. `Object.keys`/`JSON.stringify`
   * render a swapped prototype as absent, so either alone reads clean on exactly
   * the hostile input.
   */
  test("carries a `__proto__` member of an open tail as an own key", () => {
    const { claims } = joseToDomain(
      JSON.parse('{"act":{"sub":"audited","__proto__":{"subject":"attacker"}}}') as Dict,
    );
    const act = claims.act as Dict;

    expect(act.subject).toBe("audited");
    expect(Object.getPrototypeOf(act)).toBe(Object.prototype);
    expect(Object.keys(act)).toContain("__proto__");
  });

  /**
   * WHERE A REFUSAL SAYS THE BAD MEMBER IS.
   *
   * ⚠ THE REGISTRY REACHES DEPTH: `act-members.ts` names `ACT_MEMBERS` inside
   * itself, so `act` and `mayAct` nest without limit and the conformance rows
   * `a-caller-cannot-write-two-spellings-of-one-structured-member` and
   * `an-actor-carries-an-identity-claim-the-registry-does-not-declare` drive real
   * paths like `act.act.<member>` through the public mint door.
   *
   * ⭐ EXACTLY ONE TEST STOPS `WalkContext.claim` BEING AN EQUIVALENT MUTANT.
   * `claim` is read at the claim boundary and in ONE place a CHILD context can
   * reach — {@link walkElements}'s non-array message, which needs a MEMBER whose
   * codec is `array` WITH `of`. `act`'s `audience` is an array with NO `of`, so
   * `sub_id.identifiers` (RFC 9493 §3.2.8) is the only member of that shape, and
   * `classes/sub-id-claim-wire.test.ts`'s "a non-array `identifiers` is refused as
   * a violation of the CLAIM, not of the member" is the only row that reddens when
   * `childPath` is rewritten to `claim: step`.
   */
  describe("the path a structural refusal reports", () => {
    const required: ClaimMemberSpec = {
      domain: "subject",
      spec: SYNTHETIC_SPEC,
      wire: { jose: wireName("subject"), cose: wireName("subject") },
      codec: { kind: "text" },
      whenEmpty: "keep",
      required: true,
      sample: "actor",
    };

    const nested: ClaimMemberSpec = {
      domain: "inner",
      spec: SYNTHETIC_SPEC,
      wire: { jose: wireName("inner"), cose: wireName("inner") },
      codec: { kind: "object", children: () => [required], open: "closed" },
      whenEmpty: "keep",
      sample: {},
    };

    /** TWO claims over ONE member set — exactly `act`/`mayAct`'s relationship. */
    const outer = (domain: string): ClaimMemberSpec => ({
      domain,
      spec: SYNTHETIC_SPEC,
      wire: { jose: wireName(domain), cose: wireName(domain) },
      codec: { kind: "object", children: () => [nested], open: "closed" },
      whenEmpty: "keep",
      sample: {},
    });

    const refusalOf = (act: () => unknown): unknown => {
      try {
        act();
        return "no refusal";
      } catch (error) {
        return (error as AegisDomainError).data;
      }
    };

    test("names the CLAIM entered, not the member that happens to hold the set", () => {
      // Both claims share `nested`, so a refusal built from the member's own
      // domain reports the same name for both — and a caller told `inner` has
      // been handed the name of something they never wrote.
      for (const domain of ["act", "mayAct"]) {
        expect(
          refusalOf(() =>
            encodeClaim(outer(domain), { inner: { subject: "" } }, joseName),
          ),
        ).toEqual({
          claim: domain,
          invalid: [
            {
              key: `${domain}.inner.subject`,
              message: 'Member "subject" is required and must not be empty',
            },
          ],
        });
      }
    });

    /**
     * A `required` member whose DOMAIN and WIRE spellings DIVERGE.
     *
     * ⛔⛔ NOTHING IN THE REGISTRY HAS THIS SHAPE, WHICH IS WHY IT IS BUILT HERE.
     * Both `required` members — `authorization_details`'s `type` and `sub_id`'s
     * `format` — spell identically on all three names, as does the synthetic
     * `subject` above, so without this claim the refusal's VOCABULARY is unpinned:
     * rewriting the loop's `member.domain` to `direction.outKeyOf(member)` leaves
     * the whole suite at its baseline while a WRITE-side refusal starts reporting
     * `place.street_address`.
     */
    const divergent: ClaimMemberSpec = {
      domain: "streetAddress",
      spec: SYNTHETIC_SPEC,
      wire: { jose: wireName("street_address"), cose: wireName("street_address") },
      codec: { kind: "text" },
      whenEmpty: "keep",
      required: true,
      sample: "Storgatan 1",
    };

    const place: ClaimMemberSpec = {
      domain: "place",
      spec: SYNTHETIC_SPEC,
      wire: { jose: wireName("place"), cose: wireName("place") },
      codec: { kind: "object", children: () => [divergent], open: "closed" },
      whenEmpty: "keep",
      sample: {},
    };

    test("names a required member in the DOMAIN vocabulary, whichever way it crosses", () => {
      // Aegis's errors speak the domain vocabulary — a caller repairing a token
      // works in the names they wrote, not in the wire's. The package states that
      // rule for the profile layer (`internal/utils/rules/sub-id-shape.ts` carries
      // a note about nothing else); the walker's own version is asserted here.
      //
      // ⚠ THE INPUT KEY DIFFERS BY DIRECTION AND THE REPORT DOES NOT — that IS the
      // rule. A write is keyed by the domain name, a read by the wire name, and
      // both refusals say `streetAddress`.
      expect(
        refusalOf(() => encodeClaim(place, { streetAddress: "" }, joseName)),
      ).toEqual({
        claim: "place",
        invalid: [
          {
            key: "place.streetAddress",
            message: 'Member "streetAddress" is required and must not be empty',
          },
        ],
      });

      expect(
        refusalOf(() => decodeClaim(place, { street_address: "" }, joseName)),
      ).toEqual({
        claim: "place",
        invalid: [
          {
            key: "place.streetAddress",
            message: 'Member "streetAddress" is required and must not be empty',
          },
        ],
      });
    });

    test("locates the member by its FULL path, in both directions", () => {
      // A key measured from the member (`inner.subject`) is indistinguishable
      // from the same member one level up, so a repair instruction built on it
      // points at a place that may not be the broken one.
      for (const cross of [encodeClaim, decodeClaim]) {
        expect(
          refusalOf(() => cross(outer("act"), { inner: { subject: "" } }, joseName)),
        ).toEqual({
          claim: "act",
          invalid: [
            {
              key: "act.inner.subject",
              message: 'Member "subject" is required and must not be empty',
            },
          ],
        });
      }
    });
  });
});

/**
 * A CLOSED MEMBER SET — the third {@link ObjectCodec.open} disposition, and the
 * ONLY thing that exercises it.
 *
 * ⛔⛔ NO REGISTERED CLAIM IS CLOSED — the two candidates are ruled out by their
 * own specifications (RFC 8693 §4.1, RFC 8693 §4.4, RFC 7800 §3.1). So the arm has
 * no user in `claims-registry.ts` and this file is what keeps it live, which is
 * why every synthetic here declares `open: "closed"` rather than copying a real
 * claim's value: a closed synthetic ALSO refuses a typo'd input key in a test
 * about something else, where an open one carries it on the tail and passes.
 *
 * ⚠ THE CELL IS REQUIRED FOR THE SILENT DEFAULT, NOT FOR THIS ARM. An optional
 * `open` whose absence means closed drops a structure into the strictest
 * disposition by omission — which is how a NESTED `act` member ships closed while
 * `act` itself is open, with nothing red anywhere.
 *
 * ⚠⚠ A CLOSED SET REFUSES; IT DOES NOT DROP. A drop is invisible from both sides,
 * so it would be strictly weaker than the rule it replaces.
 */
describe("a CLOSED member set", () => {
  const declared: ClaimMemberSpec = {
    domain: "subject",
    spec: SYNTHETIC_SPEC,
    wire: { jose: wireName("sub"), cose: wireName("sub") },
    codec: { kind: "text" },
    whenEmpty: "keep",
    sample: "actor",
  };

  const closed: ClaimMemberSpec = {
    domain: "actor",
    spec: SYNTHETIC_SPEC,
    wire: { jose: wireName("actor"), cose: wireName("actor") },
    codec: { kind: "object", children: () => [declared], open: "closed" },
    whenEmpty: "keep",
    sample: {},
  };

  /** The same set, OPEN — the control that says the refusal is the cell's doing. */
  const opened: ClaimMemberSpec = {
    domain: "actor",
    spec: SYNTHETIC_SPEC,
    wire: { jose: wireName("actor"), cose: wireName("actor") },
    codec: { kind: "object", children: () => [declared], open: "verbatim" },
    whenEmpty: "keep",
    sample: {},
  };

  const refusalOf = (act: () => unknown): unknown => {
    try {
      act();
      return "no refusal";
    } catch (error) {
      return (error as AegisDomainError).data;
    }
  };

  test("carries its DECLARED members in both directions", () => {
    // Without this, every assertion below is satisfied by a codec that refused
    // the whole structure.
    expect(encodeClaim(closed, { subject: "service-1" }, joseName)).toEqual({
      sub: "service-1",
    });
    expect(decodeClaim(closed, { sub: "service-1" }, joseName)).toEqual({
      subject: "service-1",
    });
  });

  test("refuses an undeclared member on the WRITE side, naming its full path", () => {
    expect(
      refusalOf(() =>
        encodeClaim(closed, { subject: "service-1", surprise: "x" }, joseName),
      ),
    ).toEqual({
      claim: "actor",
      invalid: [
        {
          key: "actor.surprise",
          message: 'Member "surprise" is not declared in "actor"',
        },
      ],
    });
  });

  test("refuses an undeclared member on the READ side too", () => {
    // ⭐ THE DIRECTION HALF, and the one a round trip cannot see. A stranger's
    // token is where an undeclared member actually arrives.
    expect(
      refusalOf(() => decodeClaim(closed, { sub: "service-1", surprise: "x" }, joseName)),
    ).toEqual({
      claim: "actor",
      invalid: [
        {
          key: "actor.surprise",
          message: 'Member "surprise" is not declared in "actor"',
        },
      ],
    });
  });

  test("refuses rather than DROPS — the same member rides an open tail", () => {
    // The control. `open: "verbatim"` is the only difference between the two
    // declarations, so a walker that had stopped reading the cell would carry the
    // member in both and this row is what notices.
    expect(
      encodeClaim(opened, { subject: "service-1", surprise: "x" }, joseName),
    ).toEqual({ sub: "service-1", surprise: "x" });
  });
});

describe("unreadableClaims — the top-level claims the mint writer leaves off the wire", () => {
  test("unreadableClaims names a top-level claim whose value fails its leaf codec", () => {
    expect(
      unreadableClaims({
        subject: 42,
        authMethods: "pwd",
        audience: ["a"],
        clientId: "c",
      }),
    ).toEqual(new Set(["subject", "authMethods"]));
  });

  // An unregistered claim has no declared kind to fail; `null` is an absence; a
  // non-object for a structure walks to `undefined` AND is refused, and the
  // refusal is `encodeClaim`'s to report, not a drop.
  test("unreadableClaims omits an unregistered claim, an unstated value and a refused structure", () => {
    expect(unreadableClaims({ region: 42, subject: null, act: "service-a" })).toEqual(
      new Set(),
    );
  });

  test("unreadableClaims asks each claim on a fresh context, so a refused structure does not mask a later leaf failure", () => {
    expect(unreadableClaims({ act: "service-a", subject: 42 })).toEqual(
      new Set(["subject"]),
    );
  });

  test("unreadableClaims agrees with what domainToWire leaves off under both selectors", () => {
    const common: Dict = {
      subject: 42,
      authMethods: "pwd",
      audience: "a",
      scope: "a b",
      tokenId: "t",
      clientId: "c",
      region: 42,
    };
    const jose = domainToWire(common, joseName);
    const cose = domainToWire(common, coseName);

    // The registered keys present in `common` and absent from ONE output — built
    // per wire so that the two can disagree.
    const leftOffJose = new Set(
      Object.keys(common).filter((key) => {
        const spec = claimByDomain(key);

        return spec !== undefined && !Object.hasOwn(jose, joseName(spec));
      }),
    );
    const leftOffCose = new Set(
      Object.keys(common).filter((key) => {
        const spec = claimByDomain(key);

        return spec !== undefined && !Object.hasOwn(cose, coseName(spec));
      }),
    );

    expect(leftOffJose).toEqual(new Set(["subject", "authMethods"]));
    expect(leftOffCose).toEqual(leftOffJose);
    expect(unreadableClaims(common)).toEqual(leftOffJose);
    expect(unreadableClaims(common)).toEqual(leftOffCose);
  });
});
