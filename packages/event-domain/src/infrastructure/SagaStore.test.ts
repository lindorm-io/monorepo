import { AggregateIdentifier, SagaIdentifier } from "../types";
import { DomainEvent } from "../message";
import { Saga } from "../entity";
import { SagaStore } from "./SagaStore";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import {
  TEST_DOMAIN_EVENT_DISPATCH,
  TEST_DOMAIN_EVENT_SET_STATE,
} from "../fixtures/domain-event.fixture";
import { TEST_SAGA_IDENTIFIER } from "../fixtures/saga.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockMongoConnection } from "@lindorm-io/mongo";
import { randomUUID } from "crypto";

describe("SagaStore", () => {
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let connection: any;
  let saga: SagaIdentifier;
  let store: SagaStore;

  let findOne: jest.Mock;
  let findOneAndUpdate: jest.Mock;
  let insertOne: jest.Mock;

  beforeEach(async () => {
    findOne = jest.fn().mockResolvedValue(null);
    findOneAndUpdate = jest.fn().mockResolvedValue({ ok: true });
    insertOne = jest.fn();

    connection = createMockMongoConnection({ findOne, findOneAndUpdate, insertOne });

    aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    saga = { ...TEST_SAGA_IDENTIFIER, id: aggregate.id };

    store = new SagaStore({ connection, logger });
  }, 30000);

  test("should return existing saga", async () => {
    const entity = new Saga(saga, logger);
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });

    findOne.mockResolvedValue({
      ...saga,
      causationList: ["d2679fa3-5fa4-4911-9e63-4ee094fcaa5a", event.id],
      destroyed: false,
      messagesToDispatch: [],
      revision: 2,
      state: { loadedState: true },
    });

    await expect(store.save(entity, event)).resolves.toStrictEqual(
      expect.objectContaining({
        id: saga.id,
        name: "saga_name",
        context: "default",
        causationList: ["d2679fa3-5fa4-4911-9e63-4ee094fcaa5a", event.id],
        destroyed: false,
        messagesToDispatch: [],
        revision: 2,
        state: { loadedState: true },
      }),
    );
  });

  test("should save new saga", async () => {
    const entity = new Saga(saga, logger);
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });

    await expect(store.save(entity, event)).resolves.toStrictEqual(
      expect.objectContaining({
        id: saga.id,
        name: "saga_name",
        context: "default",
        causationList: [event.id],
        destroyed: false,
        messagesToDispatch: [],
        revision: 1,
        state: {},
      }),
    );

    expect(findOne).toHaveBeenCalled();
    expect(insertOne).toHaveBeenCalled();
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("should update existing saga", async () => {
    const entity = new Saga(
      {
        ...saga,
        causationList: [
          "012db886-5a2b-4f41-8c45-6cf7eb64307d",
          "6bd7ffa6-56c1-40b1-986e-cc919671e164",
        ],
        revision: 2,
        state: { created: true, updated: true },
      },
      logger,
    );
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });

    await expect(store.save(entity, event)).resolves.toStrictEqual(
      expect.objectContaining({
        id: saga.id,
        name: "saga_name",
        context: "default",
        causationList: [
          "012db886-5a2b-4f41-8c45-6cf7eb64307d",
          "6bd7ffa6-56c1-40b1-986e-cc919671e164",
          event.id,
        ],
        destroyed: false,
        messagesToDispatch: [],
        revision: 3,
        state: { created: true, updated: true },
      }),
    );

    expect(findOne).toHaveBeenCalled();
    expect(insertOne).not.toHaveBeenCalled();
    expect(findOneAndUpdate).toHaveBeenCalled();
  });

  test("should load existing saga", async () => {
    findOne.mockResolvedValue({
      ...saga,
      causationList: ["d2679fa3-5fa4-4911-9e63-4ee094fcaa5a"],
      destroyed: false,
      messagesToDispatch: [],
      revision: 2,
      state: { loadedState: true },
    });

    await expect(store.load(saga)).resolves.toStrictEqual(
      expect.objectContaining({
        id: saga.id,
        name: "saga_name",
        context: "default",
        causationList: ["d2679fa3-5fa4-4911-9e63-4ee094fcaa5a"],
        destroyed: false,
        messagesToDispatch: [],
        revision: 2,
        state: { loadedState: true },
      }),
    );
  });

  test("should load new saga", async () => {
    await expect(store.load(saga)).resolves.toStrictEqual(
      expect.objectContaining({
        id: saga.id,
        name: "saga_name",
        context: "default",
        causationList: [],
        destroyed: false,
        messagesToDispatch: [],
        revision: 0,
        state: {},
      }),
    );
  });

  test("should clear messages to dispatch", async () => {
    const entity = new Saga(
      {
        ...saga,
        messagesToDispatch: [new DomainEvent({ ...TEST_DOMAIN_EVENT_DISPATCH, aggregate })],
      },
      logger,
    );

    await expect(store.clearMessagesToDispatch(entity)).resolves.toStrictEqual(
      expect.objectContaining({
        id: saga.id,
        name: "saga_name",
        context: "default",
        causationList: [],
        destroyed: false,
        messagesToDispatch: [],
        revision: 1,
        state: {},
      }),
    );
  });
});
