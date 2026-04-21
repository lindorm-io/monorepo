import { zephyrChangeOutgoingDataMiddleware } from "./zephyr-change-outgoing-data-middleware.js";
import { afterEach, describe, expect, test, vi } from "vitest";

describe("zephyrChangeOutgoingDataMiddleware", () => {
  const next = vi.fn();

  afterEach(vi.clearAllMocks);

  test("should convert outgoing object keys to snake_case by default", async () => {
    const ctx: any = {
      outgoing: { data: { camelCase: "value", nestedKey: { innerKey: 1 } } },
      incoming: {},
    };

    await zephyrChangeOutgoingDataMiddleware()(ctx, next);

    expect(ctx.outgoing.data).toMatchSnapshot();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should convert outgoing array items", async () => {
    const ctx: any = {
      outgoing: { data: [{ camelCase: "a" }, { anotherKey: "b" }] },
      incoming: {},
    };

    await zephyrChangeOutgoingDataMiddleware()(ctx, next);

    expect(ctx.outgoing.data).toMatchSnapshot();
  });

  test("should respect custom mode", async () => {
    const ctx: any = { outgoing: { data: { snake_case: "value" } }, incoming: {} };

    await zephyrChangeOutgoingDataMiddleware("camel")(ctx, next);

    expect(ctx.outgoing.data).toMatchSnapshot();
  });

  test("should pass through non-object data", async () => {
    const ctx: any = { outgoing: { data: "string" }, incoming: {} };

    await zephyrChangeOutgoingDataMiddleware()(ctx, next);

    expect(ctx.outgoing.data).toBe("string");
  });

  test("should pass through null data", async () => {
    const ctx: any = { outgoing: { data: null }, incoming: {} };

    await zephyrChangeOutgoingDataMiddleware()(ctx, next);

    expect(ctx.outgoing.data).toBeNull();
  });
});
