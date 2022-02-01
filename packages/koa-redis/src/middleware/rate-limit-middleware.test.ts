import { assertRateLimit as _assertRateLimit } from "../handler";
import { rateLimitMiddleware } from "./rate-limit-middleware";

jest.mock("../handler");

const next = (): Promise<void> => Promise.resolve();

const assertRateLimit = _assertRateLimit as jest.Mock;

describe("rateLimitMiddleware", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      metadata: {
        device: {
          ip: "ip-1",
        },
      },
    };

    options = {
      expiresInSeconds: 5,
      keyName: "ip",
      limit: 5,
    };
  });

  test("should resolve", async () => {
    await expect(
      rateLimitMiddleware(options)("metadata.device.ip")(ctx, next),
    ).resolves.not.toThrow();

    expect(assertRateLimit).toHaveBeenCalled();
  });

  test("should resolve with fallback", async () => {
    ctx.metadata.device.ip = undefined;

    await expect(
      rateLimitMiddleware(options)("metadata.device.ip", { fallback: "fallback" })(ctx, next),
    ).resolves.not.toThrow();
  });

  test("should reject invalid value", async () => {
    ctx.metadata.device.ip = undefined;

    await expect(rateLimitMiddleware(options)("metadata.device.ip")(ctx, next)).rejects.toThrow();
  });
});
