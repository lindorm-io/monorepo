import { createMockLogger } from "@lindorm/logger/mocks/jest";
import { ServerError } from "@lindorm/errors";
import { createConduitMiddleware } from "./create-conduit-middleware";

jest.mock("@lindorm/conduit", () => ({
  Conduit: jest.fn(),
  conduitChangeResponseDataMiddleware: jest.fn().mockReturnValue("changeResponse"),
  conduitCorrelationMiddleware: jest.fn().mockReturnValue("correlation"),
  conduitSessionMiddleware: jest.fn().mockReturnValue("session"),
}));

import {
  Conduit,
  conduitChangeResponseDataMiddleware,
  conduitCorrelationMiddleware,
  conduitSessionMiddleware,
} from "@lindorm/conduit";

describe("createConduitMiddleware", () => {
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("HTTP context (with sessionId)", () => {
    let ctx: any;

    beforeEach(() => {
      ctx = {
        logger: createMockLogger(),
        state: {
          metadata: {
            correlationId: "correlation-id",
            sessionId: "session-id",
          },
        },
        conduits: {},
      };
    });

    test("should create Conduit on ctx.conduits[alias]", async () => {
      const middleware = createConduitMiddleware({
        alias: "myService",
        baseUrl: "https://api.test.lindorm.io",
      });

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(Conduit).toHaveBeenCalledTimes(1);
      expect(ctx.conduits.myService).toBeDefined();
    });

    test("should include correlation middleware when correlationId exists", async () => {
      const middleware = createConduitMiddleware({
        alias: "myService",
        baseUrl: "https://api.test.lindorm.io",
      });

      await middleware(ctx, next);

      expect(conduitCorrelationMiddleware).toHaveBeenCalledWith("correlation-id");
      expect((Conduit as jest.Mock).mock.calls[0][0].middleware).toContain("correlation");
    });

    test("should include session middleware when sessionId exists", async () => {
      const middleware = createConduitMiddleware({
        alias: "myService",
        baseUrl: "https://api.test.lindorm.io",
      });

      await middleware(ctx, next);

      expect(conduitSessionMiddleware).toHaveBeenCalledWith("session-id");
      expect((Conduit as jest.Mock).mock.calls[0][0].middleware).toContain("session");
    });

    test("should always include changeResponseData middleware", async () => {
      const middleware = createConduitMiddleware({
        alias: "myService",
        baseUrl: "https://api.test.lindorm.io",
      });

      await middleware(ctx, next);

      expect(conduitChangeResponseDataMiddleware).toHaveBeenCalledWith("camel");
      expect((Conduit as jest.Mock).mock.calls[0][0].middleware).toContain(
        "changeResponse",
      );
    });

    test("should call next", async () => {
      const middleware = createConduitMiddleware({
        alias: "myService",
        baseUrl: "https://api.test.lindorm.io",
      });

      await middleware(ctx, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("Socket context (no sessionId)", () => {
    let ctx: any;

    beforeEach(() => {
      ctx = {
        logger: createMockLogger(),
        state: {
          metadata: {
            correlationId: "correlation-id",
          },
        },
        conduits: {},
      };
    });

    test("should NOT include session middleware when sessionId is absent", async () => {
      const middleware = createConduitMiddleware({
        alias: "myService",
        baseUrl: "https://api.test.lindorm.io",
      });

      await middleware(ctx, next);

      expect(conduitSessionMiddleware).not.toHaveBeenCalled();
      expect((Conduit as jest.Mock).mock.calls[0][0].middleware).not.toContain("session");
    });
  });

  describe("array of conduit options", () => {
    test("should support multiple conduits", async () => {
      const ctx: any = {
        logger: createMockLogger(),
        state: {
          metadata: {
            correlationId: "correlation-id",
          },
        },
        conduits: {},
      };

      const middleware = createConduitMiddleware([
        { alias: "serviceA", baseUrl: "https://a.test.lindorm.io" },
        { alias: "serviceB", baseUrl: "https://b.test.lindorm.io" },
      ]);

      await middleware(ctx, next);

      expect(Conduit).toHaveBeenCalledTimes(2);
      expect(ctx.conduits.serviceA).toBeDefined();
      expect(ctx.conduits.serviceB).toBeDefined();
    });
  });

  describe("validation", () => {
    test("should throw ServerError when alias is missing", () => {
      expect(() =>
        createConduitMiddleware({
          alias: "",
          baseUrl: "https://api.test.lindorm.io",
        }),
      ).toThrow(ServerError);
    });
  });
});
