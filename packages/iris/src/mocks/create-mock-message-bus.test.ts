import type { IMessage } from "../interfaces/index.js";
import { Field } from "../decorators/Field.js";
import { Message } from "../decorators/Message.js";
import { createMockMessageBus } from "./vitest.js";
import { describe, expect, it, vi } from "vitest";

@Message({ name: "MockBusMessage" })
class MockBusMessage implements IMessage {
  @Field("string") body!: string;
}

describe("createMockMessageBus", () => {
  it("should deliver a published message to a real subscriber", async () => {
    const bus = await createMockMessageBus(MockBusMessage);
    const received: Array<MockBusMessage> = [];

    await bus.subscribe({
      topic: "MockBusMessage",
      callback: async (message) => {
        received.push(message);
      },
    });

    const message = bus.create({ body: "hello" });
    await bus.publish(message);

    // Memory delivery is awaited inline, so it is complete synchronously here.
    expect(received).toHaveLength(1);
    expect(received[0].body).toBe("hello");
  });

  it("should fan out to multiple subscribers on the same topic", async () => {
    const bus = await createMockMessageBus(MockBusMessage);
    const a: Array<string> = [];
    const b: Array<string> = [];

    await bus.subscribe({
      topic: "MockBusMessage",
      callback: async () => void a.push("a"),
    });
    await bus.subscribe({
      topic: "MockBusMessage",
      callback: async () => void b.push("b"),
    });

    await bus.publish(bus.create({ body: "test" }));

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it("should not deliver after unsubscribe", async () => {
    const bus = await createMockMessageBus(MockBusMessage);
    const received: Array<MockBusMessage> = [];

    await bus.subscribe({
      topic: "MockBusMessage",
      callback: async (message) => void received.push(message),
    });
    await bus.unsubscribe({ topic: "MockBusMessage" });
    await bus.publish(bus.create({ body: "test" }));

    expect(received).toHaveLength(0);
  });

  it("should expose every method as a spy", async () => {
    const bus = await createMockMessageBus(MockBusMessage);

    expect(vi.isMockFunction(bus.create)).toBe(true);
    expect(vi.isMockFunction(bus.hydrate)).toBe(true);
    expect(vi.isMockFunction(bus.copy)).toBe(true);
    expect(vi.isMockFunction(bus.validate)).toBe(true);
    expect(vi.isMockFunction(bus.publish)).toBe(true);
    expect(vi.isMockFunction(bus.subscribe)).toBe(true);
    expect(vi.isMockFunction(bus.unsubscribe)).toBe(true);
    expect(vi.isMockFunction(bus.unsubscribeAll)).toBe(true);
  });

  it("should record publish calls on the spy", async () => {
    const bus = await createMockMessageBus(MockBusMessage);
    const message = bus.create({ body: "hello" });

    await bus.publish(message);

    expect(bus.publish).toHaveBeenCalledTimes(1);
    expect(bus.publish).toHaveBeenCalledWith(message);
  });

  it("should build real message instances via create/hydrate/copy", async () => {
    const bus = await createMockMessageBus(MockBusMessage);

    expect(bus.create({ body: "made" })).toBeInstanceOf(MockBusMessage);
    expect(bus.create({ body: "made" }).body).toBe("made");
    expect(bus.hydrate({ body: "hydrated" }).body).toBe("hydrated");

    const original = bus.create({ body: "orig" });
    const copy = bus.copy(original);
    expect(copy).not.toBe(original);
    expect(copy.body).toBe("orig");
    expect(() => bus.validate(original)).not.toThrow();
  });

  it("should let a default be overridden", async () => {
    const bus = await createMockMessageBus(MockBusMessage);
    bus.publish.mockRejectedValueOnce(new Error("boom"));

    await expect(bus.publish(bus.create({ body: "x" }))).rejects.toThrow("boom");
  });
});
