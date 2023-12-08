import { sleep } from "@lindorm-io/core";
import { createMockLogger } from "@lindorm-io/core-logger";
import { randomUUID } from "crypto";
import { ChecksumStoreType, MessageBusType } from "../enum";
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
import {
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_DESTROY,
  TEST_DOMAIN_EVENT_MERGE_STATE,
  TEST_DOMAIN_EVENT_SET_STATE,
} from "../fixtures/domain-event.fixture";
import { ChecksumEventHandlerImplementation } from "../handler";
import { MessageBus } from "../infrastructure";
import { ChecksumStore } from "../infrastructure/ChecksumStore";
import { IN_MEMORY_CHECKSUM_STORE } from "../infrastructure/memory/in-memory";
import { DomainEvent } from "../message";
import { AggregateIdentifier } from "../types";
import { ChecksumDomain } from "./ChecksumDomain";

describe("ChecksumDomain", () => {
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let domain: ChecksumDomain;
  let eventHandlers: Array<ChecksumEventHandlerImplementation>;
  let messageBus: MessageBus;
  let store: ChecksumStore;

  beforeAll(async () => {
    aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    messageBus = new MessageBus({ type: MessageBusType.MEMORY }, logger);
    store = new ChecksumStore({ type: ChecksumStoreType.MEMORY }, logger);
    domain = new ChecksumDomain({ messageBus, store }, logger);

    const eventHandlers = [
      TEST_CHECKSUM_EVENT_HANDLER,
      TEST_CHECKSUM_EVENT_HANDLER_CREATE,
      TEST_CHECKSUM_EVENT_HANDLER_DESTROY,
      TEST_CHECKSUM_EVENT_HANDLER_DESTROY_NEXT,
      TEST_CHECKSUM_EVENT_HANDLER_MERGE_STATE,
      TEST_CHECKSUM_EVENT_HANDLER_SET_STATE,
      TEST_CHECKSUM_EVENT_HANDLER_THROWS,
    ];

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }
  });

  test("should handle multiple published events", async () => {
    const eventCreate = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });
    const eventMergeState = new DomainEvent({ ...TEST_DOMAIN_EVENT_MERGE_STATE, aggregate });
    const eventSetState = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });
    const eventDestroy = new DomainEvent({ ...TEST_DOMAIN_EVENT_DESTROY, aggregate });

    await expect(messageBus.publish(eventCreate)).resolves.toBeUndefined();
    await sleep(50);

    await expect(messageBus.publish(eventMergeState)).resolves.toBeUndefined();
    await sleep(50);

    await expect(messageBus.publish(eventSetState)).resolves.toBeUndefined();
    await sleep(50);

    await expect(messageBus.publish(eventDestroy)).resolves.toBeUndefined();
    await sleep(50);

    expect(IN_MEMORY_CHECKSUM_STORE).toStrictEqual([
      {
        id: aggregate.id,
        name: "aggregate_name",
        context: "default",
        checksum: expect.any(String),
        event_id: eventCreate.id,
        timestamp: expect.any(Date),
      },
      {
        id: aggregate.id,
        name: "aggregate_name",
        context: "default",
        checksum: expect.any(String),
        event_id: eventMergeState.id,
        timestamp: expect.any(Date),
      },
      {
        id: aggregate.id,
        name: "aggregate_name",
        context: "default",
        checksum: expect.any(String),
        event_id: eventSetState.id,
        timestamp: expect.any(Date),
      },
      {
        id: aggregate.id,
        name: "aggregate_name",
        context: "default",
        checksum: expect.any(String),
        event_id: eventDestroy.id,
        timestamp: expect.any(Date),
      },
    ]);
  });
});
