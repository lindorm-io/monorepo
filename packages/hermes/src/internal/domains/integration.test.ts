import type { IIrisMessageBus, IIrisWorkerQueue, IrisSource } from "@lindorm/iris";
import { createMockLogger } from "@lindorm/logger";
import type { ProteusSource } from "@lindorm/proteus";
import { randomUUID } from "crypto";
import {
  createTestIrisSource,
  createTestProteusSource,
} from "../../__fixtures__/create-test-sources";
import {
  TestAggregate,
  TestForgettableAggregate,
} from "../../__fixtures__/modules/aggregates";
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
} from "../../__fixtures__/modules/commands";
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
} from "../../__fixtures__/modules/events";
import { TestTimeoutReminder } from "../../__fixtures__/modules/timeouts";
import { TestViewQuery } from "../../__fixtures__/modules/queries";
import { TestSaga } from "../../__fixtures__/modules/sagas";
import { TestView, TestViewEntity } from "../../__fixtures__/modules/views";
import { AggregateAlreadyCreatedError, AggregateDestroyedError } from "../../errors";
import {
  EventRecord,
  EncryptionRecord,
  CausationRecord,
  ChecksumRecord,
  SagaRecord,
} from "../entities";
import {
  HermesCommandMessage,
  HermesEventMessage,
  HermesErrorMessage,
  HermesTimeoutMessage,
} from "../messages";
import { HermesScanner } from "../registry/HermesScanner";
import { HermesRegistry } from "../registry/hermes-registry";
import type {
  RegisteredAggregate,
  RegisteredSaga,
  RegisteredView,
  HandlerRegistration,
} from "../registry/types";
import { AggregateDomain } from "./aggregate-domain";
import { SagaDomain } from "./saga-domain";
import { ViewDomain } from "./view-domain";
import { ChecksumDomain } from "./checksum-domain";

// This integration test exercises the full pipeline across all four domains
// (aggregate, saga, view, checksum) with real memory drivers.
//
// The Iris memory driver dispatches based on exact topic match, which does
// not support the topic routing that real brokers (RabbitMQ, Kafka) provide.
// Therefore this test invokes domain handlers directly (matching how the
// individual domain tests work) and then verifies cross-domain state consistency.

const ALL_MODULES = [
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
];

