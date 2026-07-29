import type { IMessage } from "../interfaces/index.js";
import { Field } from "../decorators/Field.js";
import { Message } from "../decorators/Message.js";
import { createMockIrisSource } from "./vitest.js";
import { createMockPublisher } from "./vitest.js";
import { describe, expect, it, vi } from "vitest";

@Message({ name: "MockPublisherMessage" })
class MockPublisherMessage implements IMessage {
  @Field("string") body!: string;
}

describe("createMockPublisher", () => {
  it("should really publish to a subscriber on the same source", async () => {
    // A lone publisher has no subscribers — pair it with a bus on one source to
    // prove the publish path delivers for real (shared in-memory store).
    const source = await createMockIrisSource({ messages: [MockPublisherMessage] });
    const bus = source.messageBus(MockPublisherMessage);
    const publisher = source.publisher(MockPublisherMessage);
    const received: Array<string> = [];

    await bus.subscribe({
      topic: "MockPublisherMessage",
      callback: async (message) => void received.push(message.body),
    });

    await publisher.publish(publisher.create({ body: "hello" }));

    expect(received).toEqual(["hello"]);
  });

  it("should expose every method as a spy and record publish calls", async () => {
    const publisher = await createMockPublisher(MockPublisherMessage);

    expect(vi.isMockFunction(publisher.create)).toBe(true);
    expect(vi.isMockFunction(publisher.hydrate)).toBe(true);
    expect(vi.isMockFunction(publisher.copy)).toBe(true);
    expect(vi.isMockFunction(publisher.validate)).toBe(true);
    expect(vi.isMockFunction(publisher.publish)).toBe(true);

    const message = publisher.create({ body: "hello" });
    await publisher.publish(message);
    expect(publisher.publish).toHaveBeenCalledWith(message);
  });

  it("should build real message instances via create/hydrate/copy", async () => {
    const publisher = await createMockPublisher(MockPublisherMessage);

    expect(publisher.create({ body: "made" })).toBeInstanceOf(MockPublisherMessage);
    expect(publisher.hydrate({ body: "hydrated" }).body).toBe("hydrated");

    const original = publisher.create({ body: "orig" });
    const copy = publisher.copy(original);
    expect(copy).not.toBe(original);
    expect(copy.body).toBe("orig");
  });

  it("should let a default be overridden", async () => {
    const publisher = await createMockPublisher(MockPublisherMessage);
    publisher.publish.mockRejectedValueOnce(new Error("boom"));

    await expect(publisher.publish(publisher.create({ body: "x" }))).rejects.toThrow(
      "boom",
    );
  });
});
