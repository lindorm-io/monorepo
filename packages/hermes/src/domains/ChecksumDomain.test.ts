import { LindormError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { createMockRabbitMessageBus } from "@lindorm/rabbit";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../__fixtures__/aggregate";
import { TEST_AGGREGATE_EVENT_HANDLER } from "../__fixtures__/aggregate-event-handler";
import {
  TEST_CHECKSUM_EVENT_HANDLER,
  TEST_CHECKSUM_EVENT_HANDLER_CREATE,
  TEST_CHECKSUM_EVENT_HANDLER_DESTROY,
  TEST_CHECKSUM_EVENT_HANDLER_DESTROY_NEXT,
  TEST_CHECKSUM_EVENT_HANDLER_MERGE_STATE,
  TEST_CHECKSUM_EVENT_HANDLER_SET_STATE,
  TEST_CHECKSUM_EVENT_HANDLER_THROWS,
} from "../__fixtures__/checksum-event-handler";
import {
  TEST_HERMES_EVENT,
  TEST_HERMES_EVENT_CREATE,
} from "../__fixtures__/hermes-event";
import { ChecksumError, HandlerNotRegisteredError } from "../errors";
import { IChecksumDomain, IHermesMessageBus } from "../interfaces";
import { HermesEvent } from "../messages";
import { AggregateIdentifier } from "../types";
import { ChecksumDomain } from "./ChecksumDomain";

describe("ChecksumDomain", () => {
  const logger = createMockLogger();
  const eventHandlers = [
    TEST_CHECKSUM_EVENT_HANDLER,
    TEST_CHECKSUM_EVENT_HANDLER_CREATE,
    TEST_CHECKSUM_EVENT_HANDLER_DESTROY,
    TEST_CHECKSUM_EVENT_HANDLER_DESTROY_NEXT,
    TEST_CHECKSUM_EVENT_HANDLER_MERGE_STATE,
    TEST_CHECKSUM_EVENT_HANDLER_SET_STATE,
    TEST_CHECKSUM_EVENT_HANDLER_THROWS,
  ];

  let aggregate: AggregateIdentifier;
  let domain: IChecksumDomain;
  let messageBus: IHermesMessageBus;
  let store: any;

  beforeEach(async () => {
    aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    messageBus = createMockRabbitMessageBus(HermesEvent);
    store = {
      verify: jest.fn(),
    };

    domain = new ChecksumDomain({ messageBus, store, logger });

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }
  });

  test("should register event handler", async () => {
    messageBus = createMockRabbitMessageBus(HermesEvent);
    domain = new ChecksumDomain({ messageBus, store, logger });

    await expect(
      domain.registerEventHandler(TEST_CHECKSUM_EVENT_HANDLER),
    ).resolves.toBeUndefined();

    expect(messageBus.subscribe).toHaveBeenCalledWith({
      callback: expect.any(Function),
      queue: "queue.checksum.default.aggregate_name.hermes_event_default",
      topic: "default.aggregate_name.hermes_event_default",
    });
  });

  test("should throw on existing event handler", async () => {
    domain = new ChecksumDomain({ messageBus, store, logger });

    domain.registerEventHandler(TEST_CHECKSUM_EVENT_HANDLER);

    await expect(
      domain.registerEventHandler(TEST_CHECKSUM_EVENT_HANDLER),
    ).rejects.toThrow(LindormError);
  });

  test("should throw on invalid event handler", async () => {
    domain = new ChecksumDomain({ messageBus, store, logger });

    await expect(
      domain.registerEventHandler(TEST_AGGREGATE_EVENT_HANDLER),
    ).rejects.toThrow(LindormError);
  });

  test("should handle event", async () => {
    const event = new HermesEvent({ ...TEST_HERMES_EVENT_CREATE, aggregate });

    await expect(
      // @ts-expect-error
      domain.handleEvent(event),
    ).resolves.toBeUndefined();

    expect(store.verify).toHaveBeenCalledWith(event);
  });

  test("should dispatch error event on invalid checksum", async () => {
    store.verify.mockRejectedValue(new ChecksumError("test"));

    const event = new HermesEvent({ ...TEST_HERMES_EVENT_CREATE, aggregate });

    await expect(
      // @ts-expect-error
      domain.handleEvent(event),
    ).resolves.toBeUndefined();

    expect(messageBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "checksum_error",
        data: {
          error: expect.any(ChecksumError),
          message: event,
        },
      }),
    );
  });

  test("should emit error on invalid checksum", async () => {
    store.verify.mockRejectedValue(new ChecksumError("test"));

    const listener = jest.fn();

    domain.on("checksum", listener);

    const event = new HermesEvent({ ...TEST_HERMES_EVENT_CREATE, aggregate });

    await expect(
      // @ts-expect-error
      domain.handleEvent(event),
    ).resolves.toBeUndefined();

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(ChecksumError),
        event,
      }),
    );
  });

  test("should throw on missing handler", async () => {
    domain = new ChecksumDomain({ messageBus, store, logger });

    const event = new HermesEvent(TEST_HERMES_EVENT);

    await expect(
      // @ts-expect-error
      domain.handleEvent(event),
    ).rejects.toThrow(HandlerNotRegisteredError);
  });
});
