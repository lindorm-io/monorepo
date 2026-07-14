import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { ClientError } from "@lindorm/errors";
import { verifyCookie } from "./verify-cookie.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const verify = vi.fn();

vi.mock("@lindorm/aegis", async () => ({
  ...(await vi.importActual<typeof import("@lindorm/aegis")>("@lindorm/aegis")),
  SignatureKit: class SignatureKit {
    verify(): boolean {
      return verify();
    }
  },
}));

const cookieKey = {
  id: "kid-1",
  use: "sig",
  purpose: "cookie",
  publish: false,
  isPending: false,
  toJSON: () => ({ id: "kid-1" }),
};

describe("verifyCookie", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = { amphora: createMockAmphora() };
    ctx.amphora.findByIdSync.mockReturnValue(cookieKey);
  });

  afterEach(vi.clearAllMocks);

  test("should resolve when kid lookup succeeds and signature verifies", async () => {
    verify.mockReturnValueOnce(true);

    await expect(
      verifyCookie(ctx, "name", "value", "signature", "kid-1", undefined),
    ).resolves.toBeUndefined();

    expect(ctx.amphora.findByIdSync).toHaveBeenCalledWith("kid-1");
    expect(verify).toHaveBeenCalledTimes(1);
  });

  test("should throw when signature does not verify", async () => {
    verify.mockReturnValue(false);

    await expect(
      verifyCookie(ctx, "name", "value", "signature", "kid-1", undefined),
    ).rejects.toThrow(ClientError);
  });

  test("should throw on missing signature", async () => {
    await expect(
      verifyCookie(ctx, "name", "value", null, "kid-1", undefined),
    ).rejects.toThrow(ClientError);

    expect(ctx.amphora.findByIdSync).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  test("should throw on missing kid", async () => {
    await expect(
      verifyCookie(ctx, "name", "value", "signature", null, undefined),
    ).rejects.toThrow(ClientError);

    expect(ctx.amphora.findByIdSync).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  test("should throw when findByIdSync throws", async () => {
    ctx.amphora.findByIdSync.mockImplementation(() => {
      throw new Error("not found");
    });

    await expect(
      verifyCookie(ctx, "name", "value", "signature", "unknown-kid", undefined),
    ).rejects.toThrow(ClientError);
  });

  // Selection is driven by the cookie's own `.kid`, so the deployment's policy
  // can only bite as a CHECK. Without it a client that names any kid in the
  // vault picks the class of key its cookie is verified against.
  describe("verification check", () => {
    test("should throw when the named key is not a signing key at all", async () => {
      verify.mockReturnValue(true);
      ctx.amphora.findByIdSync.mockReturnValue({
        id: "enc-kid",
        use: "enc",
        isPending: false,
        toJSON: () => ({ id: "enc-kid" }),
      });

      await expect(
        verifyCookie(ctx, "name", "value", "signature", "enc-kid", undefined),
      ).rejects.toThrow(ClientError);

      expect(verify).not.toHaveBeenCalled();
    });

    test("should throw when the named key fails the deployment's check", async () => {
      verify.mockReturnValue(true);
      ctx.amphora.findByIdSync.mockReturnValue({
        id: "token-kid",
        use: "sig",
        purpose: "token",
        publish: true,
        isPending: false,
        toJSON: () => ({ id: "token-kid" }),
      });

      await expect(
        verifyCookie(ctx, "name", "value", "signature", "token-kid", {
          predicate: { purpose: "cookie" },
        }),
      ).rejects.toThrow(ClientError);

      expect(verify).not.toHaveBeenCalled();
    });

    test("should verify when the named key passes the deployment's check", async () => {
      verify.mockReturnValue(true);

      await expect(
        verifyCookie(ctx, "name", "value", "signature", "kid-1", {
          predicate: { purpose: "cookie" },
        }),
      ).resolves.toBeUndefined();

      expect(verify).toHaveBeenCalledTimes(1);
    });
  });
});
