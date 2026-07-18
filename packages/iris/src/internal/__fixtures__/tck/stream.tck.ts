// TCK: Stream Suite
// Tests stream processor/pipeline: from, filter, map, to, start/stop.
// Uses REAL timers for cross-driver portability.

import type { TckCapabilities, TckDriverHandle } from "./types.js";
import type { TckMessages } from "./create-tck-messages.js";
import { wait, waitFor } from "./wait.js";
import { beforeEach, describe, expect, test } from "vitest";

export const streamSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
  caps?: TckCapabilities,
) => {
  describe("stream", () => {
    beforeEach(async () => {
      await getHandle().clear();
    });

    // ─── Uniform stream contract (C3) ────────────────────────────────────────
    // The stream capability is one boolean but hides a uniform contract: NO
    // driver offers replay or durable offsets (all join an ephemeral group at
    // the live tail). Negative-assert the sub-capabilities so a driver cannot
    // silently start claiming a stream guarantee it does not provide.
    test("no driver claims stream replay or durable offsets (uniform ephemeral contract)", () => {
      expect(caps?.stream).toBe(true);
      expect(caps?.streamReplay).toBe(false);
      expect(caps?.streamDurableOffset).toBe(false);
    });

    test("from -> filter -> to: filters messages", async () => {
      const handle = getHandle();
      const { TckStreamInput, TckStreamOutput } = messages;

      const bus = handle.messageBus(TckStreamOutput);
      const outputReceived: Array<any> = [];

      await bus.subscribe({
        topic: "TckStreamOutput",
        callback: async (msg) => {
          outputReceived.push(msg);
        },
      });

      const pipeline = handle
        .stream()
        .from(TckStreamInput)
        .filter((msg: any) => msg.score > 50)
        .to(TckStreamOutput);

      await pipeline.start();
      await wait(200);

      // Publish input messages via messageBus for TckStreamInput
      const inputBus = handle.messageBus(TckStreamInput);

      await inputBus.publish(inputBus.create({ value: "low", score: 10 } as any));
      await inputBus.publish(inputBus.create({ value: "high", score: 80 } as any));
      await inputBus.publish(inputBus.create({ value: "mid", score: 50 } as any));

      await waitFor(() => outputReceived.some((m) => m.value === "high"), timeoutMs);

      // Only "high" should pass the filter (score > 50)
      const filtered = outputReceived.filter((m) => m.value === "high");
      expect(filtered).toHaveLength(1);

      await pipeline.stop();
    });

    test("from -> map -> to: transforms messages", async () => {
      const handle = getHandle();
      const { TckStreamInput, TckStreamOutput } = messages;

      const bus = handle.messageBus(TckStreamOutput);
      const outputReceived: Array<any> = [];

      await bus.subscribe({
        topic: "TckStreamOutput",
        callback: async (msg) => {
          outputReceived.push(msg);
        },
      });

      const pipeline = handle
        .stream()
        .from(TckStreamInput)
        .map((msg: any) => ({
          value: msg.value.toUpperCase(),
          score: msg.score * 2,
        }))
        .to(TckStreamOutput);

      await pipeline.start();
      await wait(200);

      const inputBus = handle.messageBus(TckStreamInput);
      await inputBus.publish(inputBus.create({ value: "hello", score: 5 } as any));

      await waitFor(() => outputReceived.some((m) => m.value === "HELLO"), timeoutMs);

      const mine = outputReceived.filter((m) => m.value === "HELLO");
      expect(mine).toHaveLength(1);
      expect(mine[0].score).toBe(10);

      await pipeline.stop();
    });

    test("pipeline start/stop lifecycle", async () => {
      const handle = getHandle();
      const { TckStreamInput, TckStreamOutput } = messages;

      const pipeline = handle.stream().from(TckStreamInput).to(TckStreamOutput);

      expect(pipeline.isRunning()).toBe(false);

      await pipeline.start();
      expect(pipeline.isRunning()).toBe(true);

      await pipeline.stop();
      expect(pipeline.isRunning()).toBe(false);
    });

    test("from -> flatMap -> to: one input produces multiple outputs", async () => {
      const handle = getHandle();
      const { TckStreamInput, TckStreamOutput } = messages;

      const bus = handle.messageBus(TckStreamOutput);
      const outputReceived: Array<any> = [];

      await bus.subscribe({
        topic: "TckStreamOutput",
        callback: async (msg) => {
          outputReceived.push(msg);
        },
      });

      const pipeline = handle
        .stream()
        .from(TckStreamInput)
        .flatMap((msg: any) => [
          { value: `${msg.value}-a`, score: msg.score },
          { value: `${msg.value}-b`, score: msg.score + 1 },
        ])
        .to(TckStreamOutput);

      await pipeline.start();
      await wait(200);

      const inputBus = handle.messageBus(TckStreamInput);
      await inputBus.publish(inputBus.create({ value: "item", score: 10 } as any));

      await waitFor(
        () =>
          outputReceived.some((m) => m.value === "item-a") &&
          outputReceived.some((m) => m.value === "item-b"),
        timeoutMs,
      );

      const a = outputReceived.find((m) => m.value === "item-a");
      const b = outputReceived.find((m) => m.value === "item-b");
      expect(a).toBeDefined();
      expect(a.score).toBe(10);
      expect(b).toBeDefined();
      expect(b.score).toBe(11);

      await pipeline.stop();
    });

    test("from -> batch -> map -> to: collects messages into batches", async () => {
      const handle = getHandle();
      const { TckStreamInput, TckStreamOutput } = messages;

      const bus = handle.messageBus(TckStreamOutput);
      const outputReceived: Array<any> = [];

      await bus.subscribe({
        topic: "TckStreamOutput",
        callback: async (msg) => {
          outputReceived.push(msg);
        },
      });

      const pipeline = handle
        .stream()
        .from(TckStreamInput)
        .batch(2)
        .map((batch: any) => ({
          value: batch.map((m: any) => m.value).join(","),
          score: batch.length,
        }))
        .to(TckStreamOutput);

      await pipeline.start();
      await wait(200);

      const inputBus = handle.messageBus(TckStreamInput);
      await inputBus.publish(inputBus.create({ value: "a", score: 1 } as any));

      await wait(200);

      await inputBus.publish(inputBus.create({ value: "b", score: 2 } as any));

      await waitFor(() => outputReceived.some((m) => m.value === "a,b"), timeoutMs);

      const mine = outputReceived.filter((m) => m.value === "a,b");
      expect(mine).toHaveLength(1);
      expect(mine[0].score).toBe(2);

      await pipeline.stop();
    });

    test("from -> batch with timeout -> map -> to: flushes partial batch on timeout", async () => {
      const handle = getHandle();
      const { TckStreamInput, TckStreamOutput } = messages;

      const bus = handle.messageBus(TckStreamOutput);
      const outputReceived: Array<any> = [];

      await bus.subscribe({
        topic: "TckStreamOutput",
        callback: async (msg) => {
          outputReceived.push(msg);
        },
      });

      const pipeline = handle
        .stream()
        .from(TckStreamInput)
        .batch(5, { timeout: 150 })
        .map((batch: any) => ({
          value: batch.map((m: any) => m.value).join(","),
          score: batch.length,
        }))
        .to(TckStreamOutput);

      await pipeline.start();
      await wait(200);

      const inputBus = handle.messageBus(TckStreamInput);
      // Publish only 2 messages — well under batch size of 5
      await inputBus.publish(inputBus.create({ value: "x", score: 1 } as any));
      await inputBus.publish(inputBus.create({ value: "y", score: 2 } as any));

      // Wait for timeout to fire and partial batch to flush
      await waitFor(() => outputReceived.some((m) => m.value === "x,y"), timeoutMs);

      const mine = outputReceived.filter((m) => m.value === "x,y");
      expect(mine).toHaveLength(1);
      expect(mine[0].score).toBe(2);

      await pipeline.stop();
    });

    test("from -> filter (all filtered out) -> to: produces no output", async () => {
      const handle = getHandle();
      const { TckStreamInput, TckStreamOutput } = messages;

      const bus = handle.messageBus(TckStreamOutput);
      const outputReceived: Array<any> = [];

      await bus.subscribe({
        topic: "TckStreamOutput",
        callback: async (msg) => {
          outputReceived.push(msg);
        },
      });

      const pipeline = handle
        .stream()
        .from(TckStreamInput)
        .filter(() => false)
        .to(TckStreamOutput);

      await pipeline.start();
      await wait(200);

      const inputBus = handle.messageBus(TckStreamInput);
      await inputBus.publish(inputBus.create({ value: "a", score: 1 } as any));
      await inputBus.publish(inputBus.create({ value: "b", score: 2 } as any));
      await inputBus.publish(inputBus.create({ value: "c", score: 3 } as any));

      await wait(200);

      // None of the input should produce output (all filtered)
      // (stale output from prior tests may exist, but no new "a"/"b"/"c" transformed values)
      expect(
        outputReceived.filter((m) => ["a", "b", "c"].includes(m.value)),
      ).toHaveLength(0);

      await pipeline.stop();
    });

    test("from -> map (changes body field) -> to: transforms message body", async () => {
      const handle = getHandle();
      const { TckStreamInput, TckStreamOutput } = messages;

      const bus = handle.messageBus(TckStreamOutput);
      const outputReceived: Array<any> = [];

      await bus.subscribe({
        topic: "TckStreamOutput",
        callback: async (msg) => {
          outputReceived.push(msg);
        },
      });

      const pipeline = handle
        .stream()
        .from(TckStreamInput)
        .map((msg: any) => ({
          value: `transformed-${msg.value}`,
          score: msg.score,
        }))
        .to(TckStreamOutput);

      await pipeline.start();
      await wait(200);

      const inputBus = handle.messageBus(TckStreamInput);
      await inputBus.publish(inputBus.create({ value: "original", score: 42 } as any));

      await waitFor(
        () => outputReceived.some((m) => m.value === "transformed-original"),
        timeoutMs,
      );

      const mine = outputReceived.filter((m) => m.value === "transformed-original");
      expect(mine).toHaveLength(1);
      expect(mine[0].score).toBe(42);

      await pipeline.stop();
    });

    test("from -> flatMap (returns empty array) -> to: produces no output", async () => {
      const handle = getHandle();
      const { TckStreamInput, TckStreamOutput } = messages;

      const bus = handle.messageBus(TckStreamOutput);
      const outputReceived: Array<any> = [];

      await bus.subscribe({
        topic: "TckStreamOutput",
        callback: async (msg) => {
          outputReceived.push(msg);
        },
      });

      const pipeline = handle
        .stream()
        .from(TckStreamInput)
        .flatMap(() => [])
        .to(TckStreamOutput);

      await pipeline.start();
      await wait(200);

      const inputBus = handle.messageBus(TckStreamInput);
      await inputBus.publish(inputBus.create({ value: "ignored", score: 1 } as any));
      await inputBus.publish(inputBus.create({ value: "also-ignored", score: 2 } as any));

      await wait(200);

      expect(
        outputReceived.filter((m) => m.value === "ignored" || m.value === "also-ignored"),
      ).toHaveLength(0);

      await pipeline.stop();
    });

    test("from -> batch(1) -> map -> to: behaves like map", async () => {
      const handle = getHandle();
      const { TckStreamInput, TckStreamOutput } = messages;

      const bus = handle.messageBus(TckStreamOutput);
      const outputReceived: Array<any> = [];

      await bus.subscribe({
        topic: "TckStreamOutput",
        callback: async (msg) => {
          outputReceived.push(msg);
        },
      });

      const pipeline = handle
        .stream()
        .from(TckStreamInput)
        .batch(1)
        .map((batch: any) => ({
          value: batch[0].value,
          score: batch[0].score,
        }))
        .to(TckStreamOutput);

      await pipeline.start();
      await wait(200);

      const inputBus = handle.messageBus(TckStreamInput);
      await inputBus.publish(inputBus.create({ value: "single-a", score: 10 } as any));
      await inputBus.publish(inputBus.create({ value: "single-b", score: 20 } as any));

      await waitFor(
        () =>
          outputReceived.some((m) => m.value === "single-a") &&
          outputReceived.some((m) => m.value === "single-b"),
        timeoutMs,
      );

      const a = outputReceived.find((m) => m.value === "single-a");
      const b = outputReceived.find((m) => m.value === "single-b");
      expect(a).toBeDefined();
      expect(a.score).toBe(10);
      expect(b).toBeDefined();
      expect(b.score).toBe(20);

      await pipeline.stop();
    });

    test("from -> filter -> map -> to: multiple stages chained", async () => {
      const handle = getHandle();
      const { TckStreamInput, TckStreamOutput } = messages;

      const bus = handle.messageBus(TckStreamOutput);
      const outputReceived: Array<any> = [];

      await bus.subscribe({
        topic: "TckStreamOutput",
        callback: async (msg) => {
          outputReceived.push(msg);
        },
      });

      const pipeline = handle
        .stream()
        .from(TckStreamInput)
        .filter((msg: any) => msg.score >= 50)
        .map((msg: any) => ({
          value: msg.value.toUpperCase(),
          score: msg.score + 100,
        }))
        .to(TckStreamOutput);

      await pipeline.start();
      await wait(200);

      const inputBus = handle.messageBus(TckStreamInput);
      await inputBus.publish(inputBus.create({ value: "low", score: 10 } as any));
      await inputBus.publish(inputBus.create({ value: "high", score: 75 } as any));
      await inputBus.publish(inputBus.create({ value: "exact", score: 50 } as any));

      await waitFor(
        () =>
          outputReceived.some((m) => m.value === "HIGH") &&
          outputReceived.some((m) => m.value === "EXACT"),
        timeoutMs,
      );

      // "low" filtered out, "high" and "exact" pass through filter and get mapped
      const high = outputReceived.find((m) => m.value === "HIGH");
      const exact = outputReceived.find((m) => m.value === "EXACT");
      expect(high).toBeDefined();
      expect(high.score).toBe(175);
      expect(exact).toBeDefined();
      expect(exact.score).toBe(150);

      await pipeline.stop();
    });

    test("pipeline start is idempotent (calling start twice does not error)", async () => {
      const handle = getHandle();
      const { TckStreamInput, TckStreamOutput } = messages;

      const pipeline = handle.stream().from(TckStreamInput).to(TckStreamOutput);

      await pipeline.start();
      await pipeline.start();

      expect(pipeline.isRunning()).toBe(true);

      await pipeline.stop();
    });

    test("pipeline pause/resume stops and restarts processing", async () => {
      const handle = getHandle();
      const { TckStreamInput, TckStreamOutput } = messages;

      const bus = handle.messageBus(TckStreamOutput);
      const outputReceived: Array<any> = [];

      await bus.subscribe({
        topic: "TckStreamOutput",
        callback: async (msg) => {
          outputReceived.push(msg);
        },
      });

      const pipeline = handle.stream().from(TckStreamInput).to(TckStreamOutput);

      await pipeline.start();
      await wait(200);

      const inputBus = handle.messageBus(TckStreamInput);
      await inputBus.publish(inputBus.create({ value: "before-pause", score: 1 } as any));

      await waitFor(
        () => outputReceived.some((m) => m.value === "before-pause"),
        timeoutMs,
      );
      expect(outputReceived.filter((m) => m.value === "before-pause")).toHaveLength(1);

      await pipeline.pause();
      expect(pipeline.isRunning()).toBe(false);

      await inputBus.publish(inputBus.create({ value: "during-pause", score: 2 } as any));
      await wait(200);
      // Message published during pause should not be processed
      expect(outputReceived.filter((m) => m.value === "during-pause")).toHaveLength(0);

      await pipeline.resume();
      expect(pipeline.isRunning()).toBe(true);

      await inputBus.publish(inputBus.create({ value: "after-resume", score: 3 } as any));

      await waitFor(
        () => outputReceived.some((m) => m.value === "after-resume"),
        timeoutMs,
      );
      expect(outputReceived.filter((m) => m.value === "after-resume")).toHaveLength(1);

      await pipeline.stop();
    });

    test("pause flushes a partial (under-size) batch — identical across drivers (M8)", async () => {
      const handle = getHandle();
      const { TckStreamInput, TckStreamOutput } = messages;

      const bus = handle.messageBus(TckStreamOutput);
      const outputReceived: Array<any> = [];

      await bus.subscribe({
        topic: "TckStreamOutput",
        callback: async (msg) => {
          outputReceived.push(msg);
        },
      });

      // A map BEFORE the batch records receipt so the test can deterministically
      // wait until both messages are buffered (not a timing guess) before pausing.
      const consumed: Array<string> = [];
      const pipeline = handle
        .stream()
        .from(TckStreamInput)
        .map((msg: any) => {
          consumed.push(msg.value);
          return msg;
        })
        .batch(5)
        .map((batch: any) => ({
          value: batch
            .map((m: any) => m.value)
            .sort()
            .join(","),
          score: batch.length,
        }))
        .to(TckStreamOutput);

      await pipeline.start();
      await wait(200);

      const inputBus = handle.messageBus(TckStreamInput);
      await inputBus.publish(inputBus.create({ value: "m8-a", score: 1 } as any));
      await inputBus.publish(inputBus.create({ value: "m8-b", score: 2 } as any));

      // Both consumed => both sit in the under-size (5) batch buffer. No batch
      // timeout is configured, so nothing flushes on its own.
      await waitFor(
        () => consumed.includes("m8-a") && consumed.includes("m8-b"),
        timeoutMs,
      );
      expect(outputReceived.filter((m) => m.score === 2)).toHaveLength(0);

      // Pausing must flush the partial batch — a paused pipeline should never
      // strand buffered messages. kafka/nats/redis already flushed on pause;
      // rabbit/memory did not (and rabbit leaked its batch timer). Now identical.
      await pipeline.pause();

      await waitFor(() => outputReceived.some((m) => m.score === 2), timeoutMs);
      const flushed = outputReceived.filter((m) => m.score === 2);
      expect(flushed).toHaveLength(1);
      expect(flushed[0].value).toBe("m8-a,m8-b");

      await pipeline.stop();
    });

    test("resume then immediately publish: message is consumed, not dropped in the join window (M7)", async () => {
      const handle = getHandle();
      const { TckStreamInput, TckStreamOutput } = messages;

      const bus = handle.messageBus(TckStreamOutput);
      const outputReceived: Array<any> = [];

      await bus.subscribe({
        topic: "TckStreamOutput",
        callback: async (msg) => {
          outputReceived.push(msg);
        },
      });

      const pipeline = handle.stream().from(TckStreamInput).to(TckStreamOutput);

      await pipeline.start();
      await wait(200);

      await pipeline.pause();
      await pipeline.resume();

      // Publish with NO settling delay after resume() resolves. resume() must
      // only return once the (new) consumer is genuinely joined and fetching —
      // Kafka previously slept a hardcoded 200ms and dropped anything published
      // inside the join window (M7). A message published right now must arrive.
      const inputBus = handle.messageBus(TckStreamInput);
      await inputBus.publish(inputBus.create({ value: "m7-immediate", score: 1 } as any));

      await waitFor(
        () => outputReceived.some((m) => m.value === "m7-immediate"),
        timeoutMs,
      );
      expect(outputReceived.filter((m) => m.value === "m7-immediate")).toHaveLength(1);

      await pipeline.stop();
    });

    // ─── Error contract (H5) ─────────────────────────────────────────────────
    // A stage/handler failure must NOT silently drop the message (the old base
    // swallowed-and-logged, giving at-most-once). It must redeliver — bounded by
    // the input's @Retry — and dead-letter on exhaustion, matching the
    // worker-queue at-least-once contract.

    test("processing error: a throwing stage redelivers then dead-letters (not silently lost)", async () => {
      if (!caps?.retry || !caps?.deadLetter) return;

      const handle = getHandle();
      const { TckStreamRetryInput, TckStreamOutput } = messages;

      const outputBus = handle.messageBus(TckStreamOutput);
      const outputReceived: Array<any> = [];
      await outputBus.subscribe({
        topic: "TckStreamOutput",
        callback: async (msg) => {
          outputReceived.push(msg);
        },
      });

      let attempts = 0;
      const pipeline = handle
        .stream()
        .from(TckStreamRetryInput)
        .map((_msg: any) => {
          attempts++;
          throw new Error("stage-boom");
        })
        .to(TckStreamOutput);

      await pipeline.start();
      await wait(200);

      const inputBus = handle.messageBus(TckStreamRetryInput);
      await inputBus.publish(inputBus.create({ value: "x", score: 1 } as any));

      await waitFor(
        async () => (await handle.getDeadLetters("TckStreamRetryInput")).length >= 1,
        timeoutMs,
      );

      const deadLetters = await handle.getDeadLetters("TckStreamRetryInput");
      expect(deadLetters.length).toBeGreaterThanOrEqual(1);
      expect(deadLetters[0].error).toBe("stage-boom");

      // Redelivered (bounded by @Retry maxRetries:2) before dead-lettering —
      // proof the message was retried, not dropped on the first failure.
      expect(attempts).toBeGreaterThan(1);

      // The failed message must never have produced output.
      expect(outputReceived).toHaveLength(0);

      await pipeline.stop();
    });

    // A PARSE error (payload that cannot be deserialized) is a poison pill:
    // retrying is futile, so it must go straight to the dead letter — never loop
    // forever, never silently drop. Injected by consuming a plain payload with an
    // @Encrypted input class (the payload is not encrypted, so deserialization
    // throws before any transform runs).
    test("poison pill: an undeserializable payload dead-letters once (not looped, not dropped)", async () => {
      if (!caps?.deadLetter) return;

      const handle = getHandle();
      const { TckStreamPoisonInput, TckStreamPoisonFeed, TckStreamOutput } = messages;

      const outputBus = handle.messageBus(TckStreamOutput);
      const outputReceived: Array<any> = [];
      await outputBus.subscribe({
        topic: "TckStreamOutput",
        callback: async (msg) => {
          outputReceived.push(msg);
        },
      });

      const pipeline = handle
        .stream()
        .from(TckStreamPoisonInput, { topic: "TckStreamPoisonFeed" })
        .to(TckStreamOutput);

      await pipeline.start();
      await wait(200);

      const feedBus = handle.messageBus(TckStreamPoisonFeed);
      await feedBus.publish(feedBus.create({ value: "poison", score: 1 } as any));

      await waitFor(
        async () => (await handle.getDeadLetters("TckStreamPoisonFeed")).length >= 1,
        timeoutMs,
      );

      const deadLetters = await handle.getDeadLetters("TckStreamPoisonFeed");
      expect(deadLetters.length).toBeGreaterThanOrEqual(1);

      // Not silently dropped and no output produced from a poison payload.
      expect(outputReceived).toHaveLength(0);

      // A poison pill dead-letters ONCE — give any (incorrect) redelivery loop a
      // window to pile up more entries; the count must stay stable.
      const countAfterFirst = deadLetters.length;
      await wait(300);
      const deadLettersLater = await handle.getDeadLetters("TckStreamPoisonFeed");
      expect(deadLettersLater.length).toBe(countAfterFirst);

      await pipeline.stop();
    });
  });
};
