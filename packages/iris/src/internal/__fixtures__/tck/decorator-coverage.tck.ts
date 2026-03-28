// TCK: Decorator Coverage Suite
// Tests @Transform, @OnCreate, @OnHydrate, @OnValidate, @Schema,
// @MandatoryField, @PersistentField, and @CorrelationField decorators.

import type { TckDriverHandle } from "./types";
import type { TckMessages } from "./create-tck-messages";
import { waitFor } from "./wait";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const decoratorCoverageSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  hookLog: Array<string>,
  timeoutMs: number,
) => {
  describe("decorator-coverage", () => {
    beforeEach(async () => {
      await getHandle().clear();
      hookLog.length = 0;
    });

    // ─── @Transform ────────────────────────────────────────────────────────────

    describe("@Transform", () => {
      test("applies to/from transforms through publish/subscribe roundtrip", async () => {
        const handle = getHandle();
        const bus = handle.messageBus(messages.TckTransformMessage);
        const received: Array<any> = [];

        await bus.subscribe({
          topic: "TckTransformMessage",
          callback: async (msg) => {
            received.push(msg);
          },
        });

        const msg = bus.create({ label: "Mixed", body: "hello" } as any);
        await bus.publish(msg);

        await waitFor(() => received.length >= 1, timeoutMs);

        expect(received).toHaveLength(1);
        // .from transform lowercases, so even though .to uppercased for wire,
        // the consumer side should receive the lowercased form
        expect(received[0].label).toBe("mixed");
        expect(received[0].body).toBe("hello");
      });
    });

    // ─── @OnCreate ─────────────────────────────────────────────────────────────

    describe("@OnCreate", () => {
      test("fires during bus.create() and mutates the message", () => {
        const handle = getHandle();
        const bus = handle.messageBus(messages.TckLifecycleMessage);

        const msg = bus.create({ body: "test" } as any);

        expect(hookLog).toContain("onCreate");
        expect(msg.touched).toBe(true);
      });
    });

    // ─── @OnHydrate ────────────────────────────────────────────────────────────

    describe("@OnHydrate", () => {
      test("fires when consumer hydrates a received message", async () => {
        const handle = getHandle();
        const bus = handle.messageBus(messages.TckLifecycleMessage);
        const received: Array<any> = [];

        await bus.subscribe({
          topic: "TckLifecycleMessage",
          callback: async (msg) => {
            received.push(msg);
          },
        });

        const msg = bus.create({ body: "hydrate-test" } as any);
        hookLog.length = 0; // clear create-side hooks

        await bus.publish(msg);

        await waitFor(() => received.length >= 1, timeoutMs);

        expect(received).toHaveLength(1);
        expect(hookLog).toContain("onHydrate");
        expect(received[0].hydrated).toBe(true);
      });
    });

    // ─── @OnValidate ───────────────────────────────────────────────────────────

    describe("@OnValidate", () => {
      test("fires during bus.validate()", () => {
        const handle = getHandle();
        const bus = handle.messageBus(messages.TckLifecycleMessage);

        const msg = bus.create({ body: "validate-test" } as any);
        hookLog.length = 0;

        bus.validate(msg);

        expect(hookLog).toContain("onValidate");
      });
    });

    // ─── @Schema ───────────────────────────────────────────────────────────────

    describe("@Schema", () => {
      test("rejects message that violates the schema", () => {
        const handle = getHandle();
        const bus = handle.messageBus(messages.TckLifecycleMessage);

        const msg = bus.create({ body: "valid" } as any);
        // Manually set body to empty string to violate z.string().min(1)
        (msg as any).body = "";

        expect(() => bus.validate(msg)).toThrow();
      });

      test("accepts message that satisfies the schema", () => {
        const handle = getHandle();
        const bus = handle.messageBus(messages.TckLifecycleMessage);

        const msg = bus.create({ body: "valid" } as any);

        expect(() => bus.validate(msg)).not.toThrow();
      });
    });

    // ─── @MandatoryField / @PersistentField ────────────────────────────────────

    describe("@MandatoryField and @PersistentField", () => {
      test("fields survive publish/subscribe roundtrip", async () => {
        const handle = getHandle();
        const bus = handle.messageBus(messages.TckMandatoryPersistentMessage);
        const received: Array<any> = [];

        await bus.subscribe({
          topic: "TckMandatoryPersistentMessage",
          callback: async (msg) => {
            received.push(msg);
          },
        });

        const msg = bus.create({
          body: "test",
          mandatory: true,
          persistent: true,
        } as any);

        await bus.publish(msg);

        await waitFor(() => received.length >= 1, timeoutMs);

        expect(received).toHaveLength(1);
        expect(received[0].mandatory).toBe(true);
        expect(received[0].persistent).toBe(true);
        expect(received[0].body).toBe("test");
      });

      test("default to false when not provided", () => {
        const handle = getHandle();
        const bus = handle.messageBus(messages.TckMandatoryPersistentMessage);

        const msg = bus.create({ body: "defaults" } as any);

        expect(msg.mandatory).toBe(false);
        expect(msg.persistent).toBe(false);
      });
    });

    // ─── @CorrelationField ─────────────────────────────────────────────────────

    describe("@CorrelationField", () => {
      test("auto-generates a UUID correlation ID on create", () => {
        const handle = getHandle();
        const bus = handle.messageBus(messages.TckCorrelationMessage);

        const msg = bus.create({ body: "corr-test" } as any);

        expect(msg.correlationId).toMatch(UUID_RE);
      });

      test("preserves provided correlation ID", () => {
        const handle = getHandle();
        const bus = handle.messageBus(messages.TckCorrelationMessage);

        const fixedId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
        const msg = bus.create({ body: "corr-test", correlationId: fixedId } as any);

        expect(msg.correlationId).toBe(fixedId);
      });

      test("correlation ID survives publish/subscribe roundtrip", async () => {
        const handle = getHandle();
        const bus = handle.messageBus(messages.TckCorrelationMessage);
        const received: Array<any> = [];

        await bus.subscribe({
          topic: "TckCorrelationMessage",
          callback: async (msg) => {
            received.push(msg);
          },
        });

        const msg = bus.create({ body: "corr-roundtrip" } as any);
        const originalId = msg.correlationId;

        await bus.publish(msg);

        await waitFor(() => received.length >= 1, timeoutMs);

        expect(received).toHaveLength(1);
        expect(received[0].correlationId).toBe(originalId);
      });
    });
  });
};
