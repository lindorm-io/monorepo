import type { MemorySharedState } from "../types/memory-store.js";

export const createStore = (): MemorySharedState => ({
  subscriptions: [],
  consumers: [],
  rpcHandlers: [],
  replyCallbacks: new Map(),
  pendingRejects: new Map(),
  roundRobinIndexes: new Map(),
  timers: new Set(),
  inFlightCount: 0,
  paused: false,
});
