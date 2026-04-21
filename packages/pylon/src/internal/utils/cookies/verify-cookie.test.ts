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

describe("verifyCookie", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = { amphora: createMockAmphora() };
    ctx.amphora.findByIdSync.mockReturnValue({ id: "kid-1" });
  });

  afterEach(vi.clearAllMocks);

  test("should resolve when kid lookup succeeds and signature verifies", async () => {
    verify.mockReturnValueOnce(true);

    await expect(
      verifyCookie(ctx, "name", "value", "signature", "kid-1"),
    ).resolves.toBeUndefined();

    expect(ctx.amphora.findByIdSync).toHaveBeenCalledWith("kid-1");
    expect(verify).toHaveBeenCalledTimes(1);
  });

  test("should throw when signature does not verify", async () => {
    verify.mockReturnValue(false);

    await expect(
      verifyCookie(ctx, "name", "value", "signature", "kid-1"),
    ).rejects.toThrow(ClientError);
  });

  test("should throw on missing signature", async () => {
    await expect(verifyCookie(ctx, "name", "value", null, "kid-1")).rejects.toThrow(
      ClientError,
    );

    expect(ctx.amphora.findByIdSync).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  test("should throw on missing kid", async () => {
    await expect(verifyCookie(ctx, "name", "value", "signature", null)).rejects.toThrow(
      ClientError,
    );

    expect(ctx.amphora.findByIdSync).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  test("should throw when findByIdSync throws", async () => {
    ctx.amphora.findByIdSync.mockImplementation(() => {
      throw new Error("not found");
    });

    await expect(
      verifyCookie(ctx, "name", "value", "signature", "unknown-kid"),
    ).rejects.toThrow(ClientError);
  });
});
