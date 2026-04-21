import { ClientError } from "@lindorm/errors";
import { createIntrospectHandler } from "./introspect-handler.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createIntrospectHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      auth: {
        introspect: vi.fn().mockResolvedValue({ active: true }),
      },
      state: {
        session: {},
      },
    };
  });

  test("should resolve", async () => {
    await expect(createIntrospectHandler()(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({ active: true });
    expect(ctx.status).toEqual(200);
  });

  test("should throw if session not found", async () => {
    ctx.state.session = undefined;

    await expect(createIntrospectHandler()(ctx, vi.fn())).rejects.toThrow(ClientError);
  });
});
