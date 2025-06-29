import { ClientError, ServerError } from "@lindorm/errors";
import { ConduitError } from "../../errors";
import { defaultCircuitBreakerVerifier } from "../../utils/private";

describe("defaultCircuitBreakerVerifier", () => {
  let ctx: any;
  let config: any;
  let breaker: any;

  const origin = "https://api.test";

  beforeEach(() => {
    ctx = { logger: { warn: jest.fn() } };

    config = {
      serverErrorThreshold: 5,
      clientErrorThreshold: 10,
    };

    breaker = {
      origin,
      state: "closed",
      errors: [],
      timestamp: Date.now(),
      isProbing: false,
    };
  });

  test("opens on unrecoverable status codes", async () => {
    const error = new ConduitError("fail", {
      status: ServerError.Status.NotImplemented,
    });

    await expect(
      defaultCircuitBreakerVerifier(config)(ctx, breaker, error),
    ).resolves.toEqual("open");

    expect(ctx.logger.warn).toHaveBeenCalledWith(
      "Circuit breaker open: unrecoverable server error",
      expect.objectContaining({
        origin,
        status: 501,
        message: error.message,
      }),
    );
  });

  test("opens when half-open and server error occurs", async () => {
    breaker.state = "half-open";

    const error = new ConduitError("error", {
      status: ServerError.Status.BadGateway,
    });

    await expect(
      defaultCircuitBreakerVerifier(config)(ctx, breaker, error),
    ).resolves.toEqual("open");

    expect(ctx.logger.warn).toHaveBeenCalledWith(
      "Circuit breaker open: server error when half-open",
      expect.objectContaining({
        origin,
        status: 502,
        message: error.message,
      }),
    );
  });

  test("closes for unknown status codes", async () => {
    const error = new ConduitError("error", {
      status: 666,
    });

    await expect(
      defaultCircuitBreakerVerifier(config)(ctx, breaker, error),
    ).resolves.toEqual("closed");

    expect(ctx.logger.warn).toHaveBeenCalledWith(
      "Circuit breaker closed: unknown error status",
      expect.objectContaining({
        origin,
        status: 666,
        message: error.message,
        amount: 0,
        threshold: -1,
      }),
    );
  });

  test.each([true, false])(
    "closes when under threshold (serverError=%s)",
    async (serverError) => {
      const status = serverError
        ? ServerError.Status.InternalServerError
        : ClientError.Status.ImATeapot;

      const error = new ConduitError("error", {
        status,
      });

      const threshold = serverError
        ? config.serverErrorThreshold
        : config.clientErrorThreshold;

      breaker.errors = Array(threshold - 1).fill(error);

      await expect(
        defaultCircuitBreakerVerifier(config)(ctx, breaker, error),
      ).resolves.toEqual("closed");
    },
  );

  test.each([true, false])(
    "opens when meets or exceeds threshold (serverError=%s)",
    async (serverError) => {
      const status = serverError
        ? ServerError.Status.InternalServerError
        : ClientError.Status.ImATeapot;

      const error = new ConduitError(" error", {
        status,
      });

      const threshold = serverError
        ? config.serverErrorThreshold
        : config.clientErrorThreshold;

      breaker.errors = Array(threshold).fill(error);

      await expect(
        defaultCircuitBreakerVerifier(config)(ctx, breaker, error),
      ).resolves.toEqual("open");

      expect(ctx.logger.warn).toHaveBeenCalledWith(
        "Circuit breaker open: exceeding threshold",
        expect.objectContaining({
          origin,
          status,
          message: error.message,
          amount: threshold,
          threshold,
        }),
      );
    },
  );
});
