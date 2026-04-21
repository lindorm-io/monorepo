import type { MemoryEnvelope, MemorySharedState } from "../types/memory-store";
import { createStore } from "./create-store";
import { dispatchToSubscribers } from "./dispatch-to-subscribers";
import { beforeEach, describe, expect, it } from "vitest";

const makeEnvelope = (topic: string): MemoryEnvelope => ({
  payload: Buffer.from("test"),
  headers: {},
  topic,
  priority: 0,
  timestamp: Date.now(),
  expiry: null,
  broadcast: false,
  attempt: 0,
  maxRetries: 0,
  retryStrategy: "constant",
  retryDelay: 1000,
  retryDelayMax: 30000,
  retryMultiplier: 2,
  retryJitter: false,
  replyTo: null,
  correlationId: null,
  identifierValue: null,
});

describe("dispatchToSubscribers", () => {
  let store: MemorySharedState;

  beforeEach(() => {
    store = createStore();
  });

  it("should dispatch to all broadcast subscribers (queue = null)", async () => {
    const calls: Array<string> = [];

    store.subscriptions.push(
      {
        topic: "t1",
        queue: null,
        callback: async () => {
          calls.push("a");
        },
        consumerTag: "a",
      },
      {
        topic: "t1",
        queue: null,
        callback: async () => {
          calls.push("b");
        },
        consumerTag: "b",
      },
    );

    await dispatchToSubscribers(store, makeEnvelope("t1"));

    expect(calls).toMatchSnapshot();
  });

  it("should not dispatch to subscribers on a different topic", async () => {
    const calls: Array<string> = [];

    store.subscriptions.push(
      {
        topic: "t1",
        queue: null,
        callback: async () => {
          calls.push("a");
        },
        consumerTag: "a",
      },
      {
        topic: "t2",
        queue: null,
        callback: async () => {
          calls.push("b");
        },
        consumerTag: "b",
      },
    );

    await dispatchToSubscribers(store, makeEnvelope("t1"));

    expect(calls).toMatchSnapshot();
  });

  it("should dispatch to only one subscriber per queue group", async () => {
    const calls: Array<string> = [];

    store.subscriptions.push(
      {
        topic: "t1",
        queue: "q1",
        callback: async () => {
          calls.push("a");
        },
        consumerTag: "a",
      },
      {
        topic: "t1",
        queue: "q1",
        callback: async () => {
          calls.push("b");
        },
        consumerTag: "b",
      },
    );

    await dispatchToSubscribers(store, makeEnvelope("t1"));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe("a");
  });

  it("should round-robin within queue groups across dispatches", async () => {
    const calls: Array<string> = [];

    store.subscriptions.push(
      {
        topic: "t1",
        queue: "q1",
        callback: async () => {
          calls.push("a");
        },
        consumerTag: "a",
      },
      {
        topic: "t1",
        queue: "q1",
        callback: async () => {
          calls.push("b");
        },
        consumerTag: "b",
      },
    );

    await dispatchToSubscribers(store, makeEnvelope("t1"));
    await dispatchToSubscribers(store, makeEnvelope("t1"));
    await dispatchToSubscribers(store, makeEnvelope("t1"));

    expect(calls).toMatchSnapshot();
  });

  it("should dispatch to broadcast and queue subscribers independently", async () => {
    const calls: Array<string> = [];

    store.subscriptions.push(
      {
        topic: "t1",
        queue: null,
        callback: async () => {
          calls.push("broadcast");
        },
        consumerTag: "bc",
      },
      {
        topic: "t1",
        queue: "q1",
        callback: async () => {
          calls.push("queue-a");
        },
        consumerTag: "a",
      },
      {
        topic: "t1",
        queue: "q1",
        callback: async () => {
          calls.push("queue-b");
        },
        consumerTag: "b",
      },
    );

    await dispatchToSubscribers(store, makeEnvelope("t1"));

    expect(calls).toMatchSnapshot();
  });
});
