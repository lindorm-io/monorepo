// Compile-time proof that `mint` holds a BUILT-IN profile to its own content
// `Pick`, and that the open escape hatch still admits a runtime-registered name.
//
// This has to be a TYPE test: the failure it guards is silent at runtime. `mint`
// used to declare two overloads — a typed one over `keyof ProfileContent` and a
// loose one over `string & {}` — and `string & {}` accepts "access_token" as
// readily as any other string. So an inline literal carrying a claim the profile
// does not `Pick` failed the typed overload, FELL THROUGH to the loose one, and
// compiled as `SignContent`, which admits nearly the whole domain vocabulary. The
// ten content types therefore constrained nothing at a plain inline call site —
// only when the caller annotated the variable or passed the type argument.
//
// The fix is one signature whose content type is resolved FROM the profile name
// (`ProfileContentFor`), so there is no second signature to fall through to. The
// `@ts-expect-error` blocks below are the regression guard in both directions: if
// the fall-through returns, each stops erroring and an unused `@ts-expect-error`
// fails the compile.

import { Amphora, type IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, expectTypeOf, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import type {
  AccessTokenContent,
  DefaultContent,
  IdTokenContent,
  ProfileContentFor,
  SignContent,
} from "../types/index.js";
import { Aegis } from "./Aegis.js";
import { JwtKit } from "./JwtKit.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const RESOURCE = "https://rs.lindorm.io/";

/**
 * NEVER INVOKED — the compiler IS the assertion. Every `@ts-expect-error` below
 * marks a call that used to compile through the loose overload; if the
 * fall-through ever returns, the directive goes unused and the compile fails.
 * The un-marked calls are the other half of the guard: they must keep compiling,
 * so a fix that simply closed the escape hatch would fail here instead.
 */
export const _mintTypeGuards = (aegis: Aegis): void => {
  // `federationAssuranceLevel` is a real member of the domain vocabulary and `1`
  // is a valid value for it — it is simply not a claim an access token may
  // assert. This is the exact shape that used to compile.
  void aegis.mint("access_token", {
    subject: "user-1",
    audience: [RESOURCE],
    clientId: "client-1",
    // @ts-expect-error - not picked by AccessTokenContent
    federationAssuranceLevel: 1,
  });

  // `clientId` is required on an access token and absent from an id token: OIDC
  // Core §2 makes `aud` the client id, and `azp` (authorizedParty) the claim for
  // the party. Neither direction may leak into the other.
  void aegis.mint("id_token", {
    subject: "user-1",
    audience: ["client-1"],
    // @ts-expect-error - not picked by IdTokenContent
    clientId: "client-1",
  });

  // A member outside the vocabulary entirely.
  void aegis.mint("access_token", {
    subject: "user-1",
    audience: [RESOURCE],
    clientId: "client-1",
    // @ts-expect-error - not a domain claim at all
    totallyUnknownMember: "x",
  });

  // Required members are still required.
  // @ts-expect-error - AccessTokenContent requires clientId
  void aegis.mint("access_token", { subject: "user-1", audience: [RESOURCE] });

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

describe("Aegis mint profile typing", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  describe("ProfileContentFor", () => {
    test("should resolve every built-in name to its own content type", () => {
      expectTypeOf<
        ProfileContentFor<"access_token">
      >().toEqualTypeOf<AccessTokenContent>();
      expectTypeOf<ProfileContentFor<"id_token">>().toEqualTypeOf<IdTokenContent>();
      expectTypeOf<ProfileContentFor<"default">>().toEqualTypeOf<DefaultContent>();
    });

    // The escape hatch: a runtime-registered profile has no compile-time content
    // type, so it gets the open vocabulary — and ONLY it does.
    test("should resolve an unknown name to the open SignContent", () => {
      expectTypeOf<ProfileContentFor<"my_custom_profile">>().toEqualTypeOf<SignContent>();
      expectTypeOf<ProfileContentFor<string>>().toEqualTypeOf<SignContent>();
    });

    test("should not widen a built-in name to the open vocabulary", () => {
      expectTypeOf<ProfileContentFor<"access_token">>().not.toEqualTypeOf<SignContent>();
    });
  });

  describe("mint parameter typing", () => {
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
  });

  // The runtime companion: the typed surface still mints a real token, and the
  // claim the type rejects is genuinely absent from the wire.
  test("should mint an access token through the profile-typed surface", async () => {
    const { token } = await aegis.mint("access_token", {
      subject: "user-1",
      audience: [RESOURCE],
      clientId: "client-1",
    });

    const { payload } = JwtKit.decode(token);

    expect(payload.sub).toBe("user-1");
    expect(payload.client_id).toBe("client-1");
    expect(payload).not.toHaveProperty("fal");
  });
});
