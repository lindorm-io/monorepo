import { createMockAmphora } from "@lindorm/amphora";
import { signCookie } from "./sign-cookie";

jest.mock("@lindorm/aegis", () => ({
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
    ctx = {
      amphora: createMockAmphora(),
    };
  });

  test("should return signed value", async () => {
    await expect(signCookie(ctx, "value")).resolves.toStrictEqual(
      "formatted_signed_value",
    );
  });
});
