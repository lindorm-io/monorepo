import { createStore } from "./create-store";

describe("createStore", () => {
  it("should return a fresh store with empty collections", () => {
    const store = createStore();

    expect(store.subscriptions).toEqual([]);
    expect(store.consumers).toEqual([]);
    expect(store.rpcHandlers).toEqual([]);
    expect(store.replyCallbacks).toBeInstanceOf(Map);
    expect(store.replyCallbacks.size).toBe(0);
    expect(store.roundRobinIndexes).toBeInstanceOf(Map);
    expect(store.roundRobinIndexes.size).toBe(0);
  });

  it("should return independent instances", () => {
    const a = createStore();
    const b = createStore();

    a.subscriptions.push({
      topic: "t",
      queue: null,
      callback: async () => {},
      consumerTag: "x",
    });

    expect(b.subscriptions).toHaveLength(0);
  });
});
