import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { ClientError, LindormError, ServerError } from "@lindorm/errors";
import { beforeEach, describe, expect, test, type Mock } from "vitest";
import {
  ACCESS_TEST_APP_ISSUER,
  ACCESS_TEST_AUDIENCE,
  joseShapedToken,
  verifiedAccess,
} from "../../../__fixtures__/access/tokens.js";
import { verifyAccessToken } from "./verify-access-token.js";

const TOKEN = joseShapedToken();

/** Everything this function takes: the resource server's identity, and ours. */
const OPTIONS = { audience: ACCESS_TEST_AUDIENCE, issuer: ACCESS_TEST_APP_ISSUER };

/**
 * The conversion BOUNDARY. Everything inside this call is a verdict on bytes the
 * caller presented, so everything that comes out of it is a 401 — and nothing
 * outside it is converted at all, which is what stops a driver's storage failure
 * from being reported to the caller as a bad credential.
 */
describe("verifyAccessToken", () => {
  let aegis: ReturnType<typeof createMockAegis>;

  beforeEach(() => {
    aegis = createMockAegis();
  });

  // ⚠ The PROFILED overload. The profile NAME carries the `typ` floor
  // (`application/at+jwt`, RFC 9068 §2.2), so an id_token or a logout token
  // presented as a bearer credential is refused by the profile rather than by an
  // option a deployment could override — there is no `tokenType` knob left to
  // override it WITH, which is the point.
  //
  // `assert` is `undefined`: the claim matchers are one later pass shared with
  // the introspected arm. `issuer` scopes the KEY lookup, not just the claim
  // comparison. `trustBoundThumbprint` says pylon validates the DPoP binding
  // itself, uniformly, for both arms.
  test("verifies against the access_token profile, with no assert", async () => {
    (aegis.verify as Mock).mockResolvedValue(verifiedAccess({}, TOKEN));

    await verifyAccessToken(aegis, TOKEN, OPTIONS);

    expect(aegis.verify).toHaveBeenCalledWith("access_token", TOKEN, undefined, {
      audience: ACCESS_TEST_AUDIENCE,
      issuer: ACCESS_TEST_APP_ISSUER,
      trustBoundThumbprint: true,
    });
  });

  test("returns the verified token unchanged", async () => {
    const verified = verifiedAccess({}, TOKEN);
    (aegis.verify as Mock).mockResolvedValue(verified);

    await expect(verifyAccessToken(aegis, TOKEN, OPTIONS)).resolves.toBe(verified);
  });

  // The crypto layer beneath aegis throws its OWN classes — a signature of the
  // wrong length surfaces as an `EcError` from `@lindorm/ec`, a package pylon
  // does not depend on. Allowlisting error classes would have missed it; the
  // call scope does not.
  test.each([
    ["a plain Error", new Error("boom")],
    [
      "a foreign LindormError (the crypto layer's own class)",
      new (class extends LindormError {
        static readonly namespace = "ec";
      })("Invalid raw signature length", { code: "invalid_raw_signature_length" }),
    ],
  ])("converts %s into a named 401", async (_label, thrown) => {
    (aegis.verify as Mock).mockRejectedValue(thrown);

    await expect(verifyAccessToken(aegis, TOKEN, OPTIONS)).rejects.toMatchObject({
      status: 401,
      code: "access_token_verification_failed",
      type: "urn:lindorm:pylon:error:access_token_verification_failed",
    });
  });

  test("keeps the original error attached for the operator", async () => {
    const cause = new Error("invalid signature");
    (aegis.verify as Mock).mockRejectedValue(cause);

    try {
      await verifyAccessToken(aegis, TOKEN, OPTIONS);
      expect.fail("expected verifyAccessToken to throw");
    } catch (error: any) {
      expect(error.details).toBe("invalid signature");
    }
  });

  // A named pylon error already carries the status and reason it earned;
  // wrapping it would erase both.
  test.each([
    ["ClientError", new ClientError("nope", { status: 403, code: "forbidden" })],
    ["ServerError", new ServerError("broken", { code: "broken" })],
  ])("passes a %s through unchanged", async (_label, thrown) => {
    (aegis.verify as Mock).mockRejectedValue(thrown);

    await expect(verifyAccessToken(aegis, TOKEN, OPTIONS)).rejects.toBe(thrown);
  });
});
