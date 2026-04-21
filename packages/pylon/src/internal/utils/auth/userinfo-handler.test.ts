import { ClientError } from "@lindorm/errors";
import { createUserinfoHandler } from "./userinfo-handler.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createUserinfoHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      auth: {
        userinfo: vi.fn().mockResolvedValue({ userinfo: true }),
      },
      state: {
        session: {},
      },
    };
  });

  test("should resolve", async () => {
    await expect(createUserinfoHandler()(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({ userinfo: true });
    expect(ctx.status).toEqual(200);
  });

  test("should throw if session not found", async () => {
    ctx.state.session = undefined;

    await expect(createUserinfoHandler()(ctx, vi.fn())).rejects.toThrow(ClientError);
  });
});
