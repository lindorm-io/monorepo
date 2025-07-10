import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { IRabbitSource, RabbitSource } from "@lindorm/rabbit";
import { Dict } from "@lindorm/types";
import { sleep } from "@lindorm/utils";
import { createTestEvent } from "../__fixtures__/create-message";
import { createTestAggregateIdentifier } from "../__fixtures__/create-test-aggregate-identifier";
import { createTestRegistry } from "../__fixtures__/create-test-registry";
import { TestEventCreate } from "../__fixtures__/modules/events/TestEventCreate";
import { TestEventDestroy } from "../__fixtures__/modules/events/TestEventDestroy";
import { TestEventMergeState } from "../__fixtures__/modules/events/TestEventMergeState";
import { TestEventSetState } from "../__fixtures__/modules/events/TestEventSetState";
import { CHECKSUM_STORE } from "../constants/private";
import { MessageBus } from "../infrastructure";
import { ChecksumStore } from "../infrastructure/ChecksumStore";
import {
  IChecksumDomain,
  IHermesChecksumStore,
  IHermesMessageBus,
  IHermesRegistry,
} from "../interfaces";
import { HermesError, HermesEvent } from "../messages";
import { AggregateIdentifier } from "../types";
import { ChecksumDomain } from "./ChecksumDomain";

describe("ChecksumDomain", () => {
  const namespace = "che_dom";
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let domain: IChecksumDomain;
  let errorBus: IHermesMessageBus<HermesError>;
  let eventBus: IHermesMessageBus<HermesEvent<Dict>>;
  let mongo: IMongoSource;
  let rabbit: IRabbitSource;
  let registry: IHermesRegistry;
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
      url: "amqp://localhost:5672",
    });
    await rabbit.setup();

    errorBus = new MessageBus({ Message: HermesError, rabbit, logger });
    eventBus = new MessageBus({ Message: HermesEvent, rabbit, logger });

    store = new ChecksumStore({ mongo, logger });

    aggregate = createTestAggregateIdentifier(namespace);

    registry = createTestRegistry(namespace);

    domain = new ChecksumDomain({
      errorBus,
      eventBus,
      logger,
      registry,
      store,
    });

    await domain.registerHandlers();
  });

  afterAll(async () => {
    await mongo.disconnect();
    await rabbit.disconnect();
  });

  test("should handle multiple published events", async () => {
    const eventCreate = createTestEvent(new TestEventCreate("create"), {
      aggregate,
    });
    const eventMergeState = createTestEvent(new TestEventMergeState("merge-state"), {
      aggregate,
    });
    const eventSetState = createTestEvent(new TestEventSetState("set-state"), {
      aggregate,
    });
    const eventDestroy = createTestEvent(new TestEventDestroy("destroy"), {
      aggregate,
    });

    await expect(eventBus.publish(eventCreate)).resolves.toBeUndefined();
    await sleep(500);

    await expect(eventBus.publish(eventMergeState)).resolves.toBeUndefined();
    await sleep(500);

    await expect(eventBus.publish(eventSetState)).resolves.toBeUndefined();
    await sleep(500);

    await expect(eventBus.publish(eventDestroy)).resolves.toBeUndefined();
    await sleep(500);

    await expect(
      mongo.collection(CHECKSUM_STORE).find({ id: aggregate.id }).toArray(),
    ).resolves.toEqual([
      expect.objectContaining({
        id: aggregate.id,
        name: "test_aggregate",
        namespace: namespace,
        checksum: expect.any(String),
        event_id: eventCreate.id,
        created_at: expect.any(Date),
      }),
      expect.objectContaining({
        id: aggregate.id,
        name: "test_aggregate",
        namespace: namespace,
        checksum: expect.any(String),
        event_id: eventMergeState.id,
        created_at: expect.any(Date),
      }),
      expect.objectContaining({
        id: aggregate.id,
        name: "test_aggregate",
        namespace: namespace,
        checksum: expect.any(String),
        event_id: eventSetState.id,
        created_at: expect.any(Date),
      }),
      expect.objectContaining({
        id: aggregate.id,
        name: "test_aggregate",
        namespace: namespace,
        checksum: expect.any(String),
        event_id: eventDestroy.id,
        created_at: expect.any(Date),
      }),
    ]);
  });
});
