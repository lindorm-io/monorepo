import { IrisError } from "../../../errors/IrisError.js";
import { runHooksSync, runHooksAsync } from "./run-hooks.js";
import type { MetaHook } from "../types/metadata.js";
import { describe, expect, it, vi } from "vitest";

const makeHook = (
  decorator: MetaHook["decorator"],
  callback: MetaHook["callback"],
): MetaHook => ({ decorator, callback });

describe("runHooksSync", () => {
  it("should call hooks matching the specified decorator type", () => {
    const cb = vi.fn();
    const hooks = [makeHook("OnCreate", cb)];
    const message = { id: "abc" };
    const context = { user: "test" };

    runHooksSync("OnCreate", hooks, message, context);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(message, context);
  });

  it("should skip hooks of different decorator types", () => {
    const onCreateCb = vi.fn();
    const onHydrateCb = vi.fn();
    const hooks = [makeHook("OnCreate", onCreateCb), makeHook("OnHydrate", onHydrateCb)];

    runHooksSync("OnCreate", hooks, {});

    expect(onCreateCb).toHaveBeenCalledTimes(1);
    expect(onHydrateCb).not.toHaveBeenCalled();
  });

  it("should run multiple hooks of the same type in array order", () => {
    const order: Array<number> = [];
    const hooks = [
      makeHook("OnValidate", () => {
        order.push(1);
      }),
      makeHook("OnValidate", () => {
        order.push(2);
      }),
      makeHook("OnValidate", () => {
        order.push(3);
      }),
    ];

    runHooksSync("OnValidate", hooks, {});

    expect(order).toMatchSnapshot();
  });

  it("should pass message and context to the callback", () => {
    const cb = vi.fn();
    const hooks = [makeHook("BeforePublish", cb)];
    const msg = { payload: "data" };
    const ctx = { traceId: "123" };

    runHooksSync("BeforePublish", hooks, msg, ctx);

    expect(cb.mock.calls).toMatchSnapshot();
  });

  it("should not error when hooks array is empty", () => {
    expect(() => runHooksSync("OnCreate", [], {})).not.toThrow();
  });

  it("should not error when no hooks match the decorator", () => {
    const cb = vi.fn();
    const hooks = [makeHook("OnHydrate", cb)];

    expect(() => runHooksSync("OnCreate", hooks, {})).not.toThrow();
    expect(cb).not.toHaveBeenCalled();
  });

  it("should throw IrisError if a hook returns a Promise", () => {
    const hooks = [makeHook("OnCreate", () => Promise.resolve())];

    expect(() => runHooksSync("OnCreate", hooks, {})).toThrow(IrisError);
  });

  it("should include the decorator name in the async error message", () => {
    const hooks = [makeHook("BeforeConsume", async () => {})];

    expect(() => runHooksSync("BeforeConsume", hooks, {})).toThrow(
      /BeforeConsume.*synchronous/,
    );
  });
});

describe("runHooksAsync", () => {
  it("should call hooks matching the specified decorator type", async () => {
    const cb = vi.fn();
    const hooks = [makeHook("AfterPublish", cb)];
    const message = { id: "xyz" };
    const context = { session: "s1" };

    await runHooksAsync("AfterPublish", hooks, message, context);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(message, context);
  });

  it("should skip hooks of different decorator types", async () => {
    const matchCb = vi.fn();
    const otherCb = vi.fn();
    const hooks = [makeHook("AfterConsume", matchCb), makeHook("OnCreate", otherCb)];

    await runHooksAsync("AfterConsume", hooks, {});

    expect(matchCb).toHaveBeenCalledTimes(1);
    expect(otherCb).not.toHaveBeenCalled();
  });

  it("should await async hooks sequentially", async () => {
    const order: Array<number> = [];
    const hooks = [
      makeHook("OnConsumeError", async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push(1);
      }),
      makeHook("OnConsumeError", async () => {
        order.push(2);
      }),
    ];

    await runHooksAsync("OnConsumeError", hooks, {});

    expect(order).toMatchSnapshot();
  });

  it("should pass message and context to the callback", async () => {
    const cb = vi.fn();
    const hooks = [makeHook("BeforeConsume", cb)];
    const msg = { type: "event" };
    const ctx = { correlationId: "c1" };

    await runHooksAsync("BeforeConsume", hooks, msg, ctx);

    expect(cb.mock.calls).toMatchSnapshot();
  });

  it("should not error when hooks array is empty", async () => {
    await expect(runHooksAsync("OnCreate", [], {})).resolves.toBeUndefined();
  });

  it("should not error when no hooks match the decorator", async () => {
    const cb = vi.fn();
    const hooks = [makeHook("OnHydrate", cb)];

    await runHooksAsync("OnCreate", hooks, {});

    expect(cb).not.toHaveBeenCalled();
  });

  it("should propagate errors thrown by async hooks", async () => {
    const hooks = [
      makeHook("OnCreate", async () => {
        throw new Error("hook failed");
      }),
    ];

    await expect(runHooksAsync("OnCreate", hooks, {})).rejects.toThrow("hook failed");
  });

  it("should run multiple hooks of the same type in array order", async () => {
    const order: Array<number> = [];
    const hooks = [
      makeHook("AfterPublish", () => {
        order.push(1);
      }),
      makeHook("AfterPublish", () => {
        order.push(2);
      }),
      makeHook("AfterPublish", () => {
        order.push(3);
      }),
    ];

    await runHooksAsync("AfterPublish", hooks, {});

    expect(order).toMatchSnapshot();
  });
});
