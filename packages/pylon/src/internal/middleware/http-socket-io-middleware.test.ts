import { httpSocketIoMiddleware } from "./http-socket-io-middleware";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createHttpSocketIoMiddleware", () => {
  let ctx: any;
  let socketIo: any;

  beforeEach(() => {
    ctx = {};
    socketIo = "socketIo";
  });

  test("should resolve", async () => {
    await expect(httpSocketIoMiddleware(socketIo)(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.io).toEqual({ app: "socketIo" });
  });
});
