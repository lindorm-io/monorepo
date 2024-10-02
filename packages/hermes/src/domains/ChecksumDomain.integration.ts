import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { IRabbitSource, RabbitSource } from "@lindorm/rabbit";
import { sleep } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../__fixtures__/aggregate";
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
  TEST_HERMES_EVENT_CREATE,
  TEST_HERMES_EVENT_DESTROY,
  TEST_HERMES_EVENT_MERGE_STATE,
  TEST_HERMES_EVENT_SET_STATE,
} from "../__fixtures__/hermes-event";
import { CHECKSUM_STORE } from "../constants/private";
import { MessageBus } from "../infrastructure";
import { ChecksumStore } from "../infrastructure/ChecksumStore";
import { IChecksumDomain, IHermesChecksumStore, IHermesMessageBus } from "../interfaces";
import { HermesEvent } from "../messages";
import { AggregateIdentifier } from "../types";
import { ChecksumDomain } from "./ChecksumDomain";

describe("ChecksumDomain", () => {
  const logger = createMockLogger();

  let mongo: IMongoSource;
  let rabbit: IRabbitSource;
  let aggregate: AggregateIdentifier;
  let domain: IChecksumDomain;
  let messageBus: IHermesMessageBus;
  let store: IHermesChecksumStore;

  beforeAll(async () => {
    mongo = new MongoSource({
      database: "MongoChecksumDomain",
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
    });
    await mongo.setup();

    rabbit = new RabbitSource({
      logger,
      messages: [],
      url: "amqp://localhost:5672",
    });
    await rabbit.setup();

    aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    messageBus = new MessageBus({ rabbit, logger });
    store = new ChecksumStore({ mongo, logger });
    domain = new ChecksumDomain({ messageBus, store, logger });

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

  afterAll(async () => {
    await mongo.disconnect();
    await rabbit.disconnect();
  });

  test("should handle multiple published events", async () => {
    const eventCreate = new HermesEvent({ ...TEST_HERMES_EVENT_CREATE, aggregate });
    const eventMergeState = new HermesEvent({
      ...TEST_HERMES_EVENT_MERGE_STATE,
      aggregate,
    });
    const eventSetState = new HermesEvent({ ...TEST_HERMES_EVENT_SET_STATE, aggregate });
    const eventDestroy = new HermesEvent({ ...TEST_HERMES_EVENT_DESTROY, aggregate });

    await expect(messageBus.publish(eventCreate)).resolves.toBeUndefined();
    await sleep(50);

    await expect(messageBus.publish(eventMergeState)).resolves.toBeUndefined();
    await sleep(50);

    await expect(messageBus.publish(eventSetState)).resolves.toBeUndefined();
    await sleep(50);

    await expect(messageBus.publish(eventDestroy)).resolves.toBeUndefined();
    await sleep(50);

    await expect(
      mongo.collection(CHECKSUM_STORE).find({ id: aggregate.id }).toArray(),
    ).resolves.toEqual([
      expect.objectContaining({
        id: aggregate.id,
        name: "aggregate_name",
        context: "default",
        checksum: expect.any(String),
        event_id: eventCreate.id,
        timestamp: expect.any(Date),
      }),
      expect.objectContaining({
        id: aggregate.id,
        name: "aggregate_name",
        context: "default",
        checksum: expect.any(String),
        event_id: eventMergeState.id,
        timestamp: expect.any(Date),
      }),
      expect.objectContaining({
        id: aggregate.id,
        name: "aggregate_name",
        context: "default",
        checksum: expect.any(String),
        event_id: eventSetState.id,
        timestamp: expect.any(Date),
      }),
      expect.objectContaining({
        id: aggregate.id,
        name: "aggregate_name",
        context: "default",
        checksum: expect.any(String),
        event_id: eventDestroy.id,
        timestamp: expect.any(Date),
      }),
    ]);
  });
});
