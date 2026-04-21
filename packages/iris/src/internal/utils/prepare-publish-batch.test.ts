import type { IMessage } from "../../interfaces";
import type { MessageMetadata } from "../message/types/metadata";
import type { OutboundPayload } from "../message/utils/prepare-outbound";
import { preparePublishBatch, type PublishDriverLike } from "./prepare-publish-batch";
import { describe, expect, it, vi } from "vitest";

const makeMetadata = (
  name: string,
  overrides: Partial<MessageMetadata> = {},
): MessageMetadata =>
  ({
    message: { name },
    priority: 0,
    expiry: null,
    broadcast: false,
    retry: null,
    topic: null,
    fields: [],
    ...overrides,
  }) as unknown as MessageMetadata;

const makeMessage = (name: string): IMessage => ({ name }) as unknown as IMessage;

const makeDriver = (
  metadata: MessageMetadata,
): PublishDriverLike<IMessage> & {
  calls: { prepared: Array<IMessage>; completed: Array<IMessage> };
} => {
  const calls = { prepared: [] as Array<IMessage>, completed: [] as Array<IMessage> };
  return {
    metadata,
    calls,
    prepareForPublish: vi.fn(async (message: IMessage): Promise<OutboundPayload> => {
      calls.prepared.push(message);
      return { payload: Buffer.from("test"), headers: {} };
    }),
    completePublish: vi.fn(async (message: IMessage): Promise<void> => {
      calls.completed.push(message);
    }),
  };
};

describe("preparePublishBatch", () => {
  it("should prepare a single message", async () => {
    const metadata = makeMetadata("TestMessage");
    const driver = makeDriver(metadata);
    const msg = makeMessage("TestMessage");

    const result = await preparePublishBatch(msg, undefined, driver);

    expect(result).toHaveLength(1);
    expect(result[0].topic).toBe("TestMessage");
    expect(result[0].delayed).toBe(false);
    expect(result[0].delay).toBe(0);
    expect(result[0].envelope.topic).toBe("TestMessage");
    expect(driver.calls.prepared).toHaveLength(1);
  });

  it("should prepare an array of messages", async () => {
    const metadata = makeMetadata("TestMessage");
    const driver = makeDriver(metadata);
    const messages = [makeMessage("Test1"), makeMessage("Test2")];

    const result = await preparePublishBatch(messages, undefined, driver);

    expect(result).toHaveLength(2);
    expect(driver.calls.prepared).toHaveLength(2);
  });

  it("should mark as delayed when delay > 0", async () => {
    const metadata = makeMetadata("TestMessage");
    const driver = makeDriver(metadata);
    const msg = makeMessage("TestMessage");

    const result = await preparePublishBatch(msg, { delay: 5000 }, driver);

    expect(result[0].delayed).toBe(true);
    expect(result[0].delay).toBe(5000);
  });

  it("should set x-iris-priority header when priority is non-zero", async () => {
    const metadata = makeMetadata("TestMessage", { priority: 5 });
    const driver = makeDriver(metadata);
    const msg = makeMessage("TestMessage");

    const result = await preparePublishBatch(msg, undefined, driver);

    expect(result[0].outbound.headers["x-iris-priority"]).toBe("5");
  });

  it("should not set x-iris-priority header when priority is 0", async () => {
    const metadata = makeMetadata("TestMessage");
    const driver = makeDriver(metadata);
    const msg = makeMessage("TestMessage");

    const result = await preparePublishBatch(msg, undefined, driver);

    expect(result[0].outbound.headers["x-iris-priority"]).toBeUndefined();
  });

  it("should use publish options priority over metadata", async () => {
    const metadata = makeMetadata("TestMessage", { priority: 3 });
    const driver = makeDriver(metadata);
    const msg = makeMessage("TestMessage");

    const result = await preparePublishBatch(msg, { priority: 7 }, driver);

    expect(result[0].outbound.headers["x-iris-priority"]).toBe("7");
  });

  it("should use metadata delay when no publish options delay", async () => {
    const metadata = makeMetadata("TestMessage", { delay: 3000 });
    const driver = makeDriver(metadata);
    const msg = makeMessage("TestMessage");

    const result = await preparePublishBatch(msg, undefined, driver);

    expect(result[0].delayed).toBe(true);
    expect(result[0].delay).toBe(3000);
  });

  it("should use publish options expiry", async () => {
    const metadata = makeMetadata("TestMessage", { expiry: 30000 });
    const driver = makeDriver(metadata);
    const msg = makeMessage("TestMessage");

    const result = await preparePublishBatch(msg, { expiry: 5000 }, driver);

    expect(result[0].envelope.expiry).toBe(5000);
  });

  it("should include the original message in the result", async () => {
    const metadata = makeMetadata("TestMessage");
    const driver = makeDriver(metadata);
    const msg = makeMessage("TestMessage");

    const result = await preparePublishBatch(msg, undefined, driver);

    expect(result[0].message).toBe(msg);
  });
});
