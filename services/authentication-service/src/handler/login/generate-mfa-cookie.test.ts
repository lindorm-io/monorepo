import { Account } from "../../entity";
import { createMockCache } from "@lindorm-io/redis";
import { generateMfaCookie } from "./generate-mfa-cookie";
import { getTestAccount } from "../../test/entity";

describe("generateMfaCookie", () => {
  let ctx: any;
  let account: Account;

  beforeEach(() => {
    ctx = {
      setCookie: jest.fn(),
      cache: {
        mfaCookieSessionCache: createMockCache(),
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
