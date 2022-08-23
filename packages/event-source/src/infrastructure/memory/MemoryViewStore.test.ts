import { DomainEvent } from "../../message";
import { MemoryViewStore } from "./MemoryViewStore";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { TEST_COMMAND } from "../../fixtures/command.fixture";
import { TEST_VIEW_IDENTIFIER } from "../../fixtures/view.fixture";
import { filter, find } from "lodash";
import { randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import {
  AggregateIdentifier,
  ViewStoreAttributes,
  ViewStoreCausationAttributes,
  ViewClearProcessedCausationIdsData,
  ViewIdentifier,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";

describe("MemoryViewStore", () => {
  let aggregateIdentifier: AggregateIdentifier;
  let store: MemoryViewStore;
  let viewIdentifier: ViewIdentifier;

  beforeAll(async () => {
    store = new MemoryViewStore();
  }, 10000);

  beforeEach(() => {
    aggregateIdentifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    viewIdentifier = { ...TEST_VIEW_IDENTIFIER, id: aggregateIdentifier.id };
  });

  test("should resolve existing causation", async () => {
    const event = new DomainEvent(TEST_COMMAND);

    const document: ViewStoreCausationAttributes = {
      view_id: viewIdentifier.id,
      view_name: viewIdentifier.name,
      view_context: viewIdentifier.context,
      causation_id: event.id,
      timestamp: new Date(),
    };

    store.causations.push(document);

    await expect(store.causationExists(viewIdentifier, event)).resolves.toBe(true);

    await expect(
      store.causationExists(
        {
          ...viewIdentifier,
          id: randomUUID(),
        },
        event,
      ),
    ).resolves.toBe(false);
  });

  test("should clear processed causation ids", async () => {
    const attributes: ViewStoreAttributes = {
      id: viewIdentifier.id,
      name: "view_name",
      context: "default",
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: ["processed"],
      revision: 1,
      state: {},
      created_at: new Date(),
      updated_at: new Date(),
    };

    store.views.push(attributes);

    const filter: ViewUpdateFilter = {
      id: attributes.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      hash: attributes.hash,
      revision: attributes.revision,
    };

    const update: ViewClearProcessedCausationIdsData = {
      hash: randomString(16),
      processed_causation_ids: [],
      revision: 2,
    };

    await expect(store.clearProcessedCausationIds(filter, update, {})).resolves.toBeUndefined();

    expect(find(store.views, viewIdentifier)).toStrictEqual(
      expect.objectContaining({
        hash: update.hash,
        processed_causation_ids: [],
        revision: 2,
      }),
    );
  });

  test("should find view", async () => {
    const attributes: ViewStoreAttributes = {
      id: viewIdentifier.id,
      name: "view_name",
      context: "default",
      destroyed: false,
      hash: randomString(16),
      processed_causation_ids: [],
      revision: 1,
      meta: {},
      state: { found: true },
      created_at: new Date(),
      updated_at: new Date(),
    };

    store.views.push(attributes);

    await expect(store.find(viewIdentifier, {})).resolves.toStrictEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { found: true },
      }),
    );
  });

  test("should insert view", async () => {
    const attributes: ViewStoreAttributes = {
      id: viewIdentifier.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: [],
      revision: 1,
      state: { inserted: true },
      created_at: new Date(),
      updated_at: new Date(),
    };

    await expect(store.insert(attributes, {})).resolves.toBeUndefined();

    expect(find(store.views, viewIdentifier)).toStrictEqual(
      expect.objectContaining({
        hash: attributes.hash,
        state: { inserted: true },
      }),
    );
  });

  test("should insert processed causation ids", async () => {
    const one = randomUUID();
    const two = randomUUID();
    const three = randomUUID();

    await expect(
      store.insertProcessedCausationIds(viewIdentifier, [one, two, three]),
    ).resolves.toBeUndefined();

    expect(
      filter(store.causations, {
        view_id: viewIdentifier.id,
        view_name: viewIdentifier.name,
        view_context: viewIdentifier.context,
      }),
    ).toStrictEqual([
      expect.objectContaining({ causation_id: one }),
      expect.objectContaining({ causation_id: two }),
      expect.objectContaining({ causation_id: three }),
    ]);
  });

  test("should update view", async () => {
    const attributes: ViewStoreAttributes = {
      id: viewIdentifier.id,
      name: "view_name",
      context: "default",
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: [],
      revision: 1,
      state: { found: true },
      created_at: new Date(),
      updated_at: new Date(),
    };

    store.views.push(attributes);

    const filter: ViewUpdateFilter = {
      id: attributes.id,
      name: viewIdentifier.name,
      context: viewIdentifier.context,
      hash: attributes.hash,
      revision: attributes.revision,
    };

    const update: ViewUpdateData = {
      destroyed: false,
      hash: randomString(16),
      meta: {},
      processed_causation_ids: [],
      revision: 2,
      state: { updated: true },
    };

    await expect(store.update(filter, update, {})).resolves.toBeUndefined();

    expect(find(store.views, viewIdentifier)).toStrictEqual(
      expect.objectContaining({
        hash: update.hash,
        revision: 2,
        state: { updated: true },
      }),
    );
  });
});
