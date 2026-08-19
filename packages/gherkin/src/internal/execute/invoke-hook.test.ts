import { describe, expect, test } from "vitest";
import { captureAsync } from "../../__fixtures__/test-helpers.js";
import type { RegistryHook } from "../registry/types.js";
import { invokeHook } from "./invoke-hook.js";

const hook = (methodName: string): RegistryHook => ({
  className: "Hooks",
  injects: [],
  kind: "BeforeScenario",
  matches: () => true,
  methodName,
  modulePath: "src/hooks.steps.ts",
  priority: 10_000,
  static: false,
  target: class {},
});

const format = (message: string): string => `wrapped: ${message}`;

describe("invokeHook", () => {
  test("should invoke the method on the instance with the given arguments", async () => {
    const calls: Array<unknown> = [];

    await invokeHook({
      args: ["a", 2],
      format,
      hook: hook("record"),
      instance: {
        record: (...args: Array<unknown>) => {
          calls.push(args);
        },
      },
    });

    expect(calls).toEqual([["a", 2]]);
  });

  test("should await an async hook before returning", async () => {
    const order: Array<string> = [];

    await invokeHook({
      args: [],
      format,
      hook: hook("slow"),
      instance: {
        slow: async () => {
          await Promise.resolve();
          order.push("hook finished");
        },
      },
    });

    order.push("invoke returned");

    expect(order).toEqual(["hook finished", "invoke returned"]);
  });

  test("should rethrow the ORIGINAL error instance with the message wrapped in place", async () => {
    const original = new Error("boom") as Error & { actual: string };
    original.actual = "diff survives";

    const error = await captureAsync(() =>
      invokeHook({
        args: [],
        format,
        hook: hook("throws"),
        instance: {
          throws: () => {
            throw original;
          },
        },
      }),
    );

    expect(error).toBe(original);
    expect(error.message).toBe("wrapped: boom");
  });

  test("should treat a rejecting async hook exactly as a throwing one", async () => {
    const error = await captureAsync(() =>
      invokeHook({
        args: [],
        format,
        hook: hook("rejects"),
        instance: {
          rejects: async () => {
            await Promise.resolve();
            throw new Error("rejected after a tick");
          },
        },
      }),
    );

    expect(error.message).toBe("wrapped: rejected after a tick");
  });

  test("should wrap a non-Error throw into an Error carrying the original as cause", async () => {
    const error = await captureAsync(() =>
      invokeHook({
        args: [],
        format,
        hook: hook("throwsString"),
        instance: {
          throwsString: () => {
            // eslint-disable-next-line no-throw-literal
            throw "just a string";
          },
        },
      }),
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("wrapped: just a string");
    expect((error as unknown as { cause: unknown }).cause).toBe("just a string");
  });

  test("should invoke a static hook against the class itself", async () => {
    const calls: Array<string> = [];

    class StaticHooks {
      static start(): void {
        calls.push("started");
      }
    }

    await invokeHook({
      args: [],
      format,
      hook: hook("start"),
      instance: StaticHooks,
    });

    expect(calls).toEqual(["started"]);
  });
});
