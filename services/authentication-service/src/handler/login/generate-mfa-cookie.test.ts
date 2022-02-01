import { Account } from "../../entity";
import { getTestAccount } from "../../test/entity";
import { generateMfaCookie } from "./generate-mfa-cookie";

describe("generateMfaCookie", () => {
  let ctx: any;
  let account: Account;

  beforeEach(() => {
    ctx = {
      setCookie: jest.fn(),
      cache: {
        mfaCookieSessionCache: {
          create: jest.fn().mockImplementation(async (arg) => arg),
        },
      },
    };

    account = getTestAccount();
  });

  test("should resolve", async () => {
    await expect(generateMfaCookie(ctx, account)).resolves.toBeUndefined();

    expect(ctx.cache.mfaCookieSessionCache.create).toHaveBeenCalled();
    expect(ctx.setCookie).toHaveBeenCalled();
  });
});
