// TCK: Delayed Broadcast Suite
//
// Proves a delayed @Broadcast message routes to the broadcast destination on
// every driver — a regression guard for the delay-replay callback that
// re-derived the destination WITHOUT the broadcast suffix (kafka/redis), so a
// delayed broadcast landed on the shared queue and reached only one consumer.
//
// Gated on `delay && broadcast` in the runner.

import type { TckDriverHandle } from "./types.js";
import type { TckMessages } from "./create-tck-messages.js";
import { wait, waitFor } from "./wait.js";
import { beforeEach, describe, expect, test } from "vitest";

export const delayBroadcastSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
) => {
  describe("delay + broadcast", () => {
    beforeEach(async () => {
      await getHandle().clear();
    });

    test("delayed @Broadcast reaches every broadcast subscriber", async () => {
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckBroadcastMessage);
      const r1: Array<any> = [];
      const r2: Array<any> = [];
      const r3: Array<any> = [];

      await wq.consume("TckBroadcastMessage", async (msg) => {
        r1.push(msg);
      });
      await wq.consume("TckBroadcastMessage", async (msg) => {
        r2.push(msg);
      });
      await wq.consume("TckBroadcastMessage", async (msg) => {
        r3.push(msg);
      });

      // Allow all broadcast consumers to fully initialize their fetch loops
      await wait(200);

      const msg = wq.create({ body: "delayed-broadcast" } as any);
      await wq.publish(msg, { delay: 200 });

      // Should not have arrived before the delay elapses
      await wait(50);
      expect(r1).toHaveLength(0);
      expect(r2).toHaveLength(0);
      expect(r3).toHaveLength(0);

      // After the delay, the delayed broadcast must reach ALL subscribers. A
      // broadcast that lost its suffix would land on the shared destination and
      // be consumed by at most one of them.
      await waitFor(
        () =>
          r1.some((m) => m.body === "delayed-broadcast") &&
          r2.some((m) => m.body === "delayed-broadcast") &&
          r3.some((m) => m.body === "delayed-broadcast"),
        timeoutMs,
      );

      expect(r1.filter((m) => m.body === "delayed-broadcast")).toHaveLength(1);
      expect(r2.filter((m) => m.body === "delayed-broadcast")).toHaveLength(1);
      expect(r3.filter((m) => m.body === "delayed-broadcast")).toHaveLength(1);
    });
  });
};
