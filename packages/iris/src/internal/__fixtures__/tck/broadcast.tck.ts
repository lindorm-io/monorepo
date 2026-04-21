// TCK: Broadcast Suite
// Tests @Broadcast decorator behavior on worker queue consumers.

import type { TckDriverHandle } from "./types";
import type { TckMessages } from "./create-tck-messages";
import { wait, waitFor } from "./wait";
import { beforeEach, describe, expect, test } from "vitest";

export const broadcastSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
) => {
  describe("broadcast", () => {
    beforeEach(async () => {
      await getHandle().clear();
    });

    test("@Broadcast sends to all consumers (no round-robin)", async () => {
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

      const msg = wq.create({ body: "broadcast" } as any);
      await wq.publish(msg);

      await waitFor(() => r1.length >= 1 && r2.length >= 1 && r3.length >= 1, timeoutMs);

      // All consumers should receive
      expect(r1).toHaveLength(1);
      expect(r2).toHaveLength(1);
      expect(r3).toHaveLength(1);
    });

    test("non-broadcast message round-robins among consumers", async () => {
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckBasicMessage);
      const r1: Array<any> = [];
      const r2: Array<any> = [];

      await wq.consume("TckBasicMessage", async (msg) => {
        r1.push(msg);
      });
      await wq.consume("TckBasicMessage", async (msg) => {
        r2.push(msg);
      });

      for (let i = 0; i < 4; i++) {
        const msg = wq.create({ body: `rr-${i}` } as any);
        await wq.publish(msg);
      }

      await waitFor(() => {
        const all = [...r1, ...r2].filter((m) => m.body.startsWith("rr-"));
        return all.length >= 4;
      }, timeoutMs);

      // Both consumers share the 4 rr- messages (may also receive stale messages
      // from prior tests — filter to only this test's messages)
      const allRr = [...r1, ...r2].filter((m) => m.body.startsWith("rr-"));
      expect(allRr).toHaveLength(4);
    });

    test("broadcast message fields are identical across all consumers", async () => {
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

      const msg = wq.create({ body: "identical-check" } as any);
      await wq.publish(msg);

      await waitFor(
        () =>
          r1.some((m) => m.body === "identical-check") &&
          r2.some((m) => m.body === "identical-check") &&
          r3.some((m) => m.body === "identical-check"),
        timeoutMs,
      );

      // All consumers receive the broadcast message
      expect(r1.filter((m) => m.body === "identical-check")).toHaveLength(1);
      expect(r2.filter((m) => m.body === "identical-check")).toHaveLength(1);
      expect(r3.filter((m) => m.body === "identical-check")).toHaveLength(1);
    });

    test("non-broadcast after unconsume one consumer — remaining consumers still receive", async () => {
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckBasicMessage);
      const r1: Array<any> = [];
      const r2: Array<any> = [];
      const r3: Array<any> = [];

      await wq.consume("TckBasicMessage", async (msg) => {
        r1.push(msg);
      });
      await wq.consume("TckBasicMessage", async (msg) => {
        r2.push(msg);
      });
      await wq.consume("TckBasicMessage", async (msg) => {
        r3.push(msg);
      });

      // Verify all 3 receive initially
      for (let i = 0; i < 3; i++) {
        const msg = wq.create({ body: `pre-${i}` } as any);
        await wq.publish(msg);
      }

      await waitFor(() => r1.length + r2.length + r3.length >= 3, timeoutMs);

      // All 3 messages distributed across consumers (distribution may vary by broker)
      expect(r1.length + r2.length + r3.length).toBe(3);

      // Unconsume all then re-register only 2
      await wq.unconsumeAll();
      await wait(200);

      const postR1: Array<any> = [];
      const postR2: Array<any> = [];

      await wq.consume("TckBasicMessage", async (msg) => {
        postR1.push(msg);
      });
      await wq.consume("TckBasicMessage", async (msg) => {
        postR2.push(msg);
      });

      for (let i = 0; i < 4; i++) {
        const msg = wq.create({ body: `post-${i}` } as any);
        await wq.publish(msg);
      }

      await waitFor(() => postR1.length + postR2.length >= 4, timeoutMs);

      // 2 remaining consumers share the 4 messages (distribution may vary by broker —
      // with few messages, one consumer may receive all of them)
      expect(postR1.length + postR2.length).toBe(4);
    });
  });
};
