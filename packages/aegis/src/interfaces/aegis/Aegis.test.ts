import { describe, expect, expectTypeOf, test } from "vitest";
import type {
  AccessTokenContent,
  DefaultContent,
  IdTokenContent,
  JwtClaimsWire,
  ProfileContentFor,
  SignContent,
  JoseVerifiedStructuredToken,
} from "../../types/index.js";
import type { SecurityEvents } from "../../internal/claims/events.js";
import type { IAegis } from "./Aegis.js";

/**
 * The COMPILE-TIME contract of the public surface — `mint`'s content typing and
 * `verify`'s profile narrowing. The compiler is the oracle here; nothing in this
 * file performs a cryptographic operation, and nothing needs to.
 *
 * ⚠ It sits beside `IAegis` because that is the declaration it constrains, and
 * it is NOT a conformance row: a row states what a token does on a wire, and
 * these failures happen before a token exists. They are also silent at runtime —
 * a content type that stops constraining anything mints exactly the same token —
 * which is why they need a test at all.
 *
 * The subject is a bare cast rather than a constructed `Aegis`: every assertion
 * below is about types, and building a deployment would add a vault, a clock and
 * a logger to a file that reads none of them.
 */
const aegis = {} as IAegis;

const RESOURCE = "https://rs.lindorm.io/";

/**
 * NEVER INVOKED — the compiler IS the assertion.
 *
 * `mint` has ONE signature whose content type resolves from the profile NAME, so
 * an inline literal has nothing to fall through to. A typed/loose overload pair
 * would not hold: `string & {}` accepts `"access_token"` as readily as any other
 * string, so a literal failing the typed overload compiles as the whole
 * `SignContent` vocabulary and the content types constrain nothing.
 *
 * ⚠ The guard runs in BOTH directions, which is why the un-marked calls matter
 * as much as the marked ones: an unused `@ts-expect-error` is itself a compile
 * error, so reintroducing the fall-through fails here — and closing the escape
 * hatch for custom profiles fails here too.
 */
export const _mintContentGuards = (): void => {
  // `federationAssuranceLevel` is a real member of the domain vocabulary and `1`
  // is a valid value for it — it is simply not a claim an access token may
  // assert.
  void aegis.mint("access_token", {
    subject: "user-1",
    audience: [RESOURCE],
    clientId: "client-1",
    // @ts-expect-error - not picked by AccessTokenContent
    federationAssuranceLevel: 1,
  });

  // `clientId` is required on an access token and absent from an id token, whose
  // audience IS the client. Neither direction may leak into the other.
  // OIDC Core §2.
  void aegis.mint(
    "id_token",
    {
      subject: "user-1",
      audience: ["client-1"],
      // @ts-expect-error - not picked by IdTokenContent
      clientId: "client-1",
    },
    { context: { accessTokenIssued: false } },
  );

  // A member outside the vocabulary entirely.
  void aegis.mint("access_token", {
    subject: "user-1",
    audience: [RESOURCE],
    clientId: "client-1",
    // @ts-expect-error - not a domain claim at all
    totallyUnknownMember: "x",
  });

  // An actor claim declares no audience member, so `ActClaim.audience` is typed
  // `never` — AEGIS POLICY AT THE MINT DOOR, RFC 8693 §4.1. It is the ONE actor
  // rule the compiler carries, and it reaches every depth because the declared
  // `act` member names the same type. A caller casting past it writes an
  // undeclared member, which rides the open tail:
  // `__fixtures__/scenarios.ts#an-actor-audience-is-carried-as-the-undeclared-member-it-is`.
  void aegis.mint("access_token", {
    subject: "user-1",
    audience: [RESOURCE],
    clientId: "client-1",
    act: {
      subject: "service-1",
      // @ts-expect-error - an actor claim declares no audience member
      audience: [RESOURCE],
    },
  });

  void aegis.mint("access_token", {
    subject: "user-1",
    audience: [RESOURCE],
    clientId: "client-1",
    act: {
      subject: "service-1",
      act: {
        subject: "service-2",
        // @ts-expect-error - the rule does not change with depth
        audience: [RESOURCE],
      },
    },
  });

  // The tail itself stays open: the RFC 8693 wire spelling a foreign issuer uses
  // is an undeclared member here too, and nothing refuses one.
  void aegis.mint("access_token", {
    subject: "user-1",
    audience: [RESOURCE],
    clientId: "client-1",
    act: { subject: "service-1", aud: [RESOURCE] },
  });

  // Required members are still required.
  // @ts-expect-error - AccessTokenContent requires clientId
  void aegis.mint("access_token", { subject: "user-1", audience: [RESOURCE] });

  // A profile that declares `use: "verify"` resolves its content to `never`, so
  // the compiler kills the call site as well as the runtime refusal. A profile
  // that exists to check a third party's token has no business emitting one
  // under our own signature.
  void aegis.mint(
    "external_access_token",
    // @ts-expect-error - a verify-only profile takes no mint content
    { subject: "user-1", audience: [RESOURCE] },
  );

  // The escape hatch is NOT closed: a custom profile name keeps the open
  // vocabulary, including the claim the access_token profile rejects above.
  void aegis.mint("my_custom_profile", {
    subject: "user-1",
    audience: [RESOURCE],
    federationAssuranceLevel: 1,
  });

  // A profile name known only at runtime resolves to the open vocabulary too.
  const dynamic: string = "my_custom_profile";
  void aegis.mint(dynamic, { subject: "user-1", federationAssuranceLevel: 1 });
};