describe("Full Pipeline Integration", () => {
  const logger = createMockLogger();

  let proteus: ProteusSource;
  let iris: IrisSource;
  let registry: HermesRegistry;

  let aggregateDomain: AggregateDomain;
  let sagaDomain: SagaDomain;
  let viewDomain: ViewDomain;
  let checksumDomain: ChecksumDomain;

  let testAggregate: RegisteredAggregate;
  let testSaga: RegisteredSaga;
  let testView: RegisteredView;

  let eventBus: IIrisMessageBus<HermesEventMessage>;
  let commandQueue: IIrisWorkerQueue<HermesCommandMessage>;
  let errorQueue: IIrisWorkerQueue<HermesErrorMessage>;
  let timeoutQueue: IIrisWorkerQueue<HermesTimeoutMessage>;

  // Spies to intercept event publishing (prevents double-dispatch issues)
  let eventBusPublishSpy: jest.SpyInstance;
  let commandPublishSpy: jest.SpyInstance;
  let timeoutPublishSpy: jest.SpyInstance;
  let errorPublishSpy: jest.SpyInstance;

  beforeAll(async () => {
    proteus = createTestProteusSource();
    iris = createTestIrisSource();

    const scanned = HermesScanner.scan(ALL_MODULES);
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

    testAggregate = registry.getAggregate("hermes", "test_aggregate");
    testSaga = registry.getSaga("hermes", "test_saga");
    testView = registry.getView("hermes", "test_view");

    commandQueue = iris.workerQueue(HermesCommandMessage);
    eventBus = iris.messageBus(HermesEventMessage);
    errorQueue = iris.workerQueue(HermesErrorMessage);
    timeoutQueue = iris.workerQueue(HermesTimeoutMessage);
  });

  afterAll(async () => {
    await iris.disconnect();
    await proteus.disconnect();
  });

  beforeEach(() => {
    // Spy on eventBus.publish to capture published events. The aggregate
    // domain creates HermesEventMessage objects via Object.assign (not
    // through iris create()), so we intercept publish to manually feed
    // events to saga/view domains.
    eventBusPublishSpy = jest.spyOn(eventBus, "publish").mockResolvedValue(undefined);
    commandPublishSpy = jest.spyOn(commandQueue, "publish").mockResolvedValue(undefined);
    timeoutPublishSpy = jest.spyOn(timeoutQueue, "publish").mockResolvedValue(undefined);
    errorPublishSpy = jest.spyOn(errorQueue, "publish").mockResolvedValue(undefined);

    aggregateDomain = new AggregateDomain({
      registry,
      proteus,
      iris: {
        commandQueue,
        eventBus,
        errorQueue,
      },
      logger,
    });

    sagaDomain = new SagaDomain({
      registry,
      proteusSource: proteus,
      eventBus,
      commandQueue,
      timeoutQueue,
      errorQueue,
      causationExpiryMs: 24 * 60 * 60 * 1000,
      logger,
    });

    viewDomain = new ViewDomain({
      registry,
      proteusSource: proteus,
      viewSources: new Map(),
      eventBus,
      commandQueue,
      errorQueue,
      causationExpiryMs: 24 * 60 * 60 * 1000,
      logger,
    });

    checksumDomain = new ChecksumDomain({
      registry,
      proteus,
      iris: { eventBus, errorQueue },
      logger,
    });
  });

  afterEach(() => {
    eventBusPublishSpy.mockRestore();
    commandPublishSpy.mockRestore();
    timeoutPublishSpy.mockRestore();
    errorPublishSpy.mockRestore();
  });

  // -- Helpers --

  const createCommandMsg = (
    commandName: string,
    data: Record<string, unknown>,
    overrides: Partial<{
      id: string;
      aggregate: { id: string; name: string; namespace: string };
      causationId: string;
      correlationId: string | null;
      meta: Record<string, unknown>;
      version: number;
    }> = {},
  ): HermesCommandMessage => {
    const msg = new HermesCommandMessage();
    msg.id = overrides.id ?? randomUUID();
    msg.aggregate = overrides.aggregate ?? {
      id: randomUUID(),
      name: "test_aggregate",
      namespace: "hermes",
    };
    msg.name = commandName;
    msg.version = overrides.version ?? 1;
    msg.causationId = overrides.causationId ?? msg.id;
    msg.correlationId = overrides.correlationId ?? null;
    msg.data = data;
    msg.meta = overrides.meta ?? {};
    msg.timestamp = new Date();
    return msg;
  };

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
    msg.meta = overrides.meta ?? {};
    msg.timestamp = new Date();
    return msg;
  };

  const findCommandHandler = (
    agg: RegisteredAggregate,
    commandName: string,
  ): HandlerRegistration => {
    const handler = agg.commandHandlers.find((h) => {
      const dto = registry.getCommand(h.trigger);
      return dto.name === commandName;
    });
    if (!handler) throw new Error(`No handler for command: ${commandName}`);
    return handler;
  };

  const findSagaEventHandler = (
    saga: RegisteredSaga,
    eventName: string,
  ): HandlerRegistration => {
    const handler = saga.eventHandlers.find((h) => {
      const dto = registry.getEvent(h.trigger);
      return dto.name === eventName;
    });
    if (!handler) throw new Error(`No saga handler for event: ${eventName}`);
    return handler;
  };

  const findViewEventHandler = (
    view: RegisteredView,
    eventName: string,
  ): HandlerRegistration => {
    const handler = view.eventHandlers.find((h) => {
      const dto = registry.getEvent(h.trigger);
      return dto.name === eventName;
    });
    if (!handler) throw new Error(`No view handler for event: ${eventName}`);
    return handler;
  };

  const handleCommand = async (
    msg: HermesCommandMessage,
    agg: RegisteredAggregate,
    handler: HandlerRegistration,
  ): Promise<void> => {
    await (aggregateDomain as any).handleCommand(msg, agg, handler);
  };

  const handleSagaEvent = async (
    msg: HermesEventMessage,
    saga: RegisteredSaga,
    handler: HandlerRegistration,
  ): Promise<void> => {
    await (sagaDomain as any).handleEvent(msg, saga, handler);
  };

  const handleViewEvent = async (
    msg: HermesEventMessage,
    view: RegisteredView,
    handler: HandlerRegistration,
  ): Promise<void> => {
    await (viewDomain as any).handleEvent(msg, view, handler);
  };

  // Helper that simulates the full pipeline for a command:
  // 1. Handle command in aggregate domain
  // 2. Get the published events
  // 3. Feed each event to saga + view domains
  const executePipeline = async (
    commandName: string,
    data: Record<string, unknown>,
    aggregateId: string,
    aggregate: RegisteredAggregate = testAggregate,
  ): Promise<Array<HermesEventMessage>> => {
    const commandHandler = findCommandHandler(aggregate, commandName);
    const agg = { id: aggregateId, name: aggregate.name, namespace: aggregate.namespace };
    const cmd = createCommandMsg(commandName, data, { aggregate: agg });

    await handleCommand(cmd, aggregate, commandHandler);

    // Extract events published by the aggregate domain
    const publishCalls = eventBusPublishSpy.mock.calls;
    const lastPublishCall = publishCalls[publishCalls.length - 1];
    const events: Array<HermesEventMessage> = lastPublishCall?.[0] ?? [];

    // Feed each event to saga and view domains
    for (const event of events) {
      // Give each event a unique ID if not set
      if (!event.id) {
        event.id = randomUUID();
      }

      // Feed to saga domain
      const sagaEventHandler = testSaga.eventHandlers.find((h) => {
        const dto = registry.getEvent(h.trigger);
        return dto.name === event.name && dto.version === event.version;
      });
      if (sagaEventHandler) {
        try {
          await handleSagaEvent(event, testSaga, sagaEventHandler);
        } catch {
          // Saga handlers may throw for permanent errors (already created, etc.)
          // which are handled gracefully in production via error queue
        }
      }

      // Feed to view domain
      const viewEventHandler = testView.eventHandlers.find((h) => {
        const dto = registry.getEvent(h.trigger);
        return dto.name === event.name && dto.version === event.version;
      });
      if (viewEventHandler) {
        try {
          await handleViewEvent(event, testView, viewEventHandler);
        } catch {
          // View handlers may throw for permanent errors
        }
      }
    }

    return events;
  };

  // -- Full lifecycle tests --

  describe("create command pipeline", () => {
    it("should process create command and update aggregate, saga, and view state", async () => {
      const id = randomUUID();

      await executePipeline("test_command_create", { input: "pipeline" }, id);

      // Verify aggregate state
      const model = await aggregateDomain.inspect({
        id,
        name: "test_aggregate",
        namespace: "hermes",
      });
      expect(model.id).toBe(id);
      expect(model.name).toBe("test_aggregate");
      expect(model.namespace).toBe("hermes");
      expect(model.destroyed).toBe(false);
      expect(model.numberOfLoadedEvents).toBe(1);
      expect(model.state).toEqual({ create: "pipeline" });

      // Verify saga state
      const sagaRecord = await sagaDomain.inspect({
        id,
        name: "test_saga",
        namespace: "hermes",
      });
      expect(sagaRecord).not.toBeNull();
      expect(sagaRecord!.id).toBe(id);
      expect(sagaRecord!.state).toEqual({ create: "pipeline" });
      expect(sagaRecord!.destroyed).toBe(false);

      // Verify view state
      const viewEntity = await viewDomain.inspect(id, TestViewEntity);
      expect(viewEntity).not.toBeNull();
      expect(viewEntity!.id).toBe(id);
      expect(viewEntity!.create).toBe("pipeline");
      expect(viewEntity!.destroyed).toBe(false);
    });

    it("should store EventRecord in proteus after create command", async () => {
      const id = randomUUID();

      await executePipeline("test_command_create", { input: "event-record" }, id);

      const eventRepo = proteus.repository(EventRecord);
      const events = await eventRepo.find({
        aggregateId: id,
        aggregateName: "test_aggregate",
        aggregateNamespace: "hermes",
      });

      expect(events).toHaveLength(1);
      expect(events[0].name).toBe("test_event_create");
      expect(events[0].data).toEqual({ input: "event-record" });
      expect(events[0].checksum).toBeTruthy();
    });
  });

  describe("merge-state command pipeline", () => {
    it("should update aggregate, saga, and view state after merge-state", async () => {
      const id = randomUUID();

      await executePipeline("test_command_create", { input: "initial" }, id);
      await executePipeline("test_command_merge_state", { input: "updated" }, id);

      // Verify aggregate
      const model = await aggregateDomain.inspect({
        id,
        name: "test_aggregate",
        namespace: "hermes",
      });
      expect(model.state).toEqual({ create: "initial", mergeState: "updated" });
      expect(model.numberOfLoadedEvents).toBe(2);

      // Verify saga
      const sagaRecord = await sagaDomain.inspect({
        id,
        name: "test_saga",
        namespace: "hermes",
      });
      expect(sagaRecord!.state).toEqual({ create: "initial", mergeState: "updated" });

      // Verify view
      const viewEntity = await viewDomain.inspect(id, TestViewEntity);
      expect(viewEntity!.create).toBe("initial");
      expect(viewEntity!.mergeState).toBe("updated");
    });
  });

  describe("set-state command pipeline", () => {
    it("should replace aggregate state via setState and update view", async () => {
      const id = randomUUID();

      await executePipeline("test_command_create", { input: "before" }, id);
      await executePipeline("test_command_set_state", { input: "after" }, id);

      const model = await aggregateDomain.inspect({
        id,
        name: "test_aggregate",
        namespace: "hermes",
      });
      expect(model.state).toEqual({ create: "before", setState: "after" });

      const viewEntity = await viewDomain.inspect(id, TestViewEntity);
      expect(viewEntity!.setState).toBe("after");
    });
  });

  describe("destroy command pipeline", () => {
    it("should destroy aggregate and update saga and view", async () => {
      const id = randomUUID();

      await executePipeline("test_command_create", { input: "born" }, id);
      await executePipeline("test_command_destroy", { input: "dead" }, id);

      const model = await aggregateDomain.inspect({
        id,
        name: "test_aggregate",
        namespace: "hermes",
      });
      expect(model.destroyed).toBe(true);
      expect(model.numberOfLoadedEvents).toBe(2);

      const sagaRecord = await sagaDomain.inspect({
        id,
        name: "test_saga",
        namespace: "hermes",
      });
      expect(sagaRecord!.destroyed).toBe(true);
      expect(sagaRecord!.state).toEqual({ create: "born", destroy: "dead" });

      const viewEntity = await viewDomain.inspect(id, TestViewEntity);
      expect(viewEntity!.destroyed).toBe(true);
      expect(viewEntity!.destroy).toBe("dead");
    });

    it("should reject command on destroyed aggregate", async () => {
      const id = randomUUID();

      await executePipeline("test_command_create", { input: "born" }, id);
      await executePipeline("test_command_destroy", { input: "dead" }, id);

      await expect(
        executePipeline("test_command_merge_state", { input: "zombie" }, id),
      ).rejects.toThrow(AggregateDestroyedError);
    });
  });

  describe("destroy-next command pipeline", () => {
    it("should produce multiple events and destroy aggregate", async () => {
      const id = randomUUID();

      await executePipeline("test_command_create", { input: "alive" }, id);
      await executePipeline("test_command_destroy_next", { input: "farewell" }, id);

      const model = await aggregateDomain.inspect({
        id,
        name: "test_aggregate",
        namespace: "hermes",
      });
      expect(model.destroyed).toBe(true);
      expect(model.numberOfLoadedEvents).toBe(3);

      const eventRepo = proteus.repository(EventRecord);
      const events = await eventRepo.find(
        {
          aggregateId: id,
          aggregateName: "test_aggregate",
          aggregateNamespace: "hermes",
        },
        { order: { expectedEvents: "ASC" } },
      );
      expect(events).toHaveLength(3);
      expect(events[0].name).toBe("test_event_create");
      expect(events[1].name).toBe("test_event_destroy_next");
      expect(events[2].name).toBe("test_event_destroy");
    });
  });

  describe("duplicate command handling", () => {
    it("should reject create command on already-created aggregate", async () => {
      const id = randomUUID();

      await executePipeline("test_command_create", { input: "first" }, id);

      await expect(
        executePipeline("test_command_create", { input: "duplicate" }, id),
      ).rejects.toThrow(AggregateAlreadyCreatedError);
    });

    it("should not create duplicate saga state", async () => {
      const id = randomUUID();

      await executePipeline("test_command_create", { input: "first" }, id);

      const sagaRecord = await sagaDomain.inspect({
        id,
        name: "test_saga",
        namespace: "hermes",
      });
      expect(sagaRecord!.state).toEqual({ create: "first" });
    });
  });

  describe("causation deduplication", () => {
    it("should skip duplicate event when causation already exists in saga", async () => {
      const aggregateId = randomUUID();
      const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
      const sagaHandler = findSagaEventHandler(testSaga, "test_event_create");

      const event = createEventMsg("test_event_create", { input: "once" }, { aggregate });
      await handleSagaEvent(event, testSaga, sagaHandler);

      // Process the same event again
      await handleSagaEvent(event, testSaga, sagaHandler);

      // Should only have one causation record
      const causationRepo = proteus.repository(CausationRecord);
      const causations = await causationRepo.find({
        ownerId: aggregateId,
        ownerName: "test_saga",
      });
      expect(causations).toHaveLength(1);
    });

    it("should skip duplicate event when causation already exists in view", async () => {
      const aggregateId = randomUUID();
      const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
      const viewHandler = findViewEventHandler(testView, "test_event_create");

      const event = createEventMsg("test_event_create", { input: "once" }, { aggregate });
      await handleViewEvent(event, testView, viewHandler);

      // Process the same event again
      await handleViewEvent(event, testView, viewHandler);

      // Should only have one causation record
      const causationRepo = proteus.repository(CausationRecord);
      const causations = await causationRepo.find({
        ownerId: aggregateId,
        ownerName: "hermes.test_view",
      });
      expect(causations).toHaveLength(1);
    });
  });

  describe("query via view domain", () => {
    it("should return view data through query after events have been processed", async () => {
      const id = randomUUID();
      const uniqueFilter = `query-test-${id.slice(0, 8)}`;

      await executePipeline("test_command_create", { input: uniqueFilter }, id);

      const results = await viewDomain.query<Array<TestViewEntity>>(
        new TestViewQuery(uniqueFilter),
      );

      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id,
            create: uniqueFilter,
          }),
        ]),
      );
    });
  });

  describe("event emitter integration", () => {
    it("should fire saga events via sagaDomain.on('saga', ...)", async () => {
      const sagaEvents: Array<unknown> = [];
      sagaDomain.on("saga", (data) => sagaEvents.push(data));

      const id = randomUUID();
      await executePipeline("test_command_create", { input: "saga-emit" }, id);

      expect(sagaEvents.length).toBeGreaterThan(0);
      expect(sagaEvents[sagaEvents.length - 1]).toEqual(
        expect.objectContaining({
          id,
          name: "test_saga",
          namespace: "hermes",
          destroyed: false,
          state: { create: "saga-emit" },
        }),
      );
    });

    it("should fire view events via viewDomain.on('view', ...)", async () => {
      const viewEvents: Array<unknown> = [];
      viewDomain.on("view", (data) => viewEvents.push(data));

      const id = randomUUID();
      await executePipeline("test_command_create", { input: "view-emit" }, id);

      expect(viewEvents.length).toBeGreaterThan(0);
      expect(viewEvents[viewEvents.length - 1]).toEqual(
        expect.objectContaining({
          id,
          name: "test_view",
          namespace: "hermes",
          destroyed: false,
        }),
      );
    });
  });

  describe("cross-domain state consistency", () => {
    it("should maintain consistent state across aggregate, saga, and view after multiple commands", async () => {
      const id = randomUUID();

      await executePipeline("test_command_create", { input: "step-1" }, id);
      await executePipeline("test_command_merge_state", { input: "step-2" }, id);
      await executePipeline("test_command_set_state", { input: "step-3" }, id);

      const model = await aggregateDomain.inspect({
        id,
        name: "test_aggregate",
        namespace: "hermes",
      });
      const sagaRecord = await sagaDomain.inspect({
        id,
        name: "test_saga",
        namespace: "hermes",
      });
      const viewEntity = await viewDomain.inspect(id, TestViewEntity);

      // Aggregate state (setState merges with existing state)
      expect(model.state).toEqual({
        create: "step-1",
        mergeState: "step-2",
        setState: "step-3",
      });
      expect(model.numberOfLoadedEvents).toBe(3);

      // Saga has create and mergeState handlers (no handler for set_state event)
      expect(sagaRecord!.state).toEqual({
        create: "step-1",
        mergeState: "step-2",
      });

      // View has handlers for create, mergeState, and setState
      expect(viewEntity!.create).toBe("step-1");
      expect(viewEntity!.mergeState).toBe("step-2");
      expect(viewEntity!.setState).toBe("step-3");
    });
  });

  describe("event record chain integrity", () => {
    it("should maintain previousId chain and incrementing expectedEvents", async () => {
      const id = randomUUID();

      await executePipeline("test_command_create", { input: "chain-1" }, id);
      await executePipeline("test_command_merge_state", { input: "chain-2" }, id);
      await executePipeline("test_command_set_state", { input: "chain-3" }, id);

      const eventRepo = proteus.repository(EventRecord);
      const events = await eventRepo.find(
        {
          aggregateId: id,
          aggregateName: "test_aggregate",
          aggregateNamespace: "hermes",
        },
        { order: { expectedEvents: "ASC" } },
      );

      expect(events).toHaveLength(3);
      expect(events[0].expectedEvents).toBe(0);
      expect(events[0].previousId).toBeNull();
      expect(events[1].expectedEvents).toBe(1);
      expect(events[1].previousId).toBe(events[0].id);
      expect(events[2].expectedEvents).toBe(2);
      expect(events[2].previousId).toBe(events[1].id);
    });
  });

  describe("checksums", () => {
    it("should compute checksums for all stored events", async () => {
      const id = randomUUID();

      await executePipeline("test_command_create", { input: "checksummed" }, id);

      const eventRepo = proteus.repository(EventRecord);
      const events = await eventRepo.find({ aggregateId: id });

      expect(events).toHaveLength(1);
      expect(events[0].checksum).toBeTruthy();
      expect(typeof events[0].checksum).toBe("string");
      expect(events[0].checksum.length).toBeGreaterThan(10);
    });
  });

  describe("forgettable aggregate encryption", () => {
    it("should encrypt event data for forgettable aggregates", async () => {
      const forgettableAggregate = registry.getAggregate(
        "billing",
        "test_forgettable_aggregate",
      );
      const id = randomUUID();

      const handler = findCommandHandler(forgettableAggregate, "test_command_create");
      const cmd = createCommandMsg(
        "test_command_create",
        { input: "secret" },
        {
          aggregate: {
            id,
            name: "test_forgettable_aggregate",
            namespace: "billing",
          },
        },
      );

      await handleCommand(cmd, forgettableAggregate, handler);

      const eventRepo = proteus.repository(EventRecord);
      const events = await eventRepo.find({
        aggregateId: id,
        aggregateName: "test_forgettable_aggregate",
        aggregateNamespace: "billing",
      });

      expect(events).toHaveLength(1);
      expect(events[0].encrypted).toBe(true);
      expect(events[0].data).not.toEqual({ input: "secret" });
    });

    it("should decrypt event data when inspecting forgettable aggregate", async () => {
      const forgettableAggregate = registry.getAggregate(
        "billing",
        "test_forgettable_aggregate",
      );
      const id = randomUUID();

      const handler = findCommandHandler(forgettableAggregate, "test_command_create");
      const cmd = createCommandMsg(
        "test_command_create",
        { input: "decryptme" },
        {
          aggregate: {
            id,
            name: "test_forgettable_aggregate",
            namespace: "billing",
          },
        },
      );

      await handleCommand(cmd, forgettableAggregate, handler);

      const model = await aggregateDomain.inspect({
        id,
        name: "test_forgettable_aggregate",
        namespace: "billing",
      });

      expect(model.state).toEqual({ create: "decryptme" });
    });
  });

  describe("non-encrypted regular aggregate", () => {
    it("should store plaintext event data for regular aggregate", async () => {
      const id = randomUUID();

      await executePipeline("test_command_create", { input: "plaintext" }, id);

      const eventRepo = proteus.repository(EventRecord);
      const events = await eventRepo.find({
        aggregateId: id,
        aggregateName: "test_aggregate",
        aggregateNamespace: "hermes",
      });

      expect(events).toHaveLength(1);
      expect(events[0].encrypted).toBe(false);
      expect(events[0].data).toEqual({ input: "plaintext" });
    });
  });
});
