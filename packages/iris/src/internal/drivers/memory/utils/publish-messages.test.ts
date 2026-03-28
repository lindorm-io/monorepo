import type { IMessage } from "../../../../interfaces";
import type { MessageMetadata } from "../../../message/types/metadata";
import type { OutboundPayload } from "../../../message/utils/prepare-outbound";
import type { DelayManager } from "../../../delay/DelayManager";
import type { MemorySharedState } from "../types/memory-store";
import { createStore } from "./create-store";
import { publishMessages, type PublishDriver } from "./publish-messages";

const makeMetadata = (name: string): MessageMetadata =>
  ({
    message: { name },
    priority: 0,
    expiry: null,
    broadcast: false,
    retry: null,
    topic: null,
    fields: [],
  }) as unknown as MessageMetadata;

const makeMessage = (name: string): IMessage => ({ name }) as unknown as IMessage;

const makeDriver = (
  metadata: MessageMetadata,
): PublishDriver<IMessage> & {
  calls: { prepared: Array<IMessage>; completed: Array<IMessage> };
} => {
  const calls = { prepared: [] as Array<IMessage>, completed: [] as Array<IMessage> };
  return {
    metadata,
    calls,
    prepareForPublish: jest.fn(async (message: IMessage): Promise<OutboundPayload> => {
      calls.prepared.push(message);
      return { payload: Buffer.from("test"), headers: {} };
    }),
    completePublish: jest.fn(async (message: IMessage): Promise<void> => {
      calls.completed.push(message);
    }),
  };
};

const createMockDelayManager = (): DelayManager & { scheduledCalls: Array<any> } => {
  const scheduledCalls: Array<any> = [];
  return {
    scheduledCalls,
    schedule: jest.fn(async (envelope: any, topic: string, delayMs: number) => {
      scheduledCalls.push({ envelope, topic, delayMs });
      return "delay-id";
    }),
    cancel: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    size: jest.fn(),
    close: jest.fn(),
  } as any;
};

describe("publishMessages", () => {
  let store: MemorySharedState;
  let metadata: MessageMetadata;

  beforeEach(() => {
    store = createStore();
    metadata = makeMetadata("TestMessage");
  });

  it("should publish a single message", async () => {
    const dispatched: Array<string> = [];
    store.consumers.push({
      topic: "TestMessage",
      callback: async () => {
        dispatched.push("consumed");
      },
      consumerTag: "c1",
    });

    const driver = makeDriver(metadata);
    const msg = makeMessage("TestMessage");

    await publishMessages(msg, undefined, driver, store);

    expect(driver.calls.prepared).toHaveLength(1);
    expect(driver.calls.completed).toHaveLength(1);
    expect(dispatched).toMatchSnapshot();
  });

  it("should publish an array of messages", async () => {
    const dispatched: Array<string> = [];
    store.consumers.push({
      topic: "TestMessage",
      callback: async () => {
        dispatched.push("consumed");
      },
      consumerTag: "c1",
    });

    const driver = makeDriver(metadata);
    const messages = [makeMessage("TestMessage"), makeMessage("TestMessage")];

    await publishMessages(messages, undefined, driver, store);

    expect(driver.calls.prepared).toHaveLength(2);
    expect(driver.calls.completed).toHaveLength(2);
    expect(dispatched).toMatchSnapshot();
  });

  it("should schedule delayed publish via delayManager", async () => {
    const dispatched: Array<string> = [];
    store.consumers.push({
      topic: "TestMessage",
      callback: async () => {
        dispatched.push("consumed");
      },
      consumerTag: "c1",
    });

    const delayManager = createMockDelayManager();
    const driver = makeDriver(metadata);
    const msg = makeMessage("TestMessage");

    await publishMessages(msg, { delay: 5000 }, driver, store, { delayManager });

    expect(dispatched).toHaveLength(0);
    expect(delayManager.schedule).toHaveBeenCalledTimes(1);
    expect(delayManager.scheduledCalls[0].delayMs).toBe(5000);
  });

  it("should dispatch immediately when delay > 0 but no delayManager", async () => {
    const dispatched: Array<string> = [];
    store.consumers.push({
      topic: "TestMessage",
      callback: async () => {
        dispatched.push("consumed");
      },
      consumerTag: "c1",
    });

    const driver = makeDriver(metadata);
    const msg = makeMessage("TestMessage");

    await publishMessages(msg, { delay: 5000 }, driver, store);

    expect(dispatched).toMatchSnapshot();
  });

  it("should set x-iris-priority header when metadata has priority", async () => {
    const priorityMetadata = makeMetadata("TestMessage");
    (priorityMetadata as any).priority = 5;

    const driver = makeDriver(priorityMetadata);
    const msg = makeMessage("TestMessage");

    store.consumers.push({
      topic: "TestMessage",
      callback: async () => {},
      consumerTag: "c1",
    });

    await publishMessages(msg, undefined, driver, store);

    const prepared = (driver.prepareForPublish as jest.Mock).mock.results[0].value;
    const outbound = await prepared;

    expect(outbound.headers["x-iris-priority"]).toBe("5");
  });

  it("should set x-iris-priority header from publish options overriding metadata", async () => {
    const priorityMetadata = makeMetadata("TestMessage");
    (priorityMetadata as any).priority = 3;

    const driver = makeDriver(priorityMetadata);
    const msg = makeMessage("TestMessage");

    store.consumers.push({
      topic: "TestMessage",
      callback: async () => {},
      consumerTag: "c1",
    });

    await publishMessages(msg, { priority: 7 }, driver, store);

    const prepared = (driver.prepareForPublish as jest.Mock).mock.results[0].value;
    const outbound = await prepared;

    expect(outbound.headers["x-iris-priority"]).toBe("7");
  });

  it("should not set x-iris-priority header when priority is 0", async () => {
    const driver = makeDriver(metadata);
    const msg = makeMessage("TestMessage");

    store.consumers.push({
      topic: "TestMessage",
      callback: async () => {},
      consumerTag: "c1",
    });

    await publishMessages(msg, undefined, driver, store);

    const prepared = (driver.prepareForPublish as jest.Mock).mock.results[0].value;
    const outbound = await prepared;

    expect(outbound.headers["x-iris-priority"]).toBeUndefined();
  });

  it("should use publish options expiry instead of metadata expiry", async () => {
    const expiryMetadata = makeMetadata("TestMessage");
    (expiryMetadata as any).expiry = 30000;

    const driver = makeDriver(expiryMetadata);
    const msg = makeMessage("TestMessage");

    store.consumers.push({
      topic: "TestMessage",
      callback: async () => {},
      consumerTag: "c1",
    });

    await publishMessages(msg, { expiry: 5000 }, driver, store);

    expect(driver.calls.completed).toHaveLength(1);
  });

  it("should schedule with publish options delay via delayManager", async () => {
    const dispatched: Array<string> = [];
    store.consumers.push({
      topic: "TestMessage",
      callback: async () => {
        dispatched.push("consumed");
      },
      consumerTag: "c1",
    });

    const delayManager = createMockDelayManager();
    const driver = makeDriver(metadata);
    const msg = makeMessage("TestMessage");

    await publishMessages(msg, { delay: 500 }, driver, store, { delayManager });

    expect(dispatched).toHaveLength(0);
    expect(delayManager.schedule).toHaveBeenCalledTimes(1);
    expect(delayManager.scheduledCalls[0].delayMs).toBe(500);
  });
});
