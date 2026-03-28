// TCK: Stream Suite
// Tests stream processor/pipeline: from, filter, map, to, start/stop.
// Uses REAL timers for cross-driver portability.

import type { TckDriverHandle } from "./types";
import type { TckMessages } from "./create-tck-messages";
import { wait, waitFor } from "./wait";

export const streamSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
) => {
  describe("stream", () => {
    beforeEach(async () => {
      await getHandle().clear();
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
      await wait(500);

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
      await wait(500);

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
      await wait(500);

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
      await wait(500);

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
      await wait(500);

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
      await wait(500);

      const inputBus = handle.messageBus(TckStreamInput);
      await inputBus.publish(inputBus.create({ value: "a", score: 1 } as any));
      await inputBus.publish(inputBus.create({ value: "b", score: 2 } as any));
      await inputBus.publish(inputBus.create({ value: "c", score: 3 } as any));

      await wait(500);

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
      await wait(500);

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
      await wait(500);

      const inputBus = handle.messageBus(TckStreamInput);
      await inputBus.publish(inputBus.create({ value: "ignored", score: 1 } as any));
      await inputBus.publish(inputBus.create({ value: "also-ignored", score: 2 } as any));

      await wait(500);

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
      await wait(500);

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
      await wait(500);

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
      await wait(500);

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
      await wait(500);
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
  });
};
