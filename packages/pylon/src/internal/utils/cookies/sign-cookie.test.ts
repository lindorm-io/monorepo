import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { signCookie } from "./sign-cookie.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@lindorm/aegis", async () => ({
  ...(await vi.importActual<typeof import("@lindorm/aegis")>("@lindorm/aegis")),
  SignatureKit: class SignatureKit {
    format(value: any): string {
      return "formatted_" + value;
    }
    sign(value: string): string {
      return "signed_" + value;
    }
  },
}));

describe("signCookie", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = { amphora: createMockAmphora() };
    ctx.amphora.find.mockResolvedValue({ id: "kid-1" });
  });

  test("should return signed value and kid", async () => {
    await expect(signCookie(ctx, "value")).resolves.toStrictEqual({
      signature: "formatted_signed_value",
      kid: "kid-1",
    });
  });
});
