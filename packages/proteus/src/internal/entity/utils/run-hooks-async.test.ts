import type { MetaHook } from "../types/metadata.js";
import { runHooksAsync } from "./run-hooks-async.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("runHooksAsync", () => {
  const hooks: Array<MetaHook> = [
    { decorator: "BeforeInsert", callback: vi.fn().mockResolvedValue(undefined) },
    { decorator: "AfterInsert", callback: vi.fn().mockResolvedValue(undefined) },
    { decorator: "BeforeInsert", callback: vi.fn().mockResolvedValue(undefined) },
  ];

  beforeEach(() => {
    for (const h of hooks) {
      (h.callback as Mock).mockClear();
    }
  });

  test("should call only hooks matching the decorator", async () => {
    const entity = { id: "1" };
    await runHooksAsync("BeforeInsert", hooks, entity);

    expect(hooks[0].callback).toHaveBeenCalledTimes(1);
    expect(hooks[1].callback).not.toHaveBeenCalled();
    expect(hooks[2].callback).toHaveBeenCalledTimes(1);
  });

  test("should pass entity and context to callbacks in that order", async () => {
    const entity = { id: "1" };
    const ctx = {
      correlationId: "c-1",
      actor: "admin",
      timestamp: new Date("2024-01-01T00:00:00Z"),
    };
    await runHooksAsync("BeforeInsert", hooks, entity, ctx);

    expect(hooks[0].callback).toHaveBeenCalledWith(entity, ctx);
  });

  test("should execute hooks sequentially", async () => {
    const order: Array<number> = [];
    const seqHooks: Array<MetaHook> = [
      {
        decorator: "BeforeInsert",
        callback: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 10));
          order.push(1);
        }),
      },
      {
        decorator: "BeforeInsert",
        callback: vi.fn(async () => {
          order.push(2);
        }),
      },
    ];

    await runHooksAsync("BeforeInsert", seqHooks, { id: "1" });

    expect(order).toEqual([1, 2]);
  });

  test("should be a no-op when no hooks match", async () => {
    await runHooksAsync("AfterDestroy", hooks, { id: "1" });

    for (const h of hooks) {
      expect(h.callback).not.toHaveBeenCalled();
    }
  });

  test("should propagate async errors", async () => {
    const errorHooks: Array<MetaHook> = [
      {
        decorator: "BeforeInsert",
        callback: vi.fn().mockRejectedValue(new Error("hook failed")),
      },
    ];

    await expect(runHooksAsync("BeforeInsert", errorHooks, { id: "1" })).rejects.toThrow(
      "hook failed",
    );
  });
});
