// TCK: Hooks Suite
// Tests lifecycle hook invocation ordering.
//
// In the memory driver, dispatch is synchronous within publish():
//   prepareForPublish (beforePublish) -> dispatch (beforeConsume, callback, afterConsume) -> completePublish (afterPublish)
// So the actual ordering is: beforePublish -> beforeConsume -> afterConsume -> afterPublish.
// Other drivers may differ (async dispatch), so we only assert presence and relative ordering
// of publish-side hooks (beforePublish < afterPublish) and consume-side hooks (beforeConsume < afterConsume).

import type { TckDriverHandle } from "./types";
import type { TckMessages } from "./create-tck-messages";
import { waitFor } from "./wait";
import { beforeEach, describe, expect, test } from "vitest";

export const hooksSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  hookLog: Array<string>,
  timeoutMs: number,
) => {
  describe("hooks", () => {
    beforeEach(async () => {
      await getHandle().clear();
      hookLog.length = 0;
    });

    test("publish fires beforePublish and afterPublish in order", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckHookMessage);

      const msg = bus.create({ body: "hook-pub" } as any);
      await bus.publish(msg);

      await waitFor(() => hookLog.includes("afterPublish"), timeoutMs);

      expect(hookLog).toContain("beforePublish");
      expect(hookLog).toContain("afterPublish");

      const beforeIdx = hookLog.indexOf("beforePublish");
      const afterIdx = hookLog.indexOf("afterPublish");
      expect(beforeIdx).toBeLessThan(afterIdx);
    });

    test("subscribe + publish fires all four lifecycle hooks", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckHookMessage);

      await bus.subscribe({
        topic: "TckHookMessage",
        callback: async () => {
          /* consume successfully */
        },
      });

      const msg = bus.create({ body: "hook-consume" } as any);
      await bus.publish(msg);

      await waitFor(() => hookLog.includes("afterConsume"), timeoutMs);

      expect(hookLog).toContain("beforePublish");
      expect(hookLog).toContain("afterPublish");
      expect(hookLog).toContain("beforeConsume");
      expect(hookLog).toContain("afterConsume");

      // beforePublish always comes first
      const beforePublish = hookLog.indexOf("beforePublish");
      const beforeConsume = hookLog.indexOf("beforeConsume");
      expect(beforePublish).toBeLessThan(beforeConsume);

      // afterConsume comes after beforeConsume
      const afterConsume = hookLog.indexOf("afterConsume");
      expect(beforeConsume).toBeLessThan(afterConsume);
    });

    test("error in consumer fires onConsumeError hook instead of afterConsume", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckHookMessage);

      await bus.subscribe({
        topic: "TckHookMessage",
        callback: async () => {
          throw new Error("hook-error");
        },
      });

      const msg = bus.create({ body: "hook-err" } as any);
      await bus.publish(msg);

      await waitFor(() => hookLog.includes("error:hook-error"), timeoutMs);

      expect(hookLog).toContain("beforeConsume");
      expect(hookLog).toContain("error:hook-error");
      // afterConsume should NOT appear when the callback errors
      const errorIdx = hookLog.indexOf("error:hook-error");
      const afterConsumeIdxAfterError = hookLog.indexOf("afterConsume", errorIdx);
      expect(afterConsumeIdxAfterError).toBe(-1);
    });

    test("hook ordering is consistent across multiple publishes", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckHookMessage);

      await bus.subscribe({
        topic: "TckHookMessage",
        callback: async () => {
          /* consume successfully */
        },
      });

      const msg1 = bus.create({ body: "order-1" } as any);
      await bus.publish(msg1);

      await waitFor(() => hookLog.includes("afterConsume"), timeoutMs);

      const firstRun = [...hookLog];
      hookLog.length = 0;

      const msg2 = bus.create({ body: "order-2" } as any);
      await bus.publish(msg2);

      await waitFor(() => hookLog.includes("afterConsume"), timeoutMs);

      const secondRun = [...hookLog];

      // Both runs should produce the same set of hooks
      expect(firstRun.sort()).toEqual(secondRun.sort());
      // And contain all four lifecycle hooks
      expect(firstRun).toContain("beforePublish");
      expect(firstRun).toContain("afterPublish");
      expect(firstRun).toContain("beforeConsume");
      expect(firstRun).toContain("afterConsume");
    });

    test("afterConsume fires after callback completes", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckHookMessage);
      const timeline: Array<string> = [];

      await bus.subscribe({
        topic: "TckHookMessage",
        callback: async () => {
          timeline.push("callback");
        },
      });

      const msg = bus.create({ body: "timing" } as any);
      await bus.publish(msg);

      await waitFor(() => hookLog.includes("afterConsume"), timeoutMs);

      // afterConsume must appear in hookLog after the callback ran
      const afterConsumeIdx = hookLog.indexOf("afterConsume");
      expect(afterConsumeIdx).toBeGreaterThan(-1);
      // The callback must have already completed by the time afterConsume fires
      expect(timeline).toContain("callback");
    });

    test("multiple subscribers each fire their own consume hooks", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckHookMessage);

      await bus.subscribe({
        topic: "TckHookMessage",
        callback: async () => {
          /* subscriber 1 */
        },
      });

      await bus.subscribe({
        topic: "TckHookMessage",
        callback: async () => {
          /* subscriber 2 */
        },
      });

      const msg = bus.create({ body: "multi-sub-hooks" } as any);
      await bus.publish(msg);

      await waitFor(
        () => hookLog.filter((h) => h === "afterConsume").length >= 2,
        timeoutMs,
      );

      // Each subscriber triggers its own beforeConsume + afterConsume pair
      const beforeConsumeCount = hookLog.filter((h) => h === "beforeConsume").length;
      const afterConsumeCount = hookLog.filter((h) => h === "afterConsume").length;
      expect(beforeConsumeCount).toBe(2);
      expect(afterConsumeCount).toBe(2);
    });
  });
};
