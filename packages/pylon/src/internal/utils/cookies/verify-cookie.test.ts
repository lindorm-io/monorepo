import { createMockAmphora } from "@lindorm/amphora";
import { ClientError } from "@lindorm/errors";
import { verifyCookie } from "./verify-cookie";

const verify = jest.fn();

jest.mock("@lindorm/aegis", () => ({
  SignatureKit: class SignatureKit {
    verify(): boolean {
      return verify();
    }
  },
}));

describe("verifyCookie", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      amphora: createMockAmphora(),
    };

    ctx.amphora.filter.mockResolvedValue(["kryptos1", "kryptos2", "kryptos3"]);
  });

  afterEach(jest.clearAllMocks);

  test("should resolve immediately", async () => {
    verify.mockReturnValueOnce(true);

    await expect(
      verifyCookie(ctx, "name", "value", "signature"),
    ).resolves.toBeUndefined();

    expect(verify).toHaveBeenCalledTimes(1);
  });

  test("should resolve when verification succeeds", async () => {
    verify
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    await expect(
      verifyCookie(ctx, "name", "value", "signature"),
    ).resolves.toBeUndefined();

    expect(verify).toHaveBeenCalledTimes(3);
  });

  test("should throw when no verification succeeds", async () => {
    verify.mockReturnValue(false);

    await expect(verifyCookie(ctx, "name", "value", "signature")).rejects.toThrow(
      ClientError,
    );

    expect(verify).toHaveBeenCalledTimes(3);
  });

  test("should throw on missing signature", async () => {
    verify.mockReturnValue(false);

    await expect(verifyCookie(ctx, "name", "value", null)).rejects.toThrow(ClientError);

    expect(verify).not.toHaveBeenCalled();
  });
});
