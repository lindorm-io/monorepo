import type { MemoryEnvelope, MemorySharedState } from "../types/memory-store";
import { createStore } from "./create-store";
import { dispatchToConsumers } from "./dispatch-to-consumers";

const makeEnvelope = (topic: string, broadcast = false): MemoryEnvelope => ({
  payload: Buffer.from("test"),
  headers: {},
  topic,
  priority: 0,
  timestamp: Date.now(),
  expiry: null,
  broadcast,
  attempt: 0,
  maxRetries: 0,
  retryStrategy: "constant",
  retryDelay: 1000,
  retryDelayMax: 30000,
  retryMultiplier: 2,
  retryJitter: false,
  replyTo: null,
  identifierValue: null,
  correlationId: null,
});

describe("dispatchToConsumers", () => {
  let store: MemorySharedState;

  beforeEach(() => {
    store = createStore();
  });

  it("should do nothing when there are no matching consumers", async () => {
    await expect(dispatchToConsumers(store, makeEnvelope("t1"))).resolves.toBeUndefined();
  });

  it("should dispatch to one consumer via round-robin", async () => {
    const calls: Array<string> = [];

    store.consumers.push(
      {
        topic: "t1",
        callback: async () => {
          calls.push("a");
        },
        consumerTag: "a",
      },
      {
        topic: "t1",
        callback: async () => {
          calls.push("b");
        },
        consumerTag: "b",
      },
    );

    await dispatchToConsumers(store, makeEnvelope("t1"));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe("a");
  });

  it("should round-robin across multiple dispatches", async () => {
    const calls: Array<string> = [];

    store.consumers.push(
      {
        topic: "t1",
        callback: async () => {
          calls.push("a");
        },
        consumerTag: "a",
      },
      {
        topic: "t1",
        callback: async () => {
          calls.push("b");
        },
        consumerTag: "b",
      },
      {
        topic: "t1",
        callback: async () => {
          calls.push("c");
        },
        consumerTag: "c",
      },
    );

    await dispatchToConsumers(store, makeEnvelope("t1"));
    await dispatchToConsumers(store, makeEnvelope("t1"));
    await dispatchToConsumers(store, makeEnvelope("t1"));

    expect(calls).toMatchSnapshot();
  });

  it("should dispatch to all consumers in broadcast mode", async () => {
    const calls: Array<string> = [];

    store.consumers.push(
      {
        topic: "t1",
        callback: async () => {
          calls.push("a");
        },
        consumerTag: "a",
      },
      {
        topic: "t1",
        callback: async () => {
          calls.push("b");
        },
        consumerTag: "b",
      },
    );

    await dispatchToConsumers(store, makeEnvelope("t1", true));

    expect(calls).toMatchSnapshot();
  });

  it("should only dispatch to consumers matching the topic", async () => {
    const calls: Array<string> = [];

    store.consumers.push(
      {
        topic: "t1",
        callback: async () => {
          calls.push("a");
        },
        consumerTag: "a",
      },
      {
        topic: "t2",
        callback: async () => {
          calls.push("b");
        },
        consumerTag: "b",
      },
    );

    await dispatchToConsumers(store, makeEnvelope("t1"));

    expect(calls).toMatchSnapshot();
  });
});
