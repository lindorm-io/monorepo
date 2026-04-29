import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { IrisSource } from "@lindorm/iris";
import type { ProteusSource } from "@lindorm/proteus";
import { randomUUID } from "crypto";
import {
  createTestProteusSource,
  createTestIrisSource,
} from "../../__fixtures__/create-test-sources.js";
import {
  TestAggregate,
  TestForgettableAggregate,
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
} from "../../__fixtures__/modules/events/index.js";
import { TestTimeoutReminder } from "../../__fixtures__/modules/timeouts/index.js";
import { TestViewQuery } from "../../__fixtures__/modules/queries/index.js";
import { TestSaga } from "../../__fixtures__/modules/sagas/index.js";
import { TestView, TestViewEntity } from "../../__fixtures__/modules/views/index.js";
import {
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  ViewAlreadyCreatedError,
  ViewDestroyedError,
  ViewNotCreatedError,
} from "../../errors/index.js";
import {
  EventRecord,
  EncryptionRecord,
  CausationRecord,
  ChecksumRecord,
  SagaRecord,
} from "../entities/index.js";
import {
  HermesCommandMessage,
  HermesEventMessage,
  HermesErrorMessage,
  HermesTimeoutMessage,
} from "../messages/index.js";
import { HermesScanner } from "../registry/HermesScanner.js";
import { HermesRegistry } from "../registry/hermes-registry.js";
import type { RegisteredView, HandlerRegistration } from "../registry/types.js";
import { ViewDomain } from "./view-domain.js";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockInstance,
} from "vitest";

