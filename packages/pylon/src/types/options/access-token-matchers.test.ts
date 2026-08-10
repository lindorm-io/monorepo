import type { DomainAssert } from "@lindorm/aegis";
import { describe, expect, test } from "vitest";
import type { AccessTokenMatchers } from "./access-token-matchers.js";

/**
 * A TYPE witness, because this type's whole content is what it does and does not
 * let a mount say — there is no runtime behaviour to assert. `@ts-expect-error`
 * is the assertion: it fails the build if the error it expects stops happening,
 * so an exclusion that silently opened up is caught the same way a broken test
 * would be.
 *
 * It exists because the exclusion list went stale ONCE already, in the direction
 * a compiler cannot see: it named three keys that had moved off `DomainAssert`
 * entirely, and `Omit` accepts a key a type does not have, so the list went on
 * compiling while documenting a restriction that no longer restricted anything.
 */
describe("AccessTokenMatchers (type witness)", () => {
  test("audience is required and the aegis matcher vocabulary is statable", () => {
    const matchers: AccessTokenMatchers = {
      audience: "https://api.example.com",
      scope: ["orders:write"],
      roles: { $in: ["admin"] },
      subject: "user_1",
    };

    expect(matchers.audience).toBe("https://api.example.com");
  });

  test("audience cannot be omitted — only the mount knows the resource server's identity", () => {
    // @ts-expect-error `audience` is required (RFC 9068 §4).
    const matchers: AccessTokenMatchers = { scope: ["orders:write"] };

    expect(matchers.scope).toEqual(["orders:write"]);
  });

  // ⚠ One literal each, on purpose: TypeScript reports only the FIRST excess
  // property of an object literal, so a second `@ts-expect-error` in the same
  // literal is "unused" and the exclusion it guards goes unproved.
  test("issuer is not a mount's to state — pylon derives it from the auth issuer", () => {
    const matchers: AccessTokenMatchers = {
      audience: "https://api.example.com",
      // @ts-expect-error `issuer` is excluded.
      issuer: "https://idp.example.com",
    };

    expect(matchers.audience).toBe("https://api.example.com");
  });

  test("tokenType is not a mount's to state — the profile settles the credential's type", () => {
    const matchers: AccessTokenMatchers = {
      audience: "https://api.example.com",
      // @ts-expect-error `tokenType` is excluded.
      tokenType: "access_token",
    };

    expect(matchers.audience).toBe("https://api.example.com");
  });

  /**
   * The already-COMPUTED hash claims are ordinary equality matchers and stay
   * statable. Their hash-DERIVE counterparts (`accessToken`/`authCode`/
   * `authState`, which hash a raw value with the TOKEN's signing algorithm) are
   * not on {@link DomainAssert} at all — they live on aegis's `VerifyAssert`,
   * the surface that holds a key — so there is nothing here to exclude.
   */
  test("the computed hash claims are statable; the derive inputs do not exist", () => {
    const matchers: AccessTokenMatchers = {
      audience: "https://api.example.com",
      accessTokenHash: "uby9Z8Gb_H_x4fPjwNzguw",
      codeHash: "TT-mXNvl57l-BcINg6sBWQ",
      stateHash: "sRiXnuhZcAIVMpbUvyTPtw",
    };

    const derived: Array<keyof DomainAssert> = [];
    // @ts-expect-error `accessToken` is a VerifyAssert key, never a DomainAssert one.
    derived.push("accessToken");

    expect(matchers.accessTokenHash).toBe("uby9Z8Gb_H_x4fPjwNzguw");
    expect(derived).toEqual(["accessToken"]);
  });
});
