import type { IAegis } from "@lindorm/aegis";
import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { ClientError, ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeAll, describe, expect, test, type Mock } from "vitest";
import {
  ACCESS_TEST_ISSUER,
  createTestAegis,
  mintTestAccessToken,
  mintTestIdToken,
  tamperPayload,
} from "../../../__fixtures__/access/aegis.js";
import {
  ACCESS_TEST_AUDIENCE,
  OPAQUE_TOKEN,
} from "../../../__fixtures__/access/tokens.js";
import { verifyAccessToken } from "./verify-access-token.js";

/**
 * Everything this function takes: the resource server's identity, ours, and the
 * profile the mount resolved (`"access_token"` unless it said otherwise).
 */
const OPTIONS = {
  audience: ACCESS_TEST_AUDIENCE,
  issuer: ACCESS_TEST_ISSUER,
  profile: "access_token" as const,
};

/**
 * The conversion BOUNDARY, driven against a REAL Aegis over a REAL vault with
 * REAL generated keys. Everything inside this call is a verdict on bytes the
 * caller presented, so everything that comes out of it is a 401 — and nothing
 * outside it is converted at all, which is what stops a driver's storage failure
 * from being reported to the caller as a bad credential.
 *
 * ⚠ EVERY assertion here is on an OUTCOME — the token that came back, or the
 * refusal and the code that named it — and none is on the ARGUMENTS handed to
 * aegis. The suite this replaced asserted the call shape against a mocked
 * `verify`, and that is precisely the style that stayed green through the window
 * in which aegis accepted a `tokenType` option and silently DROPPED it: pylon
 * went on producing the argument it had always produced, so the mock went on
 * agreeing, while nothing was being asserted about the token at all. A mock
 * cannot refuse a token; only a real key can.
 */