// The three verify arities, as never-invoked call sites. `ReturnType` over each
// is what resolves the OVERLOAD — the thing under test — where a hand-written
// type annotation would simply restate the answer.
const verifyAccessToken = () =>
  aegis.verify("access_token", "token", undefined, { audience: RESOURCE });

const verifySecurityEvent = () =>
  aegis.verify("security_event", "token", undefined, { audience: RESOURCE });

const verifyWithoutProfile = () =>
  aegis.verify<JoseVerifiedStructuredToken<JwtClaimsWire>>("token", {
    audience: RESOURCE,
  });

type AccessTokenResult = Awaited<ReturnType<typeof verifyAccessToken>>;
type SecurityEventResult = Awaited<ReturnType<typeof verifySecurityEvent>>;
type ProfilelessResult = Awaited<ReturnType<typeof verifyWithoutProfile>>;

describe("IAegis — the compile-time contract", () => {
  describe("mint resolves its content type from the profile name", () => {
    test("should resolve every built-in name to its own content type", () => {
      expectTypeOf<
        ProfileContentFor<"access_token">
      >().toEqualTypeOf<AccessTokenContent>();
      expectTypeOf<ProfileContentFor<"id_token">>().toEqualTypeOf<IdTokenContent>();
      expectTypeOf<ProfileContentFor<"default">>().toEqualTypeOf<DefaultContent>();
    });

    // The escape hatch: a runtime-registered profile has no compile-time content
    // type, so it gets the open vocabulary — and ONLY it does.
    test("should resolve an unknown name to the open vocabulary", () => {
      expectTypeOf<ProfileContentFor<"my_custom_profile">>().toEqualTypeOf<SignContent>();
      expectTypeOf<ProfileContentFor<string>>().toEqualTypeOf<SignContent>();
    });

    test("should not widen a built-in name to the open vocabulary", () => {
      expectTypeOf<ProfileContentFor<"access_token">>().not.toEqualTypeOf<SignContent>();
    });

    test("should type the content parameter from the profile name", () => {
      expectTypeOf(aegis.mint<"access_token">)
        .parameter(1)
        .toEqualTypeOf<AccessTokenContent>();
      expectTypeOf(aegis.mint<"id_token">)
        .parameter(1)
        .toEqualTypeOf<IdTokenContent>();
      expectTypeOf(aegis.mint<"my_custom_profile">)
        .parameter(1)
        .toEqualTypeOf<SignContent>();
    });

    // An introspection response may carry `username` (RFC 7662 §2.2), so the
    // artifact an introspection answers ABOUT is the profile that may assert it.
    // An id token does not pick it.
    test("should admit username on an access token and not on an id token", () => {
      expectTypeOf<AccessTokenContent>().toHaveProperty("username");
      expectTypeOf<IdTokenContent>().not.toHaveProperty("username");
    });

    test("should keep every guarded call site compiling exactly as declared", () => {
      // The `@ts-expect-error` directives above ARE the assertion, and an unused
      // one fails the build — so the only thing left to check at runtime is that
      // the guard was not deleted along with whatever it was guarding.
      expect(_mintContentGuards).toBeInstanceOf(Function);
    });
  });

  /**
   * A profiled verify reflects the profile's own verify floor in the TYPE: a
   * claim the floor PROVES present is no longer optional, so a caller stops
   * writing `subject!` and `?? "unknown"` for a value the call already
   * guaranteed. The narrowing is only sound where a runtime check backs it,
   * which is why the two negative cases below matter as much as the positive.
   */
  describe("verify narrows to the profile's own floor", () => {
    test("should make an access token's proven claims non-optional", () => {
      expectTypeOf<AccessTokenResult["claims"]["subject"]>().toEqualTypeOf<string>();
      expectTypeOf<AccessTokenResult["claims"]["tokenId"]>().toEqualTypeOf<string>();
      expectTypeOf<AccessTokenResult["claims"]["expiresAt"]>().toEqualTypeOf<Date>();
      expectTypeOf<AccessTokenResult["claims"]["issuedAt"]>().toEqualTypeOf<Date>();
    });

    test("should make a security event's required events map non-optional", () => {
      expectTypeOf<
        SecurityEventResult["claims"]["events"]
      >().toEqualTypeOf<SecurityEvents>();
    });

    // `security_event` states no lifetime and forbids `sub`, so neither claim is
    // in its required set. Narrowing them would put a guarantee in the type that
    // nothing at runtime establishes.
    test("should leave claims outside the profile's required set optional", () => {
      expectTypeOf<SecurityEventResult["claims"]["subject"]>().toEqualTypeOf<
        string | undefined
      >();
      expectTypeOf<SecurityEventResult["claims"]["expiresAt"]>().toEqualTypeOf<
        Date | undefined
      >();
    });

    // No profile ran, so no floor was enforced and nothing may be narrowed.
    test("should narrow nothing when the call names no profile", () => {
      expectTypeOf<ProfilelessResult["claims"]["subject"]>().toEqualTypeOf<
        string | undefined
      >();
      expectTypeOf<ProfilelessResult["claims"]["expiresAt"]>().toEqualTypeOf<
        Date | undefined
      >();
    });

    // ⚠ The plain three-positional overload must keep resolving for a caller
    // that passes options in the SECOND slot. Widening the profiled overload's
    // first parameter breaks that resolution, and the consumer that noticed was
    // a downstream service reading `.dpop` off the result.
    test("should keep the profile-less arity reachable", () => {
      expectTypeOf<ProfilelessResult>().toHaveProperty("claims");
      expectTypeOf<ProfilelessResult>().toHaveProperty("custom");
    });
  });
});
