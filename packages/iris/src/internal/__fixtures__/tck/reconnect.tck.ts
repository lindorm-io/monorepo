// TCK: Reconnect Suite
//
// Proves consumers survive a broker reconnect: after the transport drops and
// restores, a message published post-reconnect must still be consumed — exactly
// once (re-registration must be idempotent, not stack a second consumer).
//
// Gated at runtime on the driver exposing `forceReconnect()`; drivers that
// cannot deterministically force a reconnect skip the suite.

import type { TckDriverHandle } from "./types.js";
import type { TckMessages } from "./create-tck-messages.js";
import { waitFor } from "./wait.js";
import { beforeEach, describe, expect, test } from "vitest";

export const reconnectSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
) => {
  describe("reconnect", () => {
    beforeEach(async () => {
      await getHandle().clear();
    });

    test("worker consumer keeps consuming after a broker reconnect", async (ctx) => {
      const handle = getHandle();
      if (!handle.forceReconnect) {
        ctx.skip();
        return;
      }

      const wq = handle.workerQueue(messages.TckBasicMessage);
      const received: Array<string> = [];

      await wq.consume("reconnect-worker", async (msg) => {
        received.push((msg as any).body);
      });

      // Baseline: delivery works before the reconnect.
      await wq.publish(wq.create({ body: "before" } as any));
      await waitFor(() => received.includes("before"), timeoutMs);

      // Force a real broker reconnect — consumers must be re-established.
      await handle.forceReconnect();

      // Publish after the reconnect — must still be consumed.
      await wq.publish(wq.create({ body: "after" } as any));
      await waitFor(() => received.includes("after"), timeoutMs);

      // Re-registration is idempotent: "after" delivered exactly once, not
      // duplicated by a second consumer stacked on the same group+topic.
      expect(received.filter((body) => body === "after")).toHaveLength(1);
    });
  });
};
