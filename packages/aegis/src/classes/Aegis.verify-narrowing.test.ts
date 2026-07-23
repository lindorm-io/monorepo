import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { beforeEach, describe, expect, expectTypeOf, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import type { JwtClaimsWire, VerifiedStructuredToken } from "../types/index.js";
import { Aegis } from "./Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const RESOURCE = "https://rs.lindorm.io/";

/**
 * Compile-time (`expectTypeOf`) proof that `verify(<built-in>, …)` reflects the
 * profile's verify floor in the TYPE: the profile-guaranteed claims are
 * non-optional, so callers no longer need `subject!` / `?? "unknown"`. The
 * runtime round-trip pins that the narrowed values are actually present.
 */
describe("Aegis profiled verify narrowing", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ domain: ISSUER, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  test("access_token: profile-guaranteed claims are NON-optional", async () => {
    const { token } = await aegis.mint("access_token", {
      subject: "user-1",
      audience: [RESOURCE],
      clientId: "client-1",
    });

    const parsed = await aegis.verify("access_token", token, undefined, {
      audience: RESOURCE,
    });

    expectTypeOf(parsed).toHaveProperty("claims");

    // access_token.required lists subject / expiresAt / issuedAt / tokenId, all
    // proven present by enforceVerifyFloor — so the type strips their `| undefined`.
    expectTypeOf(parsed.claims.subject).toEqualTypeOf<string>();
    expectTypeOf(parsed.claims.tokenId).toEqualTypeOf<string>();
    expectTypeOf(parsed.claims.expiresAt).toEqualTypeOf<Date>();
    expectTypeOf(parsed.claims.issuedAt).toEqualTypeOf<Date>();

    // Runtime side: the narrowed claims really are present.
    expect(parsed.claims.subject).toBe("user-1");
    expect(parsed.claims.tokenId).toEqual(expect.any(String));
    expect(parsed.claims.expiresAt).toBeInstanceOf(Date);
    expect(parsed.claims.issuedAt).toBeInstanceOf(Date);

    // No non-null assertion needed — a plain `string` binding compiles.
    const subject: string = parsed.claims.subject;
    expect(subject).toBe("user-1");
  });

  test("security_event: claims OUTSIDE its required set stay optional", async () => {
    // security_event has `lifetime: null` and forbids sub/exp, so neither
    // `subject` nor `expiresAt` is in `required` — the built-in overload's
    // NarrowedJwt must NOT narrow them.
    const { token } = await aegis.mint("security_event", {
      audience: ["https://receiver"],
      subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
      events: { "urn:lindorm:event:test": {} },
    });

    const parsed = await aegis.verify("security_event", token, undefined, {
      audience: "https://receiver",
    });

    expectTypeOf(parsed.claims.subject).toEqualTypeOf<string | undefined>();
    expectTypeOf(parsed.claims.expiresAt).toEqualTypeOf<Date | undefined>();

    // @ts-expect-error — subject is nullable here, so a `string` binding is unsound.
    const _bad: string = parsed.claims.subject;
    void _bad;
  });

  test("profile-less verify does NOT narrow — subject stays optional", async () => {
    const { token } = await aegis.mint("access_token", {
      subject: "user-1",
      audience: [RESOURCE],
      clientId: "client-1",
    });

    // The base (profile-less) overload returns VerifiedJwtWire; no profile floor ran,
    // so the parsed payload keeps every optional claim optional.
    const parsed = await aegis.verify<VerifiedStructuredToken<JwtClaimsWire, string>>(
      token,
      { audience: RESOURCE },
    );

    expectTypeOf(parsed.claims.subject).toEqualTypeOf<string | undefined>();
    expectTypeOf(parsed.claims.expiresAt).toEqualTypeOf<Date | undefined>();
  });
});
