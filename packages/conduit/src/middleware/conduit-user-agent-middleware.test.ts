import { beforeEach, describe, expect, test, vi } from "vitest";
import { conduitUserAgentMiddleware } from "./conduit-user-agent-middleware.js";

describe("conduitUserAgentMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      req: {
        headers: { existing: "header" },
      },
    };
  });

  test("should set every x-user-agent-* header for a full client declaration", async () => {
    const next = vi.fn();

    await expect(
      conduitUserAgentMiddleware({
        app: "wallet",
        appVersion: "1.2.3",
        build: "4567",
        channel: "ios-app-store",
        deviceName: "Jonn's iPhone",
        deviceModel: "iPhone15,2",
        deviceType: "mobile",
        platform: "ios",
        timezone: "Europe/Stockholm",
      })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.req.headers).toMatchSnapshot();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should only set headers for provided fields and omit null/undefined", async () => {
    await expect(
      conduitUserAgentMiddleware({
        app: "wallet",
        appVersion: null,
        deviceType: "mobile",
        timezone: undefined,
      })(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.headers).toMatchSnapshot();
  });

  test("should merge with, and not clobber, pre-existing request headers", async () => {
    await conduitUserAgentMiddleware({ app: "wallet" })(ctx, vi.fn());

    expect(ctx.req.headers.existing).toBe("header");
    expect(ctx.req.headers["x-user-agent-app"]).toBe("wallet");
  });

  test("should call next", async () => {
    const next = vi.fn();

    await conduitUserAgentMiddleware({})(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
