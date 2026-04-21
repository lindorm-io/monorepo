import { zephyrChangeIncomingDataMiddleware } from "./zephyr-change-incoming-data-middleware";
import { afterEach, describe, expect, test, vi } from "vitest";

describe("zephyrChangeIncomingDataMiddleware", () => {
  afterEach(vi.clearAllMocks);

  test("should convert incoming object keys to camelCase by default", async () => {
    const ctx: any = {
      outgoing: {},
      incoming: { data: { snake_case: "value", nested_key: { inner_key: 1 } } },
    };
    const next = vi.fn();

    await zephyrChangeIncomingDataMiddleware()(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.incoming.data).toMatchSnapshot();
  });

  test("should convert incoming array items", async () => {
    const ctx: any = {
      outgoing: {},
      incoming: { data: [{ snake_case: "a" }, { another_key: "b" }] },
    };

    await zephyrChangeIncomingDataMiddleware()(ctx, vi.fn());

    expect(ctx.incoming.data).toMatchSnapshot();
  });

  test("should respect custom mode", async () => {
    const ctx: any = { outgoing: {}, incoming: { data: { camelCase: "value" } } };

    await zephyrChangeIncomingDataMiddleware("snake")(ctx, vi.fn());

    expect(ctx.incoming.data).toMatchSnapshot();
  });

  test("should pass through non-object data", async () => {
    const ctx: any = { outgoing: {}, incoming: { data: "string" } };

    await zephyrChangeIncomingDataMiddleware()(ctx, vi.fn());

    expect(ctx.incoming.data).toBe("string");
  });

  test("should pass through null data", async () => {
    const ctx: any = { outgoing: {}, incoming: { data: null } };

    await zephyrChangeIncomingDataMiddleware()(ctx, vi.fn());

    expect(ctx.incoming.data).toBeNull();
  });

  test("should run after next (transforms response, not request)", async () => {
    const order: Array<string> = [];
    const next = vi.fn(async () => {
      order.push("next");
    });
    const ctx: any = { outgoing: {}, incoming: { data: { snake_case: "v" } } };

    await zephyrChangeIncomingDataMiddleware()(ctx, next);

    order.push("after");
    expect(order[0]).toBe("next");
  });
});
