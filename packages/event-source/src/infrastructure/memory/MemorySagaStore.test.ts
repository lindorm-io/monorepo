import { Command, DomainEvent } from "../../message";
import { MemorySagaStore } from "./MemorySagaStore";
import { IN_MEMORY_SAGA_CAUSATION_STORE, IN_MEMORY_SAGA_STORE } from "./in-memory";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { TEST_COMMAND } from "../../fixtures/command.fixture";
import { TEST_SAGA_IDENTIFIER } from "../../fixtures/saga.fixture";
import { filter, find } from "lodash";
import { randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import {
  AggregateIdentifier,
  SagaStoreAttributes,
  SagaCausationAttributes,
  SagaClearMessagesToDispatchData,
  SagaClearProcessedCausationIdsData,
  SagaIdentifier,
  SagaUpdateData,
  SagaUpdateFilter,
} from "../../types";

describe("MemorySagaStore", () => {
  let aggregateIdentifier: AggregateIdentifier;
  let attributes: SagaStoreAttributes;
  let sagaIdentifier: SagaIdentifier;
  let store: MemorySagaStore;

  beforeAll(async () => {
    store = new MemorySagaStore();
  }, 10000);

  beforeEach(() => {
    aggregateIdentifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    sagaIdentifier = { ...TEST_SAGA_IDENTIFIER, id: aggregateIdentifier.id };
    attributes = {
      id: sagaIdentifier.id,
      name: sagaIdentifier.name,
      context: sagaIdentifier.context,
      destroyed: false,
      hash: randomString(16),
      messages_to_dispatch: [new Command(TEST_COMMAND)],
      processed_causation_ids: [randomUUID()],
      revision: 1,
      state: { state: "state" },
      created_at: new Date(),
      updated_at: new Date(),
    };
  });

  test("should resolve existing causation", async () => {
    const event = new DomainEvent(TEST_COMMAND);

    const document: SagaCausationAttributes = {
      id: sagaIdentifier.id,
      name: sagaIdentifier.name,
      context: sagaIdentifier.context,
      causation_id: event.id,
      timestamp: new Date(),
    };

    IN_MEMORY_SAGA_CAUSATION_STORE.push(document);

    await expect(store.causationExists(sagaIdentifier, event)).resolves.toBe(true);

    await expect(
      store.causationExists(
        {
          ...sagaIdentifier,
          id: randomUUID(),
        },
        event,
      ),
    ).resolves.toBe(false);
  });

  test("should clear messages", async () => {
    IN_MEMORY_SAGA_STORE.push({ ...attributes });

    const filter: SagaUpdateFilter = {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
      hash: attributes.hash,
      revision: attributes.revision,
    };

    const update: SagaClearMessagesToDispatchData = {
      hash: randomString(16),
      messages_to_dispatch: [],
      revision: 2,
    };

    await expect(store.clearMessagesToDispatch(filter, update)).resolves.toBeUndefined();

    expect(find(IN_MEMORY_SAGA_STORE, sagaIdentifier)).toStrictEqual(
      expect.objectContaining({
        hash: update.hash,
        messages_to_dispatch: [],
        revision: update.revision,
      }),
    );
  });

  test("should clear processed causation ids", async () => {
    IN_MEMORY_SAGA_STORE.push({ ...attributes });

    const filter: SagaUpdateFilter = {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
      hash: attributes.hash,
      revision: attributes.revision,
    };

    const update: SagaClearProcessedCausationIdsData = {
      hash: randomString(16),
      processed_causation_ids: [],
      revision: 2,
    };

    await expect(store.clearProcessedCausationIds(filter, update)).resolves.toBeUndefined();

    expect(find(IN_MEMORY_SAGA_STORE, sagaIdentifier)).toStrictEqual(
      expect.objectContaining({
        hash: update.hash,
        processed_causation_ids: [],
        revision: update.revision,
      }),
    );
  });

  test("should find saga", async () => {
    IN_MEMORY_SAGA_STORE.push({ ...attributes });

    await expect(store.find(sagaIdentifier)).resolves.toStrictEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { state: "state" },
      }),
    );
  });

  test("should insert saga", async () => {
    await expect(store.insert(attributes)).resolves.toBeUndefined();

    expect(find(IN_MEMORY_SAGA_STORE, sagaIdentifier)).toStrictEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { state: "state" },
      }),
    );
  });

  test("should insert processed causation ids", async () => {
    const one = randomUUID();
    const two = randomUUID();
    const three = randomUUID();

    await expect(
      store.insertProcessedCausationIds(sagaIdentifier, [one, two, three]),
    ).resolves.toBeUndefined();

    expect(
      filter(IN_MEMORY_SAGA_CAUSATION_STORE, {
        id: sagaIdentifier.id,
        name: sagaIdentifier.name,
        context: sagaIdentifier.context,
      }),
    ).toStrictEqual([
      expect.objectContaining({ causation_id: one }),
      expect.objectContaining({ causation_id: two }),
      expect.objectContaining({ causation_id: three }),
    ]);
  });

  test("should update saga", async () => {
    IN_MEMORY_SAGA_STORE.push({ ...attributes });

    const filter: SagaUpdateFilter = {
      id: attributes.id,
      name: attributes.name,
      context: attributes.context,
      hash: attributes.hash,
      revision: attributes.revision,
    };

    const update: SagaUpdateData = {
      destroyed: false,
      hash: randomString(16),
      messages_to_dispatch: [],
      processed_causation_ids: [],
      revision: 2,
      state: { updated: true },
    };

    await expect(store.update(filter, update)).resolves.toBeUndefined();

    expect(find(IN_MEMORY_SAGA_STORE, sagaIdentifier)).toStrictEqual(
      expect.objectContaining({
        hash: update.hash,
        revision: 2,
        state: { updated: true },
      }),
    );
  });
});
