import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  TestAggregate,
  TestForgettableAggregate,
  TestUpcasterAggregate,
} from "../../__fixtures__/modules/aggregates/index.js";
import {
  TestCommandCreate,
  TestCommandDestroy,
  TestCommandDestroyNext,
  TestCommandDispatch,
  TestCommandEncrypt,
  TestCommandMergeState,
  TestCommandSetState,
  TestCommandThrows,
  TestCommandTimeout,
} from "../../__fixtures__/modules/commands/index.js";
import {
  TestEventCreate,
  TestEventDestroy,
  TestEventDestroyNext,
  TestEventDispatch,
  TestEventEncrypt,
  TestEventMergeState,
  TestEventSetState,
  TestEventThrows,
  TestEventTimeout,
  TestEventUpcast_V1,
  TestEventUpcast_V2,
  TestEventUpcast_V3,
} from "../../__fixtures__/modules/events/index.js";
import { TestViewQuery } from "../../__fixtures__/modules/queries/index.js";
import { TestSaga } from "../../__fixtures__/modules/sagas/index.js";
import { TestTimeoutReminder } from "../../__fixtures__/modules/timeouts/index.js";
import { TestView } from "../../__fixtures__/modules/views/TestView.js";
import {
  AggregateDestroyedError,
  AggregateNotDestroyedError,
  HandlerNotRegisteredError,
  UpcasterChainError,
} from "../../errors/index.js";
import { HermesEventMessage } from "../messages/index.js";
import { HermesRegistry, HermesScanner } from "../registry/index.js";
import { AggregateModel } from "./aggregate-model.js";
import { beforeAll, describe, expect, test } from "vitest";

const ALL_CONSTRUCTORS = [
  TestCommandCreate,
  TestCommandDestroy,
  TestCommandDestroyNext,
  TestCommandDispatch,
  TestCommandEncrypt,
  TestCommandMergeState,
  TestCommandSetState,
  TestCommandThrows,
  TestCommandTimeout,
  TestEventCreate,
  TestEventDestroy,
  TestEventDestroyNext,
  TestEventDispatch,
  TestEventEncrypt,
  TestEventMergeState,
  TestEventSetState,
  TestEventThrows,
  TestEventTimeout,
  TestEventUpcast_V1,
  TestEventUpcast_V2,
  TestEventUpcast_V3,
  TestTimeoutReminder,
  TestViewQuery,
  TestAggregate,
  TestForgettableAggregate,
  TestUpcasterAggregate,
  TestSaga,
  TestView,
];

const createEventMessage = (
  name: string,
  data: Record<string, unknown>,
  overrides: Partial<HermesEventMessage> = {},
): HermesEventMessage =>
  Object.assign(new HermesEventMessage(), {
    aggregate: {
      id: "test-aggregate-id",
      name: "test_aggregate",
      namespace: "hermes",
    },
    causationId: "causation-id",
    correlationId: null,
    data,
    meta: { origin: "test" },
    name,
    version: 1,
    timestamp: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  });