describe("verifyAccessToken", () => {
  let aegis: IAegis;

  beforeAll(() => {
    aegis = createTestAegis(createMockLogger());
  });

  describe("what it accepts", () => {
    test("returns the verified access token, claims and all", async () => {
      const token = await mintTestAccessToken(aegis);

      const verified = await verifyAccessToken(aegis, token, OPTIONS);

      expect(verified.token).toBe(token);
      expect(verified.format).toBe("jwt");
      expect(verified.claims.subject).toBe("alice");
      expect(verified.claims.issuer).toBe(ACCESS_TEST_ISSUER);
      expect(verified.claims.audience).toEqual([ACCESS_TEST_AUDIENCE]);
    });

    // The COSE twin of the same credential, and the observable form of "pylon
    // hands aegis NO `assert` argument". Profiled verify on a COSE token drops
    // `assert`, so a matcher moved into it would vanish on exactly this wire —
    // pylon keeps the matchers in a later pass shared with the introspected arm,
    // so there is nothing here to drop and a CWT resolves identically.
    test("a CWT access token verifies through the same call", async () => {
      const token = await mintTestAccessToken(aegis, {}, { format: "cwt" });

      const verified = await verifyAccessToken(aegis, token, OPTIONS);

      expect(verified.format).toBe("cwt");
      expect(verified.claims.subject).toBe("alice");
      expect(verified.claims.issuer).toBe(ACCESS_TEST_ISSUER);
    });

    /**
     * `trustBoundThumbprint: true` says PYLON owns the DPoP proof comparison —
     * it runs it in `assertDpopBinding`, uniformly, for both credential arms.
     * The observable consequence is here: a `cnf.jkt`-bound token verifies with
     * no proof in sight. Drop the flag and every bound credential is refused for
     * want of a proof this call was never given.
     */
    test("a DPoP-bound token verifies without a proof, because pylon owns that check", async () => {
      const token = await mintTestAccessToken(aegis, {
        confirmation: { thumbprint: "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I" },
      });

      const verified = await verifyAccessToken(aegis, token, OPTIONS);

      expect(verified.claims.confirmation?.thumbprint).toBe(
        "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I",
      );
    });

    // The control that makes the test above MEAN something: the SAME token,
    // verified without the flag, is refused. So acceptance is the flag being
    // passed, not a bound token being waved through by default.
    test("...and the same token is refused when that flag is not passed", async () => {
      const token = await mintTestAccessToken(aegis, {
        confirmation: { thumbprint: "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I" },
      });

      await expect(
        aegis.verify("access_token", token, undefined, {
          audience: ACCESS_TEST_AUDIENCE,
          issuer: ACCESS_TEST_ISSUER,
        }),
      ).rejects.toMatchObject({ code: "dpop_proof_required" });
    });
  });

  /**
   * ⚠ The PROFILED overload, proved by what it REFUSES. The profile NAME carries
   * the `typ` floor (`application/at+jwt`, RFC 9068 §2.2), so an id_token
   * presented as a bearer credential is refused by the profile rather than by an
   * option a deployment could override — there is no `tokenType` knob left to
   * override it WITH, which is the point. `issuer` scopes the KEY lookup, not
   * just the claim comparison.
   *
   * Each case names the floor that refused it through `data`, which pylon's 401
   * carries over from the aegis error. A bare status assertion could not tell
   * these apart, and a token refused for the wrong reason is a test that has
   * stopped testing.
   */
  describe("what the profile floor refuses", () => {
    test("an id_token from this very issuer — the type-confusion credential", async () => {
      await expect(
        verifyAccessToken(aegis, await mintTestIdToken(aegis), OPTIONS),
      ).rejects.toMatchObject({
        status: 401,
        code: "access_token_verification_failed",
        type: "urn:lindorm:pylon:error:access_token_verification_failed",
        data: { typ: "JWT" },
      });
    });

    test("an access token audienced at another resource server", async () => {
      const token = await mintTestAccessToken(aegis, {
        audience: ["https://other.example.com"],
      });

      await expect(verifyAccessToken(aegis, token, OPTIONS)).rejects.toMatchObject({
        status: 401,
        code: "access_token_verification_failed",
        data: { audience: ["https://other.example.com"] },
      });
    });

    // `issuer` SCOPES the key lookup: the token is perfectly valid and its `kid`
    // names a key the vault holds, but no key is registered under the issuer
    // this call pinned, so verification never reaches a signature at all. That
    // is what stops a colliding `kid` from another registered issuer.
    test("a token whose issuer this deployment did not pin", async () => {
      const token = await mintTestAccessToken(aegis);

      await expect(
        verifyAccessToken(aegis, token, {
          ...OPTIONS,
          issuer: "https://elsewhere.example.com",
        }),
      ).rejects.toMatchObject({
        status: 401,
        code: "access_token_verification_failed",
        data: { issuer: "https://elsewhere.example.com" },
      });
    });

    test("a tampered payload, which no longer matches its signature", async () => {
      const token = tamperPayload(await mintTestAccessToken(aegis), {
        iss: ACCESS_TEST_ISSUER,
        aud: [ACCESS_TEST_AUDIENCE],
        sub: "mallory",
      });

      await expect(verifyAccessToken(aegis, token, OPTIONS)).rejects.toMatchObject({
        status: 401,
        code: "access_token_verification_failed",
      });
    });
  });

  /**
   * The conversion is scoped to THIS CALL rather than to a list of error
   * classes, and both cases below are REAL throws off a real key — not a mock
   * told to reject. An allowlist would have to name `SyntaxError` and every
   * curve package by hand, and the next one silently escapes it.
   */
  describe("what it converts into a named 401", () => {
    // Not a LindormError at all: an opaque handle is not a token wire, so the
    // decode below aegis throws a plain `SyntaxError`. `verifyAccessToken` never
    // sees an opaque credential in production — `resolveAccess` sniffs it to the
    // introspected arm first — which is exactly why the boundary must not depend
    // on the class it catches.
    test("a plain Error thrown below the token layer", async () => {
      await expect(verifyAccessToken(aegis, OPAQUE_TOKEN, OPTIONS)).rejects.toMatchObject(
        {
          status: 401,
          code: "access_token_verification_failed",
          type: "urn:lindorm:pylon:error:access_token_verification_failed",
        },
      );
    });

    // The crypto layer beneath aegis throws its OWN classes: a signature of the
    // wrong length surfaces as an `EcError` from `@lindorm/ec`, a package pylon
    // does not depend on. `errors` proves the wrapped error really was that
    // class, so this case cannot silently become a generic failure.
    test("a foreign LindormError — the curve package's own class", async () => {
      const [header, payload] = (await mintTestAccessToken(aegis)).split(".");
      const token = [header, payload, "c2hvcnQ"].join(".");

      try {
        await verifyAccessToken(aegis, token, OPTIONS);
        expect.fail("expected verifyAccessToken to throw");
      } catch (error: any) {
        expect(error.status).toBe(401);
        expect(error.code).toBe("access_token_verification_failed");
        expect(error.errors).toContain("EcError: Invalid raw signature length");
        // The operator keeps the original reason, verbatim.
        expect(error.details).toBe("Invalid raw signature length");
      }
    });
  });

  /**
   * The ONE branch a real Aegis cannot reach: `aegis.verify` never throws a
   * pylon `ClientError`/`ServerError`, so a throwing stand-in is the only way to
   * drive it. The assertion is still an OUTCOME — the very error object comes
   * back out — and never a call shape: a named pylon error already carries the
   * status and reason it earned, and wrapping it would erase both.
   */
  describe("what it passes through untouched", () => {
    test.each([
      ["ClientError", new ClientError("nope", { status: 403, code: "forbidden" })],
      ["ServerError", new ServerError("broken", { code: "broken" })],
    ])("a %s from inside the call", async (_label, thrown) => {
      const throwing = createMockAegis();
      (throwing.verify as Mock).mockRejectedValue(thrown);

      await expect(verifyAccessToken(throwing, OPAQUE_TOKEN, OPTIONS)).rejects.toBe(
        thrown,
      );
    });
  });
});
