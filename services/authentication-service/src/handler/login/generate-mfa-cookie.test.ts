import { Account } from "../../entity";
import { createMockCache } from "@lindorm-io/redis";
import { generateMfaCookie } from "./generate-mfa-cookie";
import { createTestAccount, createTestMfaCookieSession } from "../../fixtures/entity";

describe("generateMfaCookie", () => {
  let ctx: any;
  let account: Account;

  beforeEach(() => {
    ctx = {
      setCookie: jest.fn(),
      cache: {
        mfaCookieSessionCache: createMockCache(createTestMfaCookieSession),
      },
    };

    account = createTestAccount();
  });

  test("should resolve", async () => {
    await expect(generateMfaCookie(ctx, account)).resolves.toBeUndefined();

    expect(ctx.cache.mfaCookieSessionCache.create).toHaveBeenCalled();
    expect(ctx.setCookie).toHaveBeenCalled();
  });
});
