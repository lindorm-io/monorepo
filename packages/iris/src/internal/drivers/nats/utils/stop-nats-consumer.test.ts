import type { NatsSharedState } from "../types/nats-types";
import { stopNatsConsumer, stopAllNatsConsumers } from "./stop-nats-consumer";
import { describe, expect, it, vi } from "vitest";

const createMockLoop = (overrides?: Record<string, any>) => ({
  consumerTag: overrides?.consumerTag ?? "tag-1",
  streamName: overrides?.streamName ?? "IRIS_TEST",
  consumerName: overrides?.consumerName ?? "test-consumer",
  subject: overrides?.subject ?? "test.events",
  messages: overrides?.messages ?? { close: vi.fn().mockResolvedValue(undefined) },
  abortController: overrides?.abortController ?? new AbortController(),
  loopPromise: overrides?.loopPromise ?? Promise.resolve(),
  ready: overrides?.ready ?? Promise.resolve(),
});

const createMockState = (loops: Array<Record<string, any>> = []): NatsSharedState => ({
  nc: null,
  js: null,
  jsm: null,
  headersInit: null,
  prefix: "test",
  streamName: "IRIS_TEST",
  consumerLoops: loops.map((l) => createMockLoop(l)) as any,
  consumerRegistrations: [],
  ensuredConsumers: new Set(),
  inFlightCount: 0,
  prefetch: 10,
});

describe("stopNatsConsumer", () => {
  it("should stop and remove a consumer by tag", async () => {
    const state = createMockState([{ consumerTag: "tag-1" }, { consumerTag: "tag-2" }]);

    await stopNatsConsumer(state, "tag-1");

    expect(state.consumerLoops).toHaveLength(1);
    expect(state.consumerLoops[0].consumerTag).toBe("tag-2");
  });

  it("should no-op for unknown consumerTag", async () => {
    const state = createMockState([{ consumerTag: "tag-1" }]);

    await stopNatsConsumer(state, "unknown");

    expect(state.consumerLoops).toHaveLength(1);
  });

  it("should call abort on the consumer", async () => {
    const ac = new AbortController();
    const state = createMockState([{ consumerTag: "tag-1", abortController: ac }]);

    await stopNatsConsumer(state, "tag-1");

    expect(ac.signal.aborted).toBe(true);
  });

  it("should close the messages iterator", async () => {
    const messages = { close: vi.fn().mockResolvedValue(undefined) };
    const state = createMockState([{ consumerTag: "tag-1", messages }]);

    await stopNatsConsumer(state, "tag-1");

    expect(messages.close).toHaveBeenCalled();
  });

  it("should tolerate messages.close() throwing", async () => {
    const messages = { close: vi.fn().mockRejectedValue(new Error("already closed")) };
    const state = createMockState([{ consumerTag: "tag-1", messages }]);

    await expect(stopNatsConsumer(state, "tag-1")).resolves.toBeUndefined();
    expect(state.consumerLoops).toHaveLength(0);
  });

  it("should tolerate null messages", async () => {
    const state = createMockState([{ consumerTag: "tag-1", messages: null }]);

    await expect(stopNatsConsumer(state, "tag-1")).resolves.toBeUndefined();
    expect(state.consumerLoops).toHaveLength(0);
  });

  it("should await loopPromise", async () => {
    let resolved = false;
    const loopPromise = new Promise<void>((r) => {
      setTimeout(() => {
        resolved = true;
        r();
      }, 10);
    });
    const state = createMockState([{ consumerTag: "tag-1", loopPromise }]);

    await stopNatsConsumer(state, "tag-1");

    expect(resolved).toBe(true);
  });

  it("should tolerate loopPromise rejecting", async () => {
    const loopPromise = Promise.reject(new Error("loop error"));
    // Prevent unhandled rejection
    loopPromise.catch(() => {});
    const state = createMockState([{ consumerTag: "tag-1", loopPromise }]);

    await expect(stopNatsConsumer(state, "tag-1")).resolves.toBeUndefined();
  });
});

describe("stopAllNatsConsumers", () => {
  it("should stop all consumers and empty the array", async () => {
    const state = createMockState([{ consumerTag: "tag-1" }, { consumerTag: "tag-2" }]);

    await stopAllNatsConsumers(state);

    expect(state.consumerLoops).toHaveLength(0);
  });

  it("should abort all consumers", async () => {
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    const state = createMockState([
      { consumerTag: "tag-1", abortController: ac1 },
      { consumerTag: "tag-2", abortController: ac2 },
    ]);

    await stopAllNatsConsumers(state);

    expect(ac1.signal.aborted).toBe(true);
    expect(ac2.signal.aborted).toBe(true);
  });

  it("should close all message iterators", async () => {
    const messages1 = { close: vi.fn().mockResolvedValue(undefined) };
    const messages2 = { close: vi.fn().mockResolvedValue(undefined) };
    const state = createMockState([
      { consumerTag: "tag-1", messages: messages1 },
      { consumerTag: "tag-2", messages: messages2 },
    ]);

    await stopAllNatsConsumers(state);

    expect(messages1.close).toHaveBeenCalled();
    expect(messages2.close).toHaveBeenCalled();
  });

  it("should handle empty consumer list", async () => {
    const state = createMockState([]);

    await expect(stopAllNatsConsumers(state)).resolves.toBeUndefined();
    expect(state.consumerLoops).toHaveLength(0);
  });

  it("should tolerate mixed success and failure in close", async () => {
    const messages1 = { close: vi.fn().mockRejectedValue(new Error("fail")) };
    const messages2 = { close: vi.fn().mockResolvedValue(undefined) };
    const state = createMockState([
      { consumerTag: "tag-1", messages: messages1 },
      { consumerTag: "tag-2", messages: messages2 },
    ]);

    await expect(stopAllNatsConsumers(state)).resolves.toBeUndefined();
    expect(state.consumerLoops).toHaveLength(0);
  });
});
