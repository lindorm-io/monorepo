import { createMockCache } from "@lindorm-io/redis";
import { createTestAuthenticationSession, createTestMfaCookieSession } from "../../fixtures/entity";
import { generateMfaCookie } from "./generate-mfa-cookie";

describe("generateMfaCookie", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cookies: {
        set: jest.fn(),
      },
      cache: {
        mfaCookieSessionCache: createMockCache(createTestMfaCookieSession),
      },
      server: {
        environment: "development",
      },
    };
  });

  test("should resolve", async () => {
    await expect(
      generateMfaCookie(ctx, createTestAuthenticationSession()),
    ).resolves.toBeUndefined();

    expect(ctx.cache.mfaCookieSessionCache.create).toHaveBeenCalled();
    expect(ctx.cookies.set).toHaveBeenCalledWith(
      "lindorm_io_authentication_mfa",
      expect.any(String),
      {
        expires: expect.any(Date),
        httpOnly: true,
        overwrite: true,
        signed: true,
      },
    );
  });
});