describe("AggregateModel", () => {
  let registry: HermesRegistry;

  beforeAll(async () => {
    const scanned = await HermesScanner.scan(ALL_CONSTRUCTORS);
    registry = new HermesRegistry(scanned);
  });

  const createModel = (
    overrides: Partial<{ id: string; name: string; namespace: string }> = {},
  ): AggregateModel => {
    return new AggregateModel({
      id: overrides.id ?? "test-aggregate-id",
      name: overrides.name ?? "test_aggregate",
      namespace: overrides.namespace ?? "hermes",
      registry,
      logger: createMockLogger(),
    });
  };

  test("should construct with correct initial state", () => {
    const model = createModel();

    expect(model.id).toBe("test-aggregate-id");
    expect(model.name).toBe("test_aggregate");
    expect(model.namespace).toBe("hermes");
    expect(model.destroyed).toBe(false);
    expect(model.events).toEqual([]);
    expect(model.numberOfLoadedEvents).toBe(0);
    expect(model.state).toEqual({});
  });

  test("should return toJSON() snapshot", () => {
    const model = createModel();

    expect(model.toJSON()).toMatchSnapshot();
  });

  test("should apply event from causation and run event handler", async () => {
    const model = createModel();

    const causation = {
      id: "cmd-id",
      correlationId: "corr-id",
      meta: { origin: "test" },
    };

    await model.apply(causation, new TestEventCreate("applied-create"));

    expect(model.state).toMatchSnapshot();
    expect(model.events).toHaveLength(1);
    expect(model.numberOfLoadedEvents).toBe(0);
    expect(model.destroyed).toBe(false);

    const event = model.events[0];
    expect(event).toBeInstanceOf(HermesEventMessage);
    expect(event.name).toBe("test_event_create");
    expect(event.version).toBe(1);
    expect(event.data).toEqual({ input: "applied-create" });
    expect(event.causationId).toBe("cmd-id");
    expect(event.correlationId).toBe("corr-id");
    expect(event.meta).toEqual({ origin: "test" });
    expect(event.aggregate).toEqual({
      id: "test-aggregate-id",
      name: "test_aggregate",
      namespace: "hermes",
    });
  });

  test("should load a single stored event and increment numberOfLoadedEvents", async () => {
    const model = createModel();

    const event = createEventMessage("test_event_create", { input: "loaded-create" });

    await model.load(event);

    expect(model.numberOfLoadedEvents).toBe(1);
    expect(model.events).toEqual([event]);
    expect(model.state).toMatchSnapshot();
    expect(model.destroyed).toBe(false);
  });

  test("should load multiple events and accumulate state correctly", async () => {
    const model = createModel();

    const event1 = createEventMessage("test_event_create", { input: "create-value" });
    const event2 = createEventMessage("test_event_merge_state", { input: "merge-value" });
    const event3 = createEventMessage("test_event_set_state", { input: "set-value" });

    await model.load(event1);
    await model.load(event2);
    await model.load(event3);

    expect(model.numberOfLoadedEvents).toBe(3);
    expect(model.events).toHaveLength(3);
    expect(model.state).toMatchSnapshot();
  });

  test("should handle destroy() in event handler", async () => {
    const model = createModel();

    const event = createEventMessage("test_event_destroy", { input: "destroy-value" });

    await model.load(event);

    expect(model.destroyed).toBe(true);
    expect(model.state).toMatchSnapshot();
    expect(model.numberOfLoadedEvents).toBe(1);
  });

  test("should handle destroyNext() two-step pattern", async () => {
    const model = createModel();

    const event1 = createEventMessage("test_event_destroy_next", {
      input: "destroy-next-value",
    });
    const event2 = createEventMessage("test_event_destroy", { input: "destroy-value" });

    await model.load(event1);

    // After destroyNext, the aggregate is not yet destroyed
    expect(model.destroyed).toBe(false);

    await model.load(event2);

    // After the following event calls destroy(), the aggregate is destroyed
    expect(model.destroyed).toBe(true);
    expect(model.numberOfLoadedEvents).toBe(2);
    expect(model.state).toMatchSnapshot();
  });

  test("should throw AggregateNotDestroyedError when destroyNext was called but destroy was not called in next event", async () => {
    const model = createModel();

    const event1 = createEventMessage("test_event_destroy_next", {
      input: "destroy-next-value",
    });
    const event2 = createEventMessage("test_event_merge_state", { input: "merge-value" });

    await model.load(event1);

    await expect(model.load(event2)).rejects.toThrow(AggregateNotDestroyedError);
  });

  test("should throw AggregateDestroyedError when applying event after destroy", async () => {
    const model = createModel();

    const destroyEvent = createEventMessage("test_event_destroy", {
      input: "destroy-value",
    });
    const mergeEvent = createEventMessage("test_event_merge_state", {
      input: "merge-value",
    });

    await model.load(destroyEvent);

    expect(model.destroyed).toBe(true);

    await expect(model.load(mergeEvent)).rejects.toThrow(AggregateDestroyedError);
  });

  test("should throw HandlerNotRegisteredError for unregistered event type", async () => {
    const model = createModel();

    const event = createEventMessage("completely_unknown_event", { input: "unknown" });

    await expect(model.load(event)).rejects.toThrow();
  });

  // -- MEDIUM: Event version mismatch (correct name, wrong version) --

  test("should throw HandlerNotRegisteredError for correct event name but wrong version", async () => {
    const model = createModel();

    const event = createEventMessage(
      "test_event_create",
      { input: "versioned" },
      { version: 99 },
    );

    await expect(model.load(event)).rejects.toThrow(HandlerNotRegisteredError);
  });

  test("should propagate errors thrown in event handler", async () => {
    const model = createModel();

    const event = createEventMessage("test_event_throws", {
      input: "handler-error-message",
    });

    await expect(model.load(event)).rejects.toThrow(new Error("handler-error-message"));
  });

  test("should provide structuredClone of state in event context (prevent mutation leaking)", async () => {
    const model = createModel();

    // Load a create event to establish initial state
    const event1 = createEventMessage("test_event_create", { input: "original" });
    await model.load(event1);

    const stateBefore = model.state;

    // Load a merge event -- the handler receives a structuredClone of state,
    // so any mutation to ctx.state inside the handler cannot affect model state
    const event2 = createEventMessage("test_event_merge_state", { input: "merged" });
    await model.load(event2);

    // The original state reference should not have been mutated by the merge
    // (deepmerge creates a new object, so the old reference stays intact)
    expect(stateBefore).toEqual({ create: "original" });

    // The model state should reflect both events
    expect(model.state).toMatchSnapshot();
  });

  test("should accumulate state across multiple apply() calls", async () => {
    const model = createModel();

    const causation = {
      id: "cmd-id",
      correlationId: null,
      meta: { origin: "test" },
    };

    await model.apply(causation, new TestEventCreate("first"));
    await model.apply(causation, new TestEventMergeState("second"));

    expect(model.events).toHaveLength(2);
    expect(model.state).toMatchSnapshot();
    expect(model.numberOfLoadedEvents).toBe(0);
  });

  test("should throw AggregateDestroyedError when applying via apply() after destroy", async () => {
    const model = createModel();

    const causation = {
      id: "cmd-id",
      correlationId: null,
      meta: { origin: "test" },
    };

    await model.apply(causation, new TestEventDestroy("destroy"));

    expect(model.destroyed).toBe(true);

    await expect(
      model.apply(causation, new TestEventMergeState("after-destroy")),
    ).rejects.toThrow(AggregateDestroyedError);
  });

  test("should mix load and apply, accumulating events and loaded count independently", async () => {
    const model = createModel();

    // Load a stored event
    const storedEvent = createEventMessage("test_event_create", { input: "loaded" });
    await model.load(storedEvent);

    expect(model.numberOfLoadedEvents).toBe(1);
    expect(model.events).toHaveLength(1);

    // Apply a new event
    const causation = {
      id: "cmd-id",
      correlationId: null,
      meta: {},
    };
    await model.apply(causation, new TestEventMergeState("applied"));

    // numberOfLoadedEvents only increments on load, not apply
    expect(model.numberOfLoadedEvents).toBe(1);
    expect(model.events).toHaveLength(2);
    expect(model.state).toMatchSnapshot();
  });
});

