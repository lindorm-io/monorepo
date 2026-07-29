import type { IMessage } from "../interfaces/index.js";
import { Field } from "../decorators/Field.js";
import { Message } from "../decorators/Message.js";
import { createMockIrisSession } from "./vitest.js";
import { describe, expect, it, vi } from "vitest";

@Message({ name: "MockSessionMessage" })
class MockSessionMessage implements IMessage {
  @Field("string") body!: string;
}

describe("createMockIrisSession", () => {
  it("should be memory-backed", async () => {
    const session = await createMockIrisSession();

    expect(session.driver).toBe("memory");
    expect(vi.isMockFunction(session.ping)).toBe(true);
  });

  it("should deliver a real message through a bus off the session", async () => {
    const session = await createMockIrisSession({ messages: [MockSessionMessage] });
    const bus = session.messageBus(MockSessionMessage);
    const received: Array<string> = [];

    await bus.subscribe({
      topic: "MockSessionMessage",
      callback: async (message) => void received.push(message.body),
    });

    await bus.publish(bus.create({ body: "hello" }));

    expect(received).toEqual(["hello"]);
  });

  it("should expose the messaging surface as spies", async () => {
    const session = await createMockIrisSession();

    expect(vi.isMockFunction(session.messageBus)).toBe(true);
    expect(vi.isMockFunction(session.publisher)).toBe(true);
    expect(vi.isMockFunction(session.workerQueue)).toBe(true);
    expect(vi.isMockFunction(session.rpcClient)).toBe(true);
    expect(vi.isMockFunction(session.hasMessage)).toBe(true);
  });
});
