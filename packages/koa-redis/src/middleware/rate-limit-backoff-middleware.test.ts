import { ClientError } from "@lindorm-io/errors";
import { rateLimitBackoffMiddleware } from "./rate-limit-backoff-middleware";
import {
  assertRateLimitBackoff as _assertRateLimitBackoff,
  clearRateLimitBackoff as _clearRateLimitBackoff,
  setRateLimitBackoff as _setRateLimitBackoff,
} from "../handler";

jest.mock("../handler");

const assertRateLimitBackoff = _assertRateLimitBackoff as jest.Mock;
const clearRateLimitBackoff = _clearRateLimitBackoff as jest.Mock;
const setRateLimitBackoff = _setRateLimitBackoff as jest.Mock;

describe("rateLimitBackoffMiddleware", () => {
  let ctx: any;
  let next: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      entity: {
        device: {
          id: "id",
        },
      },
    };

    next = jest.fn();

    options = {
      expiresInSeconds: 5,
      keyName: "ip",
      limit: 5,
    };
  });

  test("should resolve", async () => {
    await expect(
      rateLimitBackoffMiddleware(options)("entity.device.id")(ctx, next),
    ).resolves.not.toThrow();

    expect(assertRateLimitBackoff).toHaveBeenCalled();
    expect(clearRateLimitBackoff).toHaveBeenCalled();
    expect(setRateLimitBackoff).not.toHaveBeenCalled();
  });

  test("should reject invalid value", async () => {
    ctx.entity.device.id = undefined;

    await expect(
      rateLimitBackoffMiddleware(options)("entity.device.id")(ctx, next),
    ).rejects.toThrow(ClientError);
  });

  test("should reject with retry", async () => {
    next.mockRejectedValue(new ClientError("message"));

    setRateLimitBackoff.mockResolvedValue({ retryIn: 99 });

    await expect(
      rateLimitBackoffMiddleware(options)("entity.device.id")(ctx, next),
    ).rejects.toThrow(
      expect.objectContaining({
        name: "ClientError",
        message: "Rate Limit",
        data: { retryIn: 99 },
      }),
    );
  });

  test("should reject with retriesLeft", async () => {
    next.mockRejectedValue(new ClientError("message"));

    setRateLimitBackoff.mockResolvedValue({ retriesLeft: 1 });

    await expect(
      rateLimitBackoffMiddleware(options)("entity.device.id")(ctx, next),
    ).rejects.toThrow(
      expect.objectContaining({
        name: "ClientError",
        message: "message",
        data: { retriesLeft: 1 },
      }),
    );
  });
});
