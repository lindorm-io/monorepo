import type { IMessage } from "../interfaces/index.js";
import { Field } from "../decorators/Field.js";
import { Message } from "../decorators/Message.js";
import { MEMORY_CAPABILITIES } from "../internal/drivers/memory/memory-capabilities.js";
import { createMockIrisSource } from "./vitest.js";
import { describe, expect, it, vi } from "vitest";

@Message({ name: "MockSourceMessage" })
class MockSourceMessage implements IMessage {
  @Field("string") body!: string;
}

describe("createMockIrisSource", () => {
  it("should create a memory-backed source with default capabilities", async () => {
    const source = await createMockIrisSource();

    expect(source.driver).toBe("memory");
    expect(source.capabilities).toEqual(MEMORY_CAPABILITIES);
  });

  it("should deliver a real message through a bus off the source", async () => {
    const source = await createMockIrisSource({ messages: [MockSourceMessage] });
    const bus = source.messageBus(MockSourceMessage);
    const received: Array<string> = [];

    await bus.subscribe({
      topic: "MockSourceMessage",
      callback: async (message) => void received.push(message.body),
    });

    await bus.publish(bus.create({ body: "hello" }));

    expect(received).toEqual(["hello"]);
  });

  it("should share the store between a session and the source", async () => {
    const source = await createMockIrisSource({ messages: [MockSourceMessage] });
    const session = source.session();
    const received: Array<string> = [];

    await session.messageBus(MockSourceMessage).subscribe({
      topic: "MockSourceMessage",
      callback: async (message) => void received.push(message.body),
    });

    await source
      .messageBus(MockSourceMessage)
      .publish(source.messageBus(MockSourceMessage).create({ body: "cross" }));

    expect(received).toEqual(["cross"]);
  });

  it("should honour the capabilities override seam", async () => {
    const source = await createMockIrisSource({ capabilities: { priority: true } });

    expect(source.capabilities.priority).toBe(true);
    // Untouched capabilities keep their real memory defaults.
    expect(source.capabilities.streamReplay).toBe(false);
  });

  it("should expose spies and inert lifecycle methods", async () => {
    const source = await createMockIrisSource();

    expect(vi.isMockFunction(source.connect)).toBe(true);
    expect(vi.isMockFunction(source.disconnect)).toBe(true);
    expect(vi.isMockFunction(source.setup)).toBe(true);
    expect(vi.isMockFunction(source.messageBus)).toBe(true);
    expect(vi.isMockFunction(source.session)).toBe(true);

    // Lifecycle spies are inert — calling them does not tear down the live driver.
    await source.connect();
    await source.setup();
    expect(source.getConnectionState()).toBe("connected");
    expect(source.connect).toHaveBeenCalledTimes(1);
  });

  it("should resolve ping to true", async () => {
    const source = await createMockIrisSource();

    await expect(source.ping()).resolves.toBe(true);
  });
});
