import { createMockAmphora } from "@lindorm/amphora";
import { signCookie } from "./sign-cookie";

jest.mock("@lindorm/aegis", () => ({
  ...jest.requireActual("@lindorm/aegis"),
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
