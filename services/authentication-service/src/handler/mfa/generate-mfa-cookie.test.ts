import { createMockCache } from "@lindorm-io/redis";
import { createTestAuthenticationSession, createTestMfaCookieSession } from "../../fixtures/entity";
import { generateMfaCookie } from "./generate-mfa-cookie";

describe("generateMfaCookie", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      setCookie: jest.fn(),
      cache: {
        mfaCookieSessionCache: createMockCache(createTestMfaCookieSession),
      },
    };
  });

  test("should resolve", async () => {
    await expect(
      generateMfaCookie(ctx, createTestAuthenticationSession()),
    ).resolves.toBeUndefined();

    expect(ctx.cache.mfaCookieSessionCache.create).toHaveBeenCalled();
    expect(ctx.setCookie).toHaveBeenCalled();
  });
});
