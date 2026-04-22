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

  test("should pass entity and context to callbacks in that order", () => {
    const entity = { id: "1" };
    const ctx = {
      correlationId: "c-1",
      actor: "admin",
      timestamp: new Date("2024-01-01T00:00:00Z"),
    };
    runHooksSync("OnCreate", hooks, entity, ctx);

    expect(hooks[0].callback).toHaveBeenCalledWith(entity, ctx);
  });

  test("should pass a default hook meta when no context is provided", () => {
    const entity = { id: "1" };
    runHooksSync("OnCreate", hooks, entity);

    expect(hooks[0].callback).toHaveBeenCalledWith(
      entity,
      expect.objectContaining({
        correlationId: "unknown",
        actor: null,
        timestamp: expect.any(Date),
      }),
    );
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