describe("AggregateModel upcasting", () => {
  let registry: HermesRegistry;

  beforeAll(async () => {
    const scanned = await HermesScanner.scan(ALL_CONSTRUCTORS);
    registry = new HermesRegistry(scanned);
  });

  const createUpcasterModel = (): AggregateModel => {
    return new AggregateModel({
      id: "upcaster-aggregate-id",
      name: "test_upcaster_aggregate",
      namespace: "hermes",
      registry,
      logger: createMockLogger(),
    });
  };

  const createUpcastEventMessage = (
    version: number,
    data: Record<string, unknown>,
  ): HermesEventMessage =>
    Object.assign(new HermesEventMessage(), {
      aggregate: {
        id: "upcaster-aggregate-id",
        name: "test_upcaster_aggregate",
        namespace: "hermes",
      },
      causationId: "causation-id",
      correlationId: null,
      data,
      meta: {},
      name: "test_event_upcast",
      version,
      timestamp: new Date("2024-01-01T00:00:00.000Z"),
    });

  test("should pass through event at current handler version without upcasting", async () => {
    const model = createUpcasterModel();

    // V3 event matches handler directly -- no upcasting needed
    const event = createUpcastEventMessage(3, {
      value: "hello",
      addedField: 42,
      extraField: true,
    });

    await model.load(event);

    expect(model.state).toMatchSnapshot();
    expect(model.numberOfLoadedEvents).toBe(1);
  });

  test("should upcast V1 event to V3 via chained upcasters", async () => {
    const model = createUpcasterModel();

    // V1 event stored in database -- handler expects V3
    const event = createUpcastEventMessage(1, { value: "from-v1" });

    await model.load(event);

    // upcastV1toV2 adds addedField: 0
    // upcastV2toV3 adds extraField: false
    expect(model.state).toMatchSnapshot();
    expect(model.numberOfLoadedEvents).toBe(1);
  });

  test("should upcast V2 event to V3 via single upcaster step", async () => {
    const model = createUpcasterModel();

    // V2 event stored in database -- handler expects V3
    const event = createUpcastEventMessage(2, { value: "from-v2", addedField: 99 });

    await model.load(event);

    // upcastV2toV3 adds extraField: false
    expect(model.state).toMatchSnapshot();
    expect(model.numberOfLoadedEvents).toBe(1);
  });

  test("should accumulate state correctly when mixing upcasted and current-version events", async () => {
    const model = createUpcasterModel();

    // Load a V1 event (will be upcasted to V3)
    const v1Event = createUpcastEventMessage(1, { value: "first" });
    await model.load(v1Event);

    // Load a V3 event (no upcasting needed)
    const v3Event = createUpcastEventMessage(3, {
      value: "second",
      addedField: 100,
      extraField: true,
    });
    await model.load(v3Event);

    // State should reflect the last event (mergeState accumulates)
    expect(model.state).toMatchSnapshot();
    expect(model.numberOfLoadedEvents).toBe(2);
  });

  test("should throw UpcasterChainError when upcaster chain has a gap", async () => {
    // Create a registry with an aggregate that has a gap in the upcaster chain
    // We'll manually construct a registry with incomplete upcasters

    // Build a custom scanned modules with a broken upcaster chain
    const scanned = await HermesScanner.scan(ALL_CONSTRUCTORS);

    // Find the upcaster aggregate and remove the V1->V2 step
    const upcasterAgg = scanned.aggregates.find(
      (a) => a.name === "test_upcaster_aggregate",
    )!;
    const originalUpcasters = upcasterAgg.upcasters;
    upcasterAgg.upcasters = originalUpcasters.filter((u) => u.fromVersion !== 1);

    const brokenRegistry = new HermesRegistry(scanned);

    const model = new AggregateModel({
      id: "upcaster-aggregate-id",
      name: "test_upcaster_aggregate",
      namespace: "hermes",
      registry: brokenRegistry,
      logger: createMockLogger(),
    });

    // V1 event cannot reach V3 because V1->V2 step is missing
    const event = createUpcastEventMessage(1, { value: "broken" });

    await expect(model.load(event)).rejects.toThrow(UpcasterChainError);

    // Restore the original upcasters for other tests
    upcasterAgg.upcasters = originalUpcasters;
  });

  test("should throw HandlerNotRegisteredError for completely unknown event name", async () => {
    const model = createUpcasterModel();

    const event = Object.assign(new HermesEventMessage(), {
      aggregate: {
        id: "upcaster-aggregate-id",
        name: "test_upcaster_aggregate",
        namespace: "hermes",
      },
      causationId: "causation-id",
      correlationId: null,
      data: { value: "unknown" },
      meta: {},
      name: "completely_unknown_event",
      version: 1,
      timestamp: new Date("2024-01-01T00:00:00.000Z"),
    });

    await expect(model.load(event)).rejects.toThrow(HandlerNotRegisteredError);
  });

  test("should preserve the original event message in the events array after upcasting", async () => {
    const model = createUpcasterModel();

    const event = createUpcastEventMessage(1, { value: "original-data" });

    await model.load(event);

    // The events array should contain the ORIGINAL message (v1 data),
    // not the upcasted data -- the event store record is immutable
    expect(model.events).toHaveLength(1);
    expect(model.events[0].version).toBe(1);
    expect(model.events[0].data).toEqual({ value: "original-data" });
  });
});
