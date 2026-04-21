import type { MetaHook } from "../types/metadata.js";
import { runHooksSync } from "./run-hooks-sync.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("runHooksSync", () => {
  const hooks: Array<MetaHook> = [
    { decorator: "OnCreate", callback: vi.fn() },
    { decorator: "OnValidate", callback: vi.fn() },
    { decorator: "OnCreate", callback: vi.fn() },
    { decorator: "OnHydrate", callback: vi.fn() },
  ];

  beforeEach(() => {
    for (const h of hooks) {
      (h.callback as Mock).mockClear();
    }
  });

  test("should call only hooks matching the decorator", () => {
    const entity = { id: "1" };
    runHooksSync("OnCreate", hooks, entity);

    expect(hooks[0].callback).toHaveBeenCalledTimes(1);
    expect(hooks[1].callback).not.toHaveBeenCalled();
    expect(hooks[2].callback).toHaveBeenCalledTimes(1);
    expect(hooks[3].callback).not.toHaveBeenCalled();
  });

  test("should pass context and entity to callbacks", () => {
    const entity = { id: "1" };
    const ctx = { user: "admin" };
    runHooksSync("OnCreate", hooks, entity, ctx);

    expect(hooks[0].callback).toHaveBeenCalledWith(ctx, entity);
  });

  test("should pass undefined context when not provided", () => {
    const entity = { id: "1" };
    runHooksSync("OnCreate", hooks, entity);

    expect(hooks[0].callback).toHaveBeenCalledWith(undefined, entity);
  });

  test("should be a no-op when no hooks match", () => {
    runHooksSync("BeforeDestroy", hooks, { id: "1" });

    for (const h of hooks) {
      expect(h.callback).not.toHaveBeenCalled();
    }
  });

  test("should be a no-op for empty hooks array", () => {
    expect(() => runHooksSync("OnCreate", [], { id: "1" })).not.toThrow();
  });

  test("should propagate error from throwing hook", () => {
    const throwingHook: MetaHook = {
      decorator: "OnCreate",
      callback: () => {
        throw new Error("hook failed");
      },
    };
    expect(() => runHooksSync("OnCreate", [throwingHook], { id: "1" })).toThrow(
      "hook failed",
    );
  });

  test("should throw if hook returns a Promise", () => {
    const asyncHook: MetaHook = {
      decorator: "OnCreate",
      callback: () => Promise.resolve(),
    };
    expect(() => runHooksSync("OnCreate", [asyncHook], { id: "1" })).toThrow(
      "OnCreate hook returned a Promise",
    );
  });
});
