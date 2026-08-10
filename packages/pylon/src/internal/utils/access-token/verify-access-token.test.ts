import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { ClientError, LindormError, ServerError } from "@lindorm/errors";
import { beforeEach, describe, expect, test, type Mock } from "vitest";
import { joseShapedToken } from "../../../__fixtures__/access/tokens.js";
import { verifyAccessToken } from "./verify-access-token.js";

const TOKEN = joseShapedToken();

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

  test("passes the access-token typ and the caller's knobs", async () => {
    (aegis.verify as Mock).mockResolvedValue({ claims: {}, custom: {}, token: TOKEN });

    await verifyAccessToken(aegis, TOKEN, {
      trustBoundThumbprint: true,
      maxTokenAge: 60,
    });

    expect(aegis.verify).toHaveBeenCalledWith(TOKEN, undefined, {
      tokenType: "access_token",
      trustBoundThumbprint: true,
      maxTokenAge: 60,
    });
  });

  test("lets the caller override the typ knob", async () => {
    (aegis.verify as Mock).mockResolvedValue({ claims: {}, custom: {}, token: TOKEN });

    await verifyAccessToken(aegis, TOKEN, { tokenType: "refresh_token" });

    expect(aegis.verify).toHaveBeenCalledWith(
      TOKEN,
      undefined,
      expect.objectContaining({ tokenType: "refresh_token" }),
    );
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

    await expect(verifyAccessToken(aegis, TOKEN, {})).rejects.toMatchObject({
      status: 401,
      code: "access_token_verification_failed",
      type: "urn:lindorm:pylon:error:access_token_verification_failed",
    });
  });

  test("keeps the original error attached for the operator", async () => {
    const cause = new Error("invalid signature");
    (aegis.verify as Mock).mockRejectedValue(cause);

    try {
      await verifyAccessToken(aegis, TOKEN, {});
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

    await expect(verifyAccessToken(aegis, TOKEN, {})).rejects.toBe(thrown);
  });
});
