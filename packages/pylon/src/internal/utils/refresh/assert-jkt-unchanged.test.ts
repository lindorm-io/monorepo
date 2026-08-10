import { ClientError } from "@lindorm/errors";
import { describe, expect, test } from "vitest";
import { assertJktUnchanged } from "./assert-jkt-unchanged.js";

describe("assertJktUnchanged", () => {
  test("accepts an unbound connection refreshing onto an unbound credential", () => {
    expect(() => assertJktUnchanged(undefined, undefined)).not.toThrow();
    expect(() => assertJktUnchanged(undefined, "")).not.toThrow();
  });

  /**
   * ⚠ EXPECTATION FLIPPED — this used to be a no-op ("bearer-mode").
   *
   * A refresh event carries no DPoP proof, so a connection with no captured
   * thumbprint has nothing to prove a binding against. Accepting a bound
   * credential there serves it as a plain bearer, which RFC 9449 §7.1 forbids.
   *
   * It was never actually permitted: the refusal used to happen one layer down,
   * where the refresh verify withheld `trustBoundThumbprint` and aegis's strict
   * default refused the token. That verify now trusts the binding
   * unconditionally — pylon owns the comparison on both credential arms, and an
   * introspected credential has no aegis verify at all — so the rule has moved
   * here rather than disappeared.
   */
  test("refuses a refresh that introduces a binding the connection never established", () => {
    expect(() => assertJktUnchanged(undefined, "jkt-abc")).toThrow(ClientError);

    try {
      assertJktUnchanged(undefined, "jkt-abc");
      expect.fail("expected assertJktUnchanged to throw");
    } catch (error: any) {
      expect(error.code).toBe("dpop_jkt_changed");
      expect(error.status).toBe(401);
    }
  });

  test("accepts matching jkt", () => {
    expect(() => assertJktUnchanged("abc", "abc")).not.toThrow();
  });

  test("throws when jkt differs", () => {
    expect(() => assertJktUnchanged("abc", "xyz")).toThrow(ClientError);
  });

  test("throws when actual is missing but expected was set", () => {
    expect(() => assertJktUnchanged("abc", undefined)).toThrow(ClientError);
  });
});
