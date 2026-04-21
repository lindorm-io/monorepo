import type { RedisSharedState, RedisConsumerLoop } from "../types/redis-types.js";
import { stopConsumerLoop, stopAllConsumerLoops } from "./stop-consumer-loop.js";
import { describe, expect, it, vi, type Mock } from "vitest";

const createMockLoop = (
  consumerTag: string,
  overrides?: Partial<RedisConsumerLoop>,
): RedisConsumerLoop => ({
  consumerTag,
  groupName: `group-${consumerTag}`,
  streamKey: `stream-${consumerTag}`,
  callback: vi.fn(),
  abortController: new AbortController(),
  loopPromise: Promise.resolve(),
  ready: Promise.resolve(),
  connection: {
    xadd: vi.fn(),
    xreadgroup: vi.fn(),
    xack: vi.fn(),
    xgroup: vi.fn(),
    del: vi.fn(),
    duplicate: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  } as any,
  ...overrides,
});

const createMockState = (loops?: Array<RedisConsumerLoop>): RedisSharedState => ({
  publishConnection: null,
  connectionConfig: { url: "redis://localhost:6379" },
  prefix: "iris",
  consumerName: "iris:test:1:abcd1234",
  consumerLoops: loops ?? [],
  consumerRegistrations: [],
  createdGroups: new Set(),
  publishedStreams: new Set(),
  inFlightCount: 0,
  prefetch: 10,
  blockMs: 5000,
  maxStreamLength: null,
});

describe("stopConsumerLoop", () => {
  it("should abort, await, disconnect, and remove the loop", async () => {
    const loop = createMockLoop("ctag-1");
    const state = createMockState([loop]);

    await stopConsumerLoop(state, "ctag-1");

    expect(loop.abortController.signal.aborted).toBe(true);
    expect(loop.connection.disconnect).toHaveBeenCalledTimes(1);
    expect(state.consumerLoops).toHaveLength(0);
  });

  it("should be a no-op for unknown consumerTag", async () => {
    const loop = createMockLoop("ctag-1");
    const state = createMockState([loop]);

    await stopConsumerLoop(state, "unknown");

    expect(state.consumerLoops).toHaveLength(1);
    expect(loop.abortController.signal.aborted).toBe(false);
  });

  it("should not throw if loopPromise rejects", async () => {
    const loop = createMockLoop("ctag-1", {
      loopPromise: Promise.reject(new Error("loop error")),
    });
    const state = createMockState([loop]);

    await expect(stopConsumerLoop(state, "ctag-1")).resolves.toBeUndefined();
    expect(state.consumerLoops).toHaveLength(0);
  });

  it("should not throw if disconnect throws", async () => {
    const loop = createMockLoop("ctag-1");
    (loop.connection.disconnect as Mock).mockImplementation(() => {
      throw new Error("disconnect failed");
    });
    const state = createMockState([loop]);

    await expect(stopConsumerLoop(state, "ctag-1")).resolves.toBeUndefined();
    expect(state.consumerLoops).toHaveLength(0);
  });

  it("should only remove the targeted loop from multiple loops", async () => {
    const loop1 = createMockLoop("ctag-1");
    const loop2 = createMockLoop("ctag-2");
    const state = createMockState([loop1, loop2]);

    await stopConsumerLoop(state, "ctag-1");

    expect(state.consumerLoops).toHaveLength(1);
    expect(state.consumerLoops[0].consumerTag).toBe("ctag-2");
    expect(loop2.abortController.signal.aborted).toBe(false);
  });
});

describe("stopAllConsumerLoops", () => {
  it("should abort, await, and disconnect all loops", async () => {
    const loop1 = createMockLoop("ctag-1");
    const loop2 = createMockLoop("ctag-2");
    const state = createMockState([loop1, loop2]);

    await stopAllConsumerLoops(state);

    expect(loop1.abortController.signal.aborted).toBe(true);
    expect(loop2.abortController.signal.aborted).toBe(true);
    expect(loop1.connection.disconnect).toHaveBeenCalledTimes(1);
    expect(loop2.connection.disconnect).toHaveBeenCalledTimes(1);
    expect(state.consumerLoops).toHaveLength(0);
  });

  it("should handle empty consumerLoops", async () => {
    const state = createMockState([]);

    await expect(stopAllConsumerLoops(state)).resolves.toBeUndefined();
    expect(state.consumerLoops).toHaveLength(0);
  });

  it("should not throw if a loop rejects", async () => {
    const loop1 = createMockLoop("ctag-1", {
      loopPromise: Promise.reject(new Error("loop error")),
    });
    const loop2 = createMockLoop("ctag-2");
    const state = createMockState([loop1, loop2]);

    await expect(stopAllConsumerLoops(state)).resolves.toBeUndefined();
    expect(state.consumerLoops).toHaveLength(0);
  });
});
