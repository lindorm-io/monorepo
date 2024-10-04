import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { IRabbitSource, RabbitSource } from "@lindorm/rabbit";
import { sleep } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../__fixtures__/aggregate";
import {
  TEST_HERMES_EVENT_CREATE,
  TEST_HERMES_EVENT_DESTROY,
  TEST_HERMES_EVENT_MERGE_STATE,
  TEST_HERMES_EVENT_SET_STATE,
} from "../__fixtures__/hermes-event";
import { TEST_SAGA_IDENTIFIER } from "../__fixtures__/saga";
import {
  TEST_SAGA_EVENT_HANDLER,
  TEST_SAGA_EVENT_HANDLER_CREATE,
  TEST_SAGA_EVENT_HANDLER_DESTROY,
  TEST_SAGA_EVENT_HANDLER_DISPATCH,
  TEST_SAGA_EVENT_HANDLER_MERGE_STATE,
  TEST_SAGA_EVENT_HANDLER_SET_STATE,
  TEST_SAGA_EVENT_HANDLER_TIMEOUT,
} from "../__fixtures__/saga-event-handler";
import { MessageBus, SagaStore } from "../infrastructure";
import { IHermesSagaEventHandler } from "../interfaces";
import { HermesEvent } from "../messages";
import { SagaDomain } from "./SagaDomain";

describe("SagaDomain", () => {
  const logger = createMockLogger();

  let mongo: IMongoSource;
  let rabbit: IRabbitSource;
  let domain: SagaDomain;
  let eventHandlers: Array<IHermesSagaEventHandler>;
  let messageBus: MessageBus;
  let store: SagaStore;

  beforeAll(async () => {
    mongo = new MongoSource({
      database: "MongoSagaDomain",
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
    });
    await mongo.setup();

    rabbit = new RabbitSource({
      logger,
      url: "amqp://localhost:5672",
    });
    await rabbit.setup();

    messageBus = new MessageBus({ rabbit, logger });
    store = new SagaStore({ mongo, logger });
    domain = new SagaDomain({ messageBus, store, logger });

    eventHandlers = [
      TEST_SAGA_EVENT_HANDLER,
      TEST_SAGA_EVENT_HANDLER_CREATE,
      TEST_SAGA_EVENT_HANDLER_DESTROY,
      TEST_SAGA_EVENT_HANDLER_DISPATCH,
      TEST_SAGA_EVENT_HANDLER_MERGE_STATE,
      TEST_SAGA_EVENT_HANDLER_SET_STATE,
      TEST_SAGA_EVENT_HANDLER_TIMEOUT,
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
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const saga = { ...TEST_SAGA_IDENTIFIER, id: aggregate.id };

    const eventCreate = new HermesEvent({ ...TEST_HERMES_EVENT_CREATE, aggregate });
    const eventMergeState = new HermesEvent({
      ...TEST_HERMES_EVENT_MERGE_STATE,
      aggregate,
    });
    const eventSetState = new HermesEvent({ ...TEST_HERMES_EVENT_SET_STATE, aggregate });
    const eventDestroy = new HermesEvent({ ...TEST_HERMES_EVENT_DESTROY, aggregate });

    await expect(messageBus.publish(eventCreate)).resolves.toBeUndefined();
    await sleep(250);

    await expect(messageBus.publish(eventMergeState)).resolves.toBeUndefined();
    await sleep(250);

    await expect(messageBus.publish(eventSetState)).resolves.toBeUndefined();
    await sleep(250);

    await expect(messageBus.publish(eventDestroy)).resolves.toBeUndefined();
    await sleep(250);

    await expect(store.load(saga)).resolves.toEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "name",
        context: "default",
        processedCausationIds: [],
        destroyed: true,
        messagesToDispatch: [],
        revision: 8,
        state: {
          created: true,
          merge: { hermesEventData: true },
          set: "state",
        },
      }),
    );
  }, 30000);
});
