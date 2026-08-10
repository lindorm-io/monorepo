import { describe, expect, test } from "vitest";
import { splitVerifyInput } from "./split-verify-input.js";

describe("splitVerifyInput", () => {
  test("routes verify knobs to options and claim matchers to assert", () => {
    const { assert, options } = splitVerifyInput({
      audience: "https://rs.lindorm.io/",
      issuer: "https://idp.lindorm.io/",
      scope: ["openid"],
      expPresence: "optional",
      dpopProof: "proof",
    } as any);

    expect(assert).toEqual({
      audience: "https://rs.lindorm.io/",
      issuer: "https://idp.lindorm.io/",
      scope: ["openid"],
    });
    expect(options).toEqual({ expPresence: "optional", dpopProof: "proof" });
  });

  // The temporal-skip flags are VerifyOptions knobs — an id_token_hint verify sets
  // `verifyExpiration: false`, which must reach `options`, never `assert` (where it
  // would be rejected as an unknown claim matcher).
  test("routes verifyExpiration:false to options, not assert", () => {
    const { assert, options } = splitVerifyInput({
      audience: "https://rs.lindorm.io/",
      verifyExpiration: false,
    } as any);

    expect(assert).toEqual({ audience: "https://rs.lindorm.io/" });
    expect(options).toEqual({ verifyExpiration: false });
  });

  test("routes all four temporal-skip flags plus currentDate / maxTokenAge to options", () => {
    const currentDate = new Date("2024-01-01T08:00:00.000Z");
    const { assert, options } = splitVerifyInput({
      subject: "user-1",
      currentDate,
      maxTokenAge: 300,
      verifyExpiration: false,
      verifyNotBefore: false,
      verifyIssuedAt: false,
      verifyAuthTime: false,
    } as any);

    expect(assert).toEqual({ subject: "user-1" });
    expect(options).toEqual({
      currentDate,
      maxTokenAge: 300,
      verifyExpiration: false,
      verifyNotBefore: false,
      verifyIssuedAt: false,
      verifyAuthTime: false,
    });
  });

  /**
   * The four keys that MOVED from `VerifyOptions` to `DomainAssert`. Routing
   * them to `options` was the whole failure mode: aegis accepts an unknown
   * option and DROPS it, so `tokenType` went on being sent and stopped being
   * asserted, with nothing — not a typecheck, not a test asserting the call
   * shape — able to see it.
   */
  test("routes the four MATCHERS to assert, never to options", () => {
    const { assert, options } = splitVerifyInput({
      tokenType: "access_token",
      accessToken: "raw-access-token",
      authCode: "raw-code",
      authState: "raw-state",
    } as any);

    expect(assert).toEqual({
      tokenType: "access_token",
      accessToken: "raw-access-token",
      authCode: "raw-code",
      authState: "raw-state",
    });
    expect(options).toEqual({});
  });

  // The drift in the other direction: `clockTolerance` is declared on
  // `VerifyOptions` and was missing from the list, so a per-call tolerance was
  // routed to `assert` and rejected as an unknown claim matcher.
  test("routes clockTolerance to options, not assert", () => {
    const { assert, options } = splitVerifyInput({ clockTolerance: 30 } as any);

    expect(assert).toEqual({});
    expect(options).toEqual({ clockTolerance: 30 });
  });
});
