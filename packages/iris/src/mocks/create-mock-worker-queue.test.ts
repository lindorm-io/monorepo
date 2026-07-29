import type { IMessage } from "../interfaces/index.js";
import { Field } from "../decorators/Field.js";
import { Message } from "../decorators/Message.js";
import { createMockWorkerQueue } from "./vitest.js";
import { describe, expect, it, vi } from "vitest";

@Message({ name: "MockWorkerMessage" })
class MockWorkerMessage implements IMessage {
  @Field("string") data!: string;
}

describe("createMockWorkerQueue", () => {
  it("should deliver a published message to a real consumer", async () => {
    const queue = await createMockWorkerQueue(MockWorkerMessage);
    const received: Array<string> = [];

    await queue.consume("MockWorkerMessage", async (message) => {
      received.push(message.data);
    });

    await queue.publish(queue.create({ data: "task" }));

    expect(received).toEqual(["task"]);
  });

  it("should round-robin across consumers in the same queue", async () => {
    const queue = await createMockWorkerQueue(MockWorkerMessage);
    const a: Array<string> = [];
    const b: Array<string> = [];

    await queue.consume({
      queue: "MockWorkerMessage",
      callback: async () => void a.push("a"),
    });
    await queue.consume({
      queue: "MockWorkerMessage",
      callback: async () => void b.push("b"),
    });

    for (let i = 0; i < 4; i++) {
      await queue.publish(queue.create({ data: `msg${i}` }));
    }

    expect(a).toHaveLength(2);
    expect(b).toHaveLength(2);
  });

  it("should stop delivering after unconsumeAll", async () => {
    const queue = await createMockWorkerQueue(MockWorkerMessage);
    const received: Array<string> = [];

    await queue.consume(
      "MockWorkerMessage",
      async (message) => void received.push(message.data),
    );
    await queue.unconsumeAll();
    await queue.publish(queue.create({ data: "task" }));

    expect(received).toHaveLength(0);
  });

  it("should expose every method as a spy and record publish calls", async () => {
    const queue = await createMockWorkerQueue(MockWorkerMessage);

    expect(vi.isMockFunction(queue.publish)).toBe(true);
    expect(vi.isMockFunction(queue.consume)).toBe(true);
    expect(vi.isMockFunction(queue.unconsume)).toBe(true);
    expect(vi.isMockFunction(queue.unconsumeAll)).toBe(true);

    const message = queue.create({ data: "task" });
    await queue.publish(message);
    expect(queue.publish).toHaveBeenCalledWith(message);
  });
});
