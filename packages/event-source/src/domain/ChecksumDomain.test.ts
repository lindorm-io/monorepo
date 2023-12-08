import { IMessageBus, createMockMessageBus } from "@lindorm-io/amqp";
import { createMockLogger } from "@lindorm-io/core-logger";
import { LindormError } from "@lindorm-io/errors";
import { randomUUID } from "crypto";
import { ChecksumError, HandlerNotRegisteredError } from "../error";
import { TEST_AGGREGATE_EVENT_HANDLER } from "../fixtures/aggregate-event-handler.fixture";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import {
  TEST_CHECKSUM_EVENT_HANDLER,
  TEST_CHECKSUM_EVENT_HANDLER_CREATE,
  TEST_CHECKSUM_EVENT_HANDLER_DESTROY,
  TEST_CHECKSUM_EVENT_HANDLER_DESTROY_NEXT,
  TEST_CHECKSUM_EVENT_HANDLER_MERGE_STATE,
  TEST_CHECKSUM_EVENT_HANDLER_SET_STATE,
  TEST_CHECKSUM_EVENT_HANDLER_THROWS,
} from "../fixtures/checksum-event-handler.fixture";
import { TEST_DOMAIN_EVENT, TEST_DOMAIN_EVENT_CREATE } from "../fixtures/domain-event.fixture";
import { DomainEvent } from "../message";
import { AggregateIdentifier, IChecksumDomain } from "../types";
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
  let messageBus: IMessageBus;
  let store: any;

  beforeEach(async () => {
    aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    messageBus = createMockMessageBus();
    store = {
      verify: jest.fn(),
    };

    domain = new ChecksumDomain({ messageBus, store }, logger);

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }
  });

  test("should register event handler", async () => {
    messageBus = createMockMessageBus();
    domain = new ChecksumDomain({ messageBus, store }, logger);

    await expect(domain.registerEventHandler(TEST_CHECKSUM_EVENT_HANDLER)).resolves.toBeUndefined();

    expect(messageBus.subscribe).toHaveBeenCalledWith({
      callback: expect.any(Function),
      queue: "queue.checksum.default.aggregate_name.domain_event_default",
      topic: "default.aggregate_name.domain_event_default",
    });
  });

  test("should throw on existing event handler", async () => {
    domain = new ChecksumDomain({ messageBus, store }, logger);

    domain.registerEventHandler(TEST_CHECKSUM_EVENT_HANDLER);

    await expect(domain.registerEventHandler(TEST_CHECKSUM_EVENT_HANDLER)).rejects.toThrow(
      LindormError,
    );
  });

  test("should throw on invalid event handler", async () => {
    domain = new ChecksumDomain({ messageBus, store }, logger);

    await expect(domain.registerEventHandler(TEST_AGGREGATE_EVENT_HANDLER)).rejects.toThrow(
      LindormError,
    );
  });

  test("should handle event", async () => {
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event)).resolves.toBeUndefined();

    expect(store.verify).toHaveBeenCalledWith(event);
  });

  test("should dispatch error event on invalid checksum", async () => {
    store.verify.mockRejectedValue(new ChecksumError("test"));

    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event)).resolves.toBeUndefined();

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

    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event)).resolves.toBeUndefined();

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(ChecksumError),
        event,
      }),
    );
  });

  test("should throw on missing handler", async () => {
    domain = new ChecksumDomain({ messageBus, store }, logger);

    const event = new DomainEvent(TEST_DOMAIN_EVENT);

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event)).rejects.toThrow(HandlerNotRegisteredError);
  });
});
