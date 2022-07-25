import { AggregateIdentifier, ViewIdentifier, ViewStoreDocumentOptions } from "../types";
import { DomainEvent } from "../message";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { TEST_DOMAIN_EVENT_SET_STATE } from "../fixtures/domain-event.fixture";
import { TEST_VIEW_IDENTIFIER } from "../fixtures/view.fixture";
import { View } from "../entity";
import { ViewStore } from "./ViewStore";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockMongoConnection } from "@lindorm-io/mongo";
import { randomUUID } from "crypto";

describe("ViewStore", () => {
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let connection: any;
  let documentOptions: ViewStoreDocumentOptions;
  let store: ViewStore;
  let view: ViewIdentifier;

  let findOne: jest.Mock;
  let findOneAndUpdate: jest.Mock;
  let insertOne: jest.Mock;

  beforeEach(async () => {
    findOne = jest.fn().mockResolvedValue(null);
    findOneAndUpdate = jest.fn().mockResolvedValue({ ok: true });
    insertOne = jest.fn();

    connection = createMockMongoConnection({ findOne, findOneAndUpdate, insertOne });

    documentOptions = { collection: "collection" };
    aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    view = { ...TEST_VIEW_IDENTIFIER, id: aggregate.id };

    store = new ViewStore({ connection, database: "db", logger });
  }, 30000);

  test("should return existing view", async () => {
    const entity = new View(view, logger);
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });

    findOne.mockResolvedValue({
      ...view,
      causationList: ["d2679fa3-5fa4-4911-9e63-4ee094fcaa5a", event.id],
      destroyed: false,
      meta: {},
      revision: 2,
      state: { loadedState: true },
    });

    await expect(store.save(entity, event, documentOptions)).resolves.toStrictEqual(
      expect.objectContaining({
        id: view.id,
        name: "viewName",
        context: "viewContext",
        causationList: ["d2679fa3-5fa4-4911-9e63-4ee094fcaa5a", event.id],
        destroyed: false,
        meta: {},
        revision: 2,
        state: { loadedState: true },
      }),
    );
  });

  test("should save new view", async () => {
    const entity = new View(view, logger);
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });

    await expect(store.save(entity, event, documentOptions)).resolves.toStrictEqual(
      expect.objectContaining({
        id: view.id,
        name: "viewName",
        context: "viewContext",
        causationList: [event.id],
        destroyed: false,
        meta: {},
        revision: 1,
        state: {},
      }),
    );

    expect(findOne).toHaveBeenCalled();
    expect(insertOne).toHaveBeenCalled();
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("should update existing view", async () => {
    const entity = new View(
      {
        ...view,
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

    await expect(store.save(entity, event, documentOptions)).resolves.toStrictEqual(
      expect.objectContaining({
        id: view.id,
        name: "viewName",
        context: "viewContext",
        causationList: [
          "012db886-5a2b-4f41-8c45-6cf7eb64307d",
          "6bd7ffa6-56c1-40b1-986e-cc919671e164",
          event.id,
        ],
        destroyed: false,
        meta: {},
        revision: 3,
        state: { created: true, updated: true },
      }),
    );

    expect(findOne).toHaveBeenCalled();
    expect(insertOne).not.toHaveBeenCalled();
    expect(findOneAndUpdate).toHaveBeenCalled();
  });

  test("should load existing view", async () => {
    findOne.mockResolvedValue({
      ...view,
      causationList: ["d2679fa3-5fa4-4911-9e63-4ee094fcaa5a"],
      destroyed: false,
      meta: {},
      revision: 2,
      state: { loadedState: true },
    });

    await expect(store.load(view, documentOptions)).resolves.toStrictEqual(
      expect.objectContaining({
        id: view.id,
        name: "viewName",
        context: "viewContext",
        causationList: ["d2679fa3-5fa4-4911-9e63-4ee094fcaa5a"],
        destroyed: false,
        meta: {},
        revision: 2,
        state: { loadedState: true },
      }),
    );
  });

  test("should load new view", async () => {
    await expect(store.load(view, documentOptions)).resolves.toStrictEqual(
      expect.objectContaining({
        id: view.id,
        name: "viewName",
        context: "viewContext",
        causationList: [],
        destroyed: false,
        meta: {},
        revision: 0,
        state: {},
      }),
    );
  });
});