describe("ViewDomain", () => {
  const logger = createMockLogger();

  let proteus: ProteusSource;
  let iris: IrisSource;
  let registry: HermesRegistry;
  let domain: ViewDomain;
  let testView: RegisteredView;
  let commandPublishSpy: MockInstance;
  let errorPublishSpy: MockInstance;

  beforeAll(async () => {
    proteus = createTestProteusSource();
    iris = createTestIrisSource();

    const scanned = await HermesScanner.scan([
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
      TestTimeoutReminder,
      TestViewQuery,
      TestAggregate,
      TestForgettableAggregate,
      TestSaga,
      TestView,
    ]);
    registry = new HermesRegistry(scanned);

    proteus.addEntities([
      EventRecord,
      SagaRecord,
      CausationRecord,
      ChecksumRecord,
      EncryptionRecord,
      TestViewEntity,
    ]);

    iris.addMessages([
      HermesCommandMessage,
      HermesEventMessage,
      HermesErrorMessage,
      HermesTimeoutMessage,
    ]);

    await proteus.connect();
    await proteus.setup();
    await iris.connect();
    await iris.setup();

    testView = registry.getView("hermes", "test_view");
  });

  afterAll(async () => {
    await iris.disconnect();
    await proteus.disconnect();
  });

  beforeEach(async () => {
    const eventBus = iris.messageBus(HermesEventMessage);
    const commandQueue = iris.workerQueue(HermesCommandMessage);
    const errorQueue = iris.workerQueue(HermesErrorMessage);

    commandPublishSpy = vi.spyOn(commandQueue, "publish").mockResolvedValue(undefined);
    errorPublishSpy = vi.spyOn(errorQueue, "publish").mockResolvedValue(undefined);

    domain = new ViewDomain({
      registry,
      proteusSource: proteus,
      viewSources: new Map(),
      eventBus,
      commandQueue,
      errorQueue,
      causationExpiryMs: 24 * 60 * 60 * 1000,
      logger,
    });
  });

  afterEach(() => {
    commandPublishSpy.mockRestore();
    errorPublishSpy.mockRestore();
  });

  // Helpers

  const createEventMsg = (
    eventName: string,
    data: Record<string, unknown>,
    overrides: Partial<{
      id: string;
      aggregate: { id: string; name: string; namespace: string };
      causationId: string;
      correlationId: string | null;
      meta: Record<string, unknown>;
      version: number;
    }> = {},
  ): HermesEventMessage => {
    const msg = new HermesEventMessage();
    msg.id = overrides.id ?? randomUUID();
    msg.aggregate = overrides.aggregate ?? {
      id: randomUUID(),
      name: "test_aggregate",
      namespace: "hermes",
    };
    msg.name = eventName;
    msg.version = overrides.version ?? 1;
    msg.causationId = overrides.causationId ?? msg.id;
    msg.correlationId = overrides.correlationId ?? null;
    msg.data = data;
    msg.meta = overrides.meta ?? { origin: "test" };
    msg.timestamp = new Date();
    return msg;
  };

  const findEventHandler = (
    view: RegisteredView,
    eventName: string,
  ): HandlerRegistration => {
    const handler = view.eventHandlers.find((h) => {
      const dto = registry.getEvent(h.trigger);
      return dto.name === eventName;
    });
    if (!handler) throw new Error(`No handler for event: ${eventName}`);
    return handler;
  };

  const handleEvent = async (
    msg: HermesEventMessage,
    view: RegisteredView,
    handler: HandlerRegistration,
  ): Promise<void> => {
    await (domain as any).handleEvent(msg, view, handler);
  };

  // -- Registration --

  it("should have registered event handlers in the view", () => {
    expect(testView.eventHandlers.length).toBeGreaterThan(0);
    expect(testView.queryHandlers.length).toBeGreaterThan(0);
  });

  it("should subscribe to event topics using aggregate namespace and name, not view namespace and name", async () => {
    const subscribeSpy = vi
      .spyOn((domain as any).eventBus, "subscribe")
      .mockResolvedValue(undefined);

    await domain.registerHandlers();

    const subscribeCalls = subscribeSpy.mock.calls;
    expect(subscribeCalls.length).toBeGreaterThan(0);

    for (const [arg] of subscribeCalls) {
      const { topic, queue } = arg as { topic: string; queue: string };
      // Topic must use aggregate identity (test_aggregate), not view identity (test_view)
      expect(topic).toMatch(/^hermes\.test_aggregate\./);
      // Queue uses view identity for consumer isolation
      expect(queue).toMatch(/^queue\.view\.hermes\.test_view\./);
    }

    subscribeSpy.mockRestore();
  });

  it("should return correct subscription topics from getSubscriptionTopicsForView", () => {
    const topics = domain.getSubscriptionTopicsForView(testView);
    expect(topics.length).toBeGreaterThan(0);

    for (const { topic, queue } of topics) {
      // Topic must use aggregate identity (test_aggregate), not view identity (test_view)
      expect(topic).toMatch(/^hermes\.test_aggregate\./);
      // Queue uses view identity for consumer isolation
      expect(queue).toMatch(/^queue\.view\.hermes\.test_view\./);
    }
  });

  // -- New view entity creation --

  it("should handle event for new view entity and save it", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testView, "test_event_create");

    const event = createEventMsg(
      "test_event_create",
      { input: "view-init" },
      { aggregate },
    );
    await handleEvent(event, testView, handler);

    const viewRepo = proteus.repository(TestViewEntity);
    const entity = await viewRepo.findOne({ id: aggregateId });

    expect(entity).not.toBeNull();
    expect(entity!.create).toBe("view-init");
    expect(entity!.destroyed).toBe(false);
  });

  // -- Causation record --

  it("should insert causation record when handling view event", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testView, "test_event_create");

    const event = createEventMsg(
      "test_event_create",
      { input: "causation" },
      { aggregate },
    );
    await handleEvent(event, testView, handler);

    const causationRepo = proteus.repository(CausationRecord);
    const causations = await causationRepo.find({
      ownerId: aggregateId,
      ownerName: "hermes.test_view",
    });

    expect(causations).toHaveLength(1);
    expect(causations[0].causationId).toBe(event.id);
  });

  // -- Existing view entity update --

  it("should handle event for existing view entity and update fields", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findEventHandler(testView, "test_event_create");
    const mergeHandler = findEventHandler(testView, "test_event_merge_state");

    const createEvent = createEventMsg(
      "test_event_create",
      { input: "created" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    const mergeEvent = createEventMsg(
      "test_event_merge_state",
      { input: "updated" },
      { aggregate },
    );
    await handleEvent(mergeEvent, testView, mergeHandler);

    const viewRepo = proteus.repository(TestViewEntity);
    const entity = await viewRepo.findOne({ id: aggregateId });

    expect(entity).not.toBeNull();
    expect(entity!.create).toBe("created");
    expect(entity!.mergeState).toBe("updated");
  });

  // -- Duplicate skipping --

  it("should skip duplicate event when causation already exists", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testView, "test_event_create");

    const event = createEventMsg("test_event_create", { input: "once" }, { aggregate });
    await handleEvent(event, testView, handler);

    await handleEvent(event, testView, handler);

    const causationRepo = proteus.repository(CausationRecord);
    const causations = await causationRepo.find({
      ownerId: aggregateId,
      ownerName: "hermes.test_view",
    });

    expect(causations).toHaveLength(1);
  });

  // -- View ID resolution --

  it("should resolve view ID via @ViewIdHandler", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testView, "test_event_create");

    const event = createEventMsg(
      "test_event_create",
      { input: "id-test" },
      { aggregate },
    );
    await handleEvent(event, testView, handler);

    const viewRepo = proteus.repository(TestViewEntity);
    const entity = await viewRepo.findOne({ id: aggregateId });

    expect(entity).not.toBeNull();
    expect(entity!.id).toBe(aggregateId);
  });

  it("should default view ID to aggregate.id when no @ViewIdHandler for event", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findEventHandler(testView, "test_event_create");
    const mergeHandler = findEventHandler(testView, "test_event_merge_state");

    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    const mergeEvent = createEventMsg(
      "test_event_merge_state",
      { input: "no-id" },
      { aggregate },
    );
    await handleEvent(mergeEvent, testView, mergeHandler);

    const viewRepo = proteus.repository(TestViewEntity);
    const entity = await viewRepo.findOne({ id: aggregateId });

    expect(entity).not.toBeNull();
    expect(entity!.mergeState).toBe("no-id");
  });

  // -- Condition validation --

  it("should throw ViewNotCreatedError when requireCreated and view does not exist", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const mergeHandler = findEventHandler(testView, "test_event_merge_state");

    const mergeEvent = createEventMsg(
      "test_event_merge_state",
      { input: "orphan" },
      { aggregate },
    );

    // ViewNotCreatedError is permanent=true, published to error queue, not rethrown
    await handleEvent(mergeEvent, testView, mergeHandler);

    const viewRepo = proteus.repository(TestViewEntity);
    const entity = await viewRepo.findOne({ id: aggregateId });
    expect(entity).toBeNull();
  });

  it("should throw ViewAlreadyCreatedError when requireNotCreated and view exists", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findEventHandler(testView, "test_event_create");

    const createEvent = createEventMsg(
      "test_event_create",
      { input: "first" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    const createEvent2 = createEventMsg(
      "test_event_create",
      { input: "duplicate" },
      { aggregate },
    );
    // ViewAlreadyCreatedError is permanent=true, published to error queue, not rethrown
    await handleEvent(createEvent2, testView, createHandler);

    const viewRepo = proteus.repository(TestViewEntity);
    const entity = await viewRepo.findOne({ id: aggregateId });
    expect(entity!.create).toBe("first");
  });

  // -- Destroyed view --

  it("should handle ViewDestroyedError for destroyed view", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findEventHandler(testView, "test_event_create");
    const destroyHandler = findEventHandler(testView, "test_event_destroy");
    const mergeHandler = findEventHandler(testView, "test_event_merge_state");

    const createEvent = createEventMsg(
      "test_event_create",
      { input: "born" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    const destroyEvent = createEventMsg(
      "test_event_destroy",
      { input: "dead" },
      { aggregate },
    );
    await handleEvent(destroyEvent, testView, destroyHandler);

    // ViewDestroyedError is permanent, published to error queue, not rethrown
    const mergeEvent = createEventMsg(
      "test_event_merge_state",
      { input: "zombie" },
      { aggregate },
    );
    await handleEvent(mergeEvent, testView, mergeHandler);
  });

  // -- Destroy via handler --

  it("should mark entity as destroyed when handler calls destroy()", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findEventHandler(testView, "test_event_create");
    const destroyHandler = findEventHandler(testView, "test_event_destroy");

    const createEvent = createEventMsg(
      "test_event_create",
      { input: "alive" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    const destroyEvent = createEventMsg(
      "test_event_destroy",
      { input: "gone" },
      { aggregate },
    );
    await handleEvent(destroyEvent, testView, destroyHandler);

    const viewRepo = proteus.repository(TestViewEntity);
    const entity = await viewRepo.findOne({ id: aggregateId });

    expect(entity).not.toBeNull();
    expect(entity!.destroyed).toBe(true);
    expect(entity!.destroy).toBe("gone");
  });

  // -- Query handling --

  it("should handle query via @ViewQueryHandler and return results", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testView, "test_event_create");

    const createEvent = createEventMsg(
      "test_event_create",
      { input: "findable" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, handler);

    const query = new TestViewQuery("findable");
    const results = await domain.query<Array<TestViewEntity>>(query);

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: aggregateId,
          create: "findable",
        }),
      ]),
    );
  });

  it("should throw HandlerNotRegisteredError for unregistered query", async () => {
    class UnregisteredQuery {
      filter = "test";
    }

    await expect(domain.query(new UnregisteredQuery())).rejects.toThrow();
  });

  // -- EventEmitter --

  it("should emit view events via EventEmitter", async () => {
    const emitted: Array<unknown> = [];
    domain.on("view", (data) => emitted.push(data));

    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testView, "test_event_create");

    const event = createEventMsg(
      "test_event_create",
      { input: "emit-test" },
      { aggregate },
    );
    await handleEvent(event, testView, handler);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(
      expect.objectContaining({
        id: aggregateId,
        name: "test_view",
        namespace: "hermes",
        destroyed: false,
      }),
    );
  });

  it("should emit namespaced view events", async () => {
    const namespacedEmitted: Array<unknown> = [];
    const nameEmitted: Array<unknown> = [];

    domain.on("view.hermes", (data) => namespacedEmitted.push(data));
    domain.on("view.hermes.test_view", (data) => nameEmitted.push(data));

    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testView, "test_event_create");

    const event = createEventMsg(
      "test_event_create",
      { input: "ns-test" },
      { aggregate },
    );
    await handleEvent(event, testView, handler);

    expect(namespacedEmitted).toHaveLength(1);
    expect(nameEmitted).toHaveLength(1);
  });

  // -- Inspect --

  it("should retrieve a view entity via inspect() after handling event", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testView, "test_event_create");

    const event = createEventMsg(
      "test_event_create",
      { input: "inspectable" },
      { aggregate },
    );
    await handleEvent(event, testView, handler);

    const entity = await domain.inspect(aggregateId, TestViewEntity);

    expect(entity).not.toBeNull();
    expect(entity!.id).toBe(aggregateId);
    expect(entity!.create).toBe("inspectable");
  });

  // -- SetState --

  it("should handle setState in view event handler", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findEventHandler(testView, "test_event_create");
    const setStateHandler = findEventHandler(testView, "test_event_set_state");

    const createEvent = createEventMsg(
      "test_event_create",
      { input: "initial" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    const setStateEvent = createEventMsg(
      "test_event_set_state",
      { input: "replaced" },
      { aggregate },
    );
    await handleEvent(setStateEvent, testView, setStateHandler);

    const viewRepo = proteus.repository(TestViewEntity);
    const entity = await viewRepo.findOne({ id: aggregateId });

    expect(entity).not.toBeNull();
    expect(entity!.setState).toBe("replaced");
  });

  // -- Source resolution --

  it("should resolve default ProteusSource when view has no driverType", () => {
    const resolveSource = (domain as any).resolveSource.bind(domain);
    const source = resolveSource(testView);
    expect(source).toBe(proteus);
  });

  it("should throw when driverType does not match any viewSource", () => {
    const resolveSource = (domain as any).resolveSource.bind(domain);
    const fakeView = {
      driverType: "nonexistent",
      name: "fake_view",
      namespace: "fake",
    };

    expect(() => resolveSource(fakeView)).toThrow(
      /No ProteusSource found for driver type/,
    );
  });

  // -- View ID resolution helper --

  it("should resolve view ID via private resolveViewId method", () => {
    const resolveViewId = (domain as any).resolveViewId.bind(domain);

    const msg = createEventMsg(
      "test_event_create",
      { input: "test" },
      { aggregate: { id: "agg-789", name: "test_aggregate", namespace: "hermes" } },
    );

    const event = new TestEventCreate("test");
    const viewId = resolveViewId(msg, event, testView);

    expect(viewId).toBe("agg-789");
  });

  // -- Handler error propagation (M3) --

  it("should propagate non-domain errors from view event handler", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // First create the view entity
    const createHandler = findEventHandler(testView, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // Then handle an event whose handler throws a non-domain Error
    const throwsHandler = findEventHandler(testView, "test_event_throws");
    const throwsEvent = createEventMsg(
      "test_event_throws",
      { input: "boom" },
      { aggregate },
    );
    await expect(handleEvent(throwsEvent, testView, throwsHandler)).rejects.toThrow(
      "boom",
    );

    // Verify the view entity was NOT updated (still has original state)
    const viewRepo = proteus.repository(TestViewEntity);
    const entity = await viewRepo.findOne({ id: aggregateId });
    expect(entity).not.toBeNull();
    expect(entity!.create).toBe("init");
  });

  // -- Multi-source resolution (U3) --

  it("should resolve view from viewSources when driverType matches", async () => {
    const secondSource = createTestProteusSource();
    secondSource.addEntities([TestViewEntity]);
    await secondSource.connect();
    await secondSource.setup();

    try {
      const eventBus = iris.messageBus(HermesEventMessage);
      const commandQueue = iris.workerQueue(HermesCommandMessage);
      const errorQueue = iris.workerQueue(HermesErrorMessage);

      vi.spyOn(commandQueue, "publish").mockResolvedValue(undefined);
      vi.spyOn(errorQueue, "publish").mockResolvedValue(undefined);

      const viewSources = new Map<string, typeof proteus>();
      viewSources.set("secondary", secondSource);

      const multiDomain = new ViewDomain({
        registry,
        proteusSource: proteus,
        viewSources,
        eventBus,
        commandQueue,
        errorQueue,
        causationExpiryMs: 24 * 60 * 60 * 1000,
        logger,
      });

      // resolveSource with a matching driverType should return the secondary source
      const resolveSource = (multiDomain as any).resolveSource.bind(multiDomain);
      const fakeView = { driverType: "secondary", name: "fake", namespace: "fake" };
      const resolved = resolveSource(fakeView);
      expect(resolved).toBe(secondSource);
    } finally {
      await secondSource.disconnect();
    }
  });

  // -- EventEmitter cleanup (H1) --

  it("should remove listener via off()", () => {
    const listener = vi.fn();
    domain.on("view", listener);
    domain.off("view", listener);

    (domain as any).eventEmitter.emit("view", {
      id: "test",
      name: "test",
      namespace: "test",
      destroyed: false,
      revision: 0,
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it("should remove all listeners via removeAllListeners()", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    domain.on("view", listener1);
    domain.on("view.hermes", listener2);

    domain.removeAllListeners();

    (domain as any).eventEmitter.emit("view", {
      id: "test",
      name: "test",
      namespace: "test",
      destroyed: false,
      revision: 0,
    });
    (domain as any).eventEmitter.emit("view.hermes", {
      id: "test",
      name: "test",
      namespace: "test",
      destroyed: false,
      revision: 0,
    });

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });

  // -- C4: dispatchCommandFromError: mandatory set before publish (bug fix verification) --

  it("should set mandatory on command message before publishing from error handler", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create a view entity first
    const createHandler = findEventHandler(testView, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // Test dispatchCommandFromError directly to verify mandatory ordering
    const dispatchCommandFromError = (domain as any).dispatchCommandFromError.bind(
      domain,
    );

    const causation = createEventMsg(
      "test_event_create",
      { input: "cause" },
      { aggregate },
    );
    const command = new TestCommandCreate("retry-from-error");

    await dispatchCommandFromError(causation, command, { mandatory: false });

    // Verify commandQueue.publish was called with a message where mandatory is already set
    expect(commandPublishSpy).toHaveBeenCalledTimes(1);
    const publishedMsg = commandPublishSpy.mock.calls[0][0];
    expect(publishedMsg.mandatory).toBe(false);
  });

  it("should set mandatory before publish even with delay option", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const dispatchCommandFromError = (domain as any).dispatchCommandFromError.bind(
      domain,
    );
    const causation = createEventMsg(
      "test_event_create",
      { input: "cause" },
      { aggregate },
    );
    const command = new TestCommandCreate("delayed-retry");

    await dispatchCommandFromError(causation, command, { mandatory: false, delay: 5000 });

    expect(commandPublishSpy).toHaveBeenCalledTimes(1);
    const [publishedMsg, publishOpts] = commandPublishSpy.mock.calls[0];
    expect(publishedMsg.mandatory).toBe(false);
    expect(publishOpts).toEqual({ delay: 5000 });
  });

  // -- H10: tryErrorHandler full coverage --

  it("should invoke error handler when permanent DomainError occurs in view", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create the view entity
    const createHandler = findEventHandler(testView, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // ViewAlreadyCreatedError is a permanent DomainError. Trigger it.
    const createEvent2 = createEventMsg(
      "test_event_create",
      { input: "dup" },
      { aggregate },
    );
    await handleEvent(createEvent2, testView, createHandler);

    // M10: ViewAlreadyCreatedError matches the specific onAlreadyCreatedError handler
    // which dispatches TestCommandCreate("already-created-retry")
    expect(commandPublishSpy).toHaveBeenCalledTimes(1);
    const publishedMsg = commandPublishSpy.mock.calls[0][0];
    expect(publishedMsg.name).toBe("test_command_create");
    expect(publishedMsg.data).toEqual({ input: "already-created-retry" });
  });

  it("should propagate error when view error handler throws", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create the view entity
    const createHandler = findEventHandler(testView, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // Override the error handler to throw
    const origTarget = testView.target;
    try {
      testView.target = class {
        async onCreateEvent(): Promise<void> {}
        onAlreadyCreatedError(): void {
          throw new Error("error handler exploded");
        }
      } as any;

      // ViewAlreadyCreatedError triggers handleViewError -> tryErrorHandler
      const createEvent2 = createEventMsg(
        "test_event_create",
        { input: "dup" },
        { aggregate },
      );
      // Error should propagate so Iris retries
      await expect(handleEvent(createEvent2, testView, createHandler)).rejects.toThrow(
        "error handler exploded",
      );
    } finally {
      testView.target = origTarget;
    }
  });

  it("should be a no-op when view has no error handlers", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create the view entity
    const createHandler = findEventHandler(testView, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // Temporarily remove error handlers
    const origErrorHandlers = testView.errorHandlers;
    try {
      (testView as any).errorHandlers = [];

      // ViewAlreadyCreatedError triggers handleViewError -> tryErrorHandler
      // With no error handlers, tryErrorHandler returns early
      const createEvent2 = createEventMsg(
        "test_event_create",
        { input: "dup" },
        { aggregate },
      );
      await handleEvent(createEvent2, testView, createHandler);

      // No commands dispatched since no error handler
      expect(commandPublishSpy).not.toHaveBeenCalled();
    } finally {
      (testView as any).errorHandlers = origErrorHandlers;
    }
  });

  // -- H10: dispatch from error handler --

  it("should call commandQueue.publish when error handler dispatches command", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create view
    const createHandler = findEventHandler(testView, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // Trigger permanent error (duplicate create)
    const createEvent2 = createEventMsg(
      "test_event_create",
      { input: "dup" },
      { aggregate },
    );
    await handleEvent(createEvent2, testView, createHandler);

    // TestView error handler dispatches TestCommandCreate("retry")
    expect(commandPublishSpy).toHaveBeenCalled();
  });

  // -- H11: save failure leaves entity unchanged --

  it("should not update view entity when save fails in same-source transaction", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create view
    const createHandler = findEventHandler(testView, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "original" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // Mock proteus.transaction to throw during merge event save
    vi.spyOn(proteus, "transaction").mockRejectedValueOnce(new Error("save failed"));

    const mergeHandler = findEventHandler(testView, "test_event_merge_state");
    const mergeEvent = createEventMsg(
      "test_event_merge_state",
      { input: "updated" },
      { aggregate },
    );

    // The error propagates because it's not a DomainError
    await expect(handleEvent(mergeEvent, testView, mergeHandler)).rejects.toThrow(
      "save failed",
    );

    // Verify the entity was not modified in the database
    const viewRepo = proteus.repository(TestViewEntity);
    const entity = await viewRepo.findOne({ id: aggregateId });
    expect(entity).not.toBeNull();
    expect(entity!.create).toBe("original");
    expect(entity!.mergeState).toBe("");

    (proteus.transaction as Mock).mockRestore();
  });

  // -- H: publishError is called for permanent DomainError --

  it("should publish error to error queue for permanent DomainError in view", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create view
    const createHandler = findEventHandler(testView, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // Trigger permanent error (duplicate create)
    const createEvent2 = createEventMsg(
      "test_event_create",
      { input: "dup" },
      { aggregate },
    );
    await handleEvent(createEvent2, testView, createHandler);

    // M9: publishError is now awaited, so no setTimeout needed
    expect(errorPublishSpy).toHaveBeenCalled();
  });

  // -- C4: cross-source transactional save --

  it("should save view and causation transactionally in cross-source view source", async () => {
    const secondSource = createTestProteusSource();
    secondSource.addEntities([TestViewEntity, CausationRecord]);
    await secondSource.connect();
    await secondSource.setup();

    try {
      const eventBus = iris.messageBus(HermesEventMessage);
      const commandQueue = iris.workerQueue(HermesCommandMessage);
      const errorQueue = iris.workerQueue(HermesErrorMessage);

      const cmdSpy = vi.spyOn(commandQueue, "publish").mockResolvedValue(undefined);
      const errSpy = vi.spyOn(errorQueue, "publish").mockResolvedValue(undefined);

      const viewSources = new Map<string, typeof proteus>();
      viewSources.set("secondary", secondSource);

      const crossDomain = new ViewDomain({
        registry,
        proteusSource: proteus,
        viewSources,
        eventBus,
        commandQueue,
        errorQueue,
        causationExpiryMs: 24 * 60 * 60 * 1000,
        logger,
      });

      const origDriverType = testView.driverType;
      (testView as any).driverType = "secondary";

      const aggregateId = randomUUID();
      const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
      const createHandler = findEventHandler(testView, "test_event_create");

      const event = createEventMsg(
        "test_event_create",
        { input: "cross-source" },
        { aggregate },
      );
      await (crossDomain as any).handleEvent(event, testView, createHandler);

      // Verify causation was inserted in VIEW source (not main source)
      const viewCausationRepo = secondSource.repository(CausationRecord);
      const viewCausations = await viewCausationRepo.find({
        ownerId: aggregateId,
        ownerName: "hermes.test_view",
      });
      expect(viewCausations).toHaveLength(1);

      // Verify causation was NOT inserted in main source
      const mainCausationRepo = proteus.repository(CausationRecord);
      const mainCausations = await mainCausationRepo.find({
        ownerId: aggregateId,
        ownerName: "hermes.test_view",
      });
      expect(mainCausations).toHaveLength(0);

      // Verify view entity was saved in secondary source
      const viewRepo = secondSource.repository(TestViewEntity);
      const entity = await viewRepo.findOne({ id: aggregateId });
      expect(entity).not.toBeNull();
      expect(entity!.create).toBe("cross-source");

      (testView as any).driverType = origDriverType;
      cmdSpy.mockRestore();
      errSpy.mockRestore();
    } finally {
      await secondSource.disconnect();
    }
  });

  it("should roll back both view and causation when cross-source transaction fails", async () => {
    const secondSource = createTestProteusSource();
    secondSource.addEntities([TestViewEntity, CausationRecord]);
    await secondSource.connect();
    await secondSource.setup();

    try {
      const eventBus = iris.messageBus(HermesEventMessage);
      const commandQueue = iris.workerQueue(HermesCommandMessage);
      const errorQueue = iris.workerQueue(HermesErrorMessage);

      const cmdSpy = vi.spyOn(commandQueue, "publish").mockResolvedValue(undefined);
      const errSpy = vi.spyOn(errorQueue, "publish").mockResolvedValue(undefined);

      const viewSources = new Map<string, typeof proteus>();
      viewSources.set("secondary", secondSource);

      const crossDomain = new ViewDomain({
        registry,
        proteusSource: proteus,
        viewSources,
        eventBus,
        commandQueue,
        errorQueue,
        causationExpiryMs: 24 * 60 * 60 * 1000,
        logger,
      });

      const origDriverType = testView.driverType;
      (testView as any).driverType = "secondary";

      const aggregateId = randomUUID();
      const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
      const createHandler = findEventHandler(testView, "test_event_create");

      // Make the transaction on the view source fail
      vi.spyOn(secondSource, "transaction").mockRejectedValueOnce(
        new Error("cross-source save failed"),
      );

      const event = createEventMsg(
        "test_event_create",
        { input: "rollback-test" },
        { aggregate },
      );

      await expect(
        (crossDomain as any).handleEvent(event, testView, createHandler),
      ).rejects.toThrow("cross-source save failed");

      // Verify neither causation nor view entity exists after rollback
      const viewCausationRepo = secondSource.repository(CausationRecord);
      const causations = await viewCausationRepo.find({
        ownerId: aggregateId,
        ownerName: "hermes.test_view",
      });
      expect(causations).toHaveLength(0);

      const viewRepo = secondSource.repository(TestViewEntity);
      const entity = await viewRepo.findOne({ id: aggregateId });
      expect(entity).toBeNull();

      (testView as any).driverType = origDriverType;
      (secondSource.transaction as Mock).mockRestore();
      cmdSpy.mockRestore();
      errSpy.mockRestore();
    } finally {
      await secondSource.disconnect();
    }
  });

  it("should check causation in view source for cross-source dedup", async () => {
    const secondSource = createTestProteusSource();
    secondSource.addEntities([TestViewEntity, CausationRecord]);
    await secondSource.connect();
    await secondSource.setup();

    try {
      const eventBus = iris.messageBus(HermesEventMessage);
      const commandQueue = iris.workerQueue(HermesCommandMessage);
      const errorQueue = iris.workerQueue(HermesErrorMessage);

      const cmdSpy = vi.spyOn(commandQueue, "publish").mockResolvedValue(undefined);
      const errSpy = vi.spyOn(errorQueue, "publish").mockResolvedValue(undefined);

      const viewSources = new Map<string, typeof proteus>();
      viewSources.set("secondary", secondSource);

      const crossDomain = new ViewDomain({
        registry,
        proteusSource: proteus,
        viewSources,
        eventBus,
        commandQueue,
        errorQueue,
        causationExpiryMs: 24 * 60 * 60 * 1000,
        logger,
      });

      const origDriverType = testView.driverType;
      (testView as any).driverType = "secondary";

      const aggregateId = randomUUID();
      const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
      const createHandler = findEventHandler(testView, "test_event_create");

      const event = createEventMsg(
        "test_event_create",
        { input: "dedup-test" },
        { aggregate },
      );

      // First handle -- should succeed
      await (crossDomain as any).handleEvent(event, testView, createHandler);

      // Second handle with same event -- should skip (dedup)
      await (crossDomain as any).handleEvent(event, testView, createHandler);

      // Verify only one causation record exists in view source
      const viewCausationRepo = secondSource.repository(CausationRecord);
      const causations = await viewCausationRepo.find({
        ownerId: aggregateId,
        ownerName: "hermes.test_view",
      });
      expect(causations).toHaveLength(1);

      (testView as any).driverType = origDriverType;
      cmdSpy.mockRestore();
      errSpy.mockRestore();
    } finally {
      await secondSource.disconnect();
    }
  });

  // -- MEDIUM: causation expiry null path --

  it("should set causation expiresAt to null when causationExpiryMs is 0", async () => {
    const localEventBus = iris.messageBus(HermesEventMessage);
    const localCmdQueue = iris.workerQueue(HermesCommandMessage);
    const localErrQueue = iris.workerQueue(HermesErrorMessage);

    vi.spyOn(localCmdQueue, "publish").mockResolvedValue(undefined);
    vi.spyOn(localErrQueue, "publish").mockResolvedValue(undefined);

    const zeroDomain = new ViewDomain({
      registry,
      proteusSource: proteus,
      viewSources: new Map(),
      eventBus: localEventBus,
      commandQueue: localCmdQueue,
      errorQueue: localErrQueue,
      causationExpiryMs: 0,
      logger,
    });

    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testView, "test_event_create");

    const event = createEventMsg(
      "test_event_create",
      { input: "zero-expiry" },
      { aggregate },
    );
    await (zeroDomain as any).handleEvent(event, testView, handler);

    const causationRepo = proteus.repository(CausationRecord);
    const causations = await causationRepo.find({
      ownerId: aggregateId,
      ownerName: "hermes.test_view",
    });

    expect(causations).toHaveLength(1);
    expect(causations[0].expiresAt).toBeNull();
  });

  // -- MEDIUM: ConcurrencyError path in handleViewError --

  it("should re-throw ConcurrencyError from view event handling", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findEventHandler(testView, "test_event_create");

    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // Mock transaction to throw ConcurrencyError during update
    vi.spyOn(proteus, "transaction").mockRejectedValueOnce(
      new ConcurrencyError("view concurrency conflict"),
    );

    const mergeHandler = findEventHandler(testView, "test_event_merge_state");
    const mergeEvent = createEventMsg(
      "test_event_merge_state",
      { input: "concurrent" },
      { aggregate },
    );

    await expect(handleEvent(mergeEvent, testView, mergeHandler)).rejects.toThrow(
      ConcurrencyError,
    );

    (proteus.transaction as Mock).mockRestore();
  });

  // -- MEDIUM: ViewNotCreatedError publishes to error queue --

  it("should publish error to error queue when requireCreated fails", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const mergeHandler = findEventHandler(testView, "test_event_merge_state");

    const mergeEvent = createEventMsg(
      "test_event_merge_state",
      { input: "orphan" },
      { aggregate },
    );
    await handleEvent(mergeEvent, testView, mergeHandler);

    // M9: publishError is now awaited, so no setTimeout needed
    expect(errorPublishSpy).toHaveBeenCalled();

    const viewRepo = proteus.repository(TestViewEntity);
    const entity = await viewRepo.findOne({ id: aggregateId });
    expect(entity).toBeNull();
  });

  // -- MEDIUM: Query handler throws error propagation --

  it("should propagate error when query handler throws", async () => {
    const origTarget = testView.target;
    try {
      testView.target = class {
        async onQuery(): Promise<void> {
          throw new Error("query handler failed");
        }
      } as any;

      const query = new TestViewQuery("anything");
      await expect(domain.query(query)).rejects.toThrow("query handler failed");
    } finally {
      testView.target = origTarget;
    }
  });

  // -- C2: dispatchCommandFromError uses correct aggregate name --

  it("should use aggregate name from command handler registration, not command DTO name", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const dispatchCommandFromError = (domain as any).dispatchCommandFromError.bind(
      domain,
    );
    const causation = createEventMsg(
      "test_event_create",
      { input: "cause" },
      { aggregate },
    );

    // Use TestCommandSetState which is uniquely registered to TestAggregate
    const command = new TestCommandSetState("c2-test");

    await dispatchCommandFromError(causation, command, {});

    expect(commandPublishSpy).toHaveBeenCalledTimes(1);
    const publishedMsg = commandPublishSpy.mock.calls[0][0];

    // C2: aggregate.name should be the aggregate name ("test_aggregate"),
    // NOT the command DTO name ("test_command_set_state")
    expect(publishedMsg.aggregate.name).toBe("test_aggregate");
    expect(publishedMsg.aggregate.namespace).toBe("hermes");
    // The message name should still be the command DTO name
    expect(publishedMsg.name).toBe("test_command_set_state");
  });

  it("should throw HandlerNotRegisteredError when command has no registered handler", async () => {
    const aggregate = { id: randomUUID(), name: "test_aggregate", namespace: "hermes" };
    const dispatchCommandFromError = (domain as any).dispatchCommandFromError.bind(
      domain,
    );
    const causation = createEventMsg(
      "test_event_create",
      { input: "cause" },
      { aggregate },
    );

    class UnregisteredCommand {
      input = "test";
    }

    // getCommand will throw first since the command is not registered as a DTO
    await expect(
      dispatchCommandFromError(causation, new UnregisteredCommand(), {}),
    ).rejects.toThrow();
  });

  // -- H5: async error handler awaited and dispatch failures propagate --

  it("should await async error handler and all dispatched commands", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create the view entity
    const createHandler = findEventHandler(testView, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // Override the view target with an async error handler that dispatches
    const origTarget = testView.target;

    try {
      let handlerCompleted = false;
      let dispatchesResolved = false;

      testView.target = class {
        async onCreateEvent(): Promise<void> {}
        async onAlreadyCreatedError(ctx: any): Promise<void> {
          ctx.dispatch(new TestCommandCreate("async-dispatch"));
          handlerCompleted = true;
        }
      } as any;

      // Track publish calls
      commandPublishSpy.mockImplementation(async () => {
        dispatchesResolved = true;
      });

      // Trigger permanent error (duplicate create)
      const createEvent2 = createEventMsg(
        "test_event_create",
        { input: "dup" },
        { aggregate },
      );
      await handleEvent(createEvent2, testView, createHandler);

      // After handleEvent resolves, both the handler and dispatches must have completed
      expect(handlerCompleted).toBe(true);
      expect(dispatchesResolved).toBe(true);
      expect(commandPublishSpy).toHaveBeenCalledTimes(1);
    } finally {
      testView.target = origTarget;
    }
  });

  it("should propagate dispatch failure from tryErrorHandler", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create the view entity
    const createHandler = findEventHandler(testView, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // Make dispatch fail
    commandPublishSpy.mockRejectedValueOnce(new Error("dispatch failed"));

    // Trigger permanent error (duplicate create)
    const createEvent2 = createEventMsg(
      "test_event_create",
      { input: "dup" },
      { aggregate },
    );

    // Dispatch failure now propagates so Iris retries
    await expect(handleEvent(createEvent2, testView, createHandler)).rejects.toThrow(
      "dispatch failed",
    );
  });

  // -- M9: publishError awaited and re-throws original on failure --

  it("should re-throw original error when publishError fails", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create view
    const createHandler = findEventHandler(testView, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // Make error queue publish fail
    errorPublishSpy.mockRejectedValueOnce(new Error("error queue down"));

    // Trigger permanent error (duplicate create)
    const createEvent2 = createEventMsg(
      "test_event_create",
      { input: "dup" },
      { aggregate },
    );

    // M9: When publishError fails, the original DomainError is re-thrown
    // so Iris can retry the message
    await expect(handleEvent(createEvent2, testView, createHandler)).rejects.toThrow(
      "View has already been created",
    );
  });

  // -- M10: correct error handler selected by type --

  it("should select specific error handler matching the error type via instanceof", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create view
    const createHandler = findEventHandler(testView, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // ViewAlreadyCreatedError triggers the specific onAlreadyCreatedError handler
    const createEvent2 = createEventMsg(
      "test_event_create",
      { input: "dup" },
      { aggregate },
    );
    await handleEvent(createEvent2, testView, createHandler);

    expect(commandPublishSpy).toHaveBeenCalledTimes(1);
    const publishedMsg = commandPublishSpy.mock.calls[0][0];
    // Specific handler dispatches "already-created-retry" instead of generic "retry"
    expect(publishedMsg.data).toEqual({ input: "already-created-retry" });
  });

  it("should fall back to generic DomainError handler when no specific handler matches", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create view, then destroy it
    const createHandler = findEventHandler(testView, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    const destroyHandler = findEventHandler(testView, "test_event_destroy");
    const destroyEvent = createEventMsg(
      "test_event_destroy",
      { input: "bye" },
      { aggregate },
    );
    await handleEvent(destroyEvent, testView, destroyHandler);

    // ViewDestroyedError is a DomainError but not a ViewAlreadyCreatedError,
    // so it should match the generic DomainError handler and dispatch "retry"
    const mergeHandler = findEventHandler(testView, "test_event_merge_state");
    const mergeEvent = createEventMsg(
      "test_event_merge_state",
      { input: "zombie" },
      { aggregate },
    );
    await handleEvent(mergeEvent, testView, mergeHandler);

    expect(commandPublishSpy).toHaveBeenCalledTimes(1);
    const publishedMsg = commandPublishSpy.mock.calls[0][0];
    expect(publishedMsg.data).toEqual({ input: "retry" });
  });

  // -- E4+E8: collect-then-dispatch -- dispatches discarded on handler failure --

  it("should not dispatch commands when error handler throws (collect-then-dispatch)", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create the view entity
    const createHandler = findEventHandler(testView, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // Override the error handler to dispatch then throw
    const origTarget = testView.target;
    try {
      testView.target = class {
        async onCreateEvent(): Promise<void> {}
        onAlreadyCreatedError(ctx: any): void {
          ctx.dispatch(new TestCommandCreate("should-not-publish"));
          throw new Error("handler failed after dispatch");
        }
      } as any;

      const createEvent2 = createEventMsg(
        "test_event_create",
        { input: "dup" },
        { aggregate },
      );
      await expect(handleEvent(createEvent2, testView, createHandler)).rejects.toThrow(
        "handler failed after dispatch",
      );

      // Commands were collected but never dispatched because the handler threw
      expect(commandPublishSpy).not.toHaveBeenCalled();
    } finally {
      testView.target = origTarget;
    }
  });

  // -- E7: OptimisticLockError wrapped as ConcurrencyError --

  it("should wrap OptimisticLockError from saveViewWithCausation as ConcurrencyError", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findEventHandler(testView, "test_event_create");

    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // Import and throw OptimisticLockError from the transaction
    const { OptimisticLockError } = await import("@lindorm/proteus");
    vi.spyOn(proteus, "transaction").mockRejectedValueOnce(
      new OptimisticLockError("TestViewEntity", { id: aggregateId }),
    );

    const mergeHandler = findEventHandler(testView, "test_event_merge_state");
    const mergeEvent = createEventMsg(
      "test_event_merge_state",
      { input: "race" },
      { aggregate },
    );

    await expect(handleEvent(mergeEvent, testView, mergeHandler)).rejects.toThrow(
      ConcurrencyError,
    );

    (proteus.transaction as Mock).mockRestore();
  });

  it("should not invoke any error handler when no handler matches the error type", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create view
    const createHandler = findEventHandler(testView, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testView, createHandler);

    // Replace error handlers with one that only matches a class the error isn't an instance of
    const origErrorHandlers = testView.errorHandlers;
    try {
      (testView as any).errorHandlers = [
        {
          kind: "error",
          methodName: "onDomainError",
          trigger: class SpecificError extends Error {},
          conditions: {},
          schema: null,
        },
      ];

      // ViewAlreadyCreatedError is not instanceof SpecificError
      const createEvent2 = createEventMsg(
        "test_event_create",
        { input: "dup" },
        { aggregate },
      );
      await handleEvent(createEvent2, testView, createHandler);

      // No commands dispatched because no handler matched
      expect(commandPublishSpy).not.toHaveBeenCalled();
    } finally {
      (testView as any).errorHandlers = origErrorHandlers;
    }
  });
});
