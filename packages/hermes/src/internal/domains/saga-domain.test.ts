import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { IrisSource } from "@lindorm/iris";
import { DuplicateKeyError, OptimisticLockError } from "@lindorm/proteus";
import type { ProteusSource } from "@lindorm/proteus";
import { randomUUID } from "crypto";
import {
  createTestProteusSource,
  createTestIrisSource,
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
import {
  ConcurrencyError,
  DomainError,
  SagaAlreadyCreatedError,
  SagaDestroyedError,
  SagaNotCreatedError,
} from "../../errors";
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
import type { RegisteredSaga, HandlerRegistration } from "../registry/types";
import { SagaDomain } from "./saga-domain";
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

describe("SagaDomain", () => {
  const logger = createMockLogger();

  let proteus: ProteusSource;
  let iris: IrisSource;
  let registry: HermesRegistry;
  let domain: SagaDomain;
  let testSaga: RegisteredSaga;
  let commandPublishSpy: MockInstance;
  let timeoutPublishSpy: MockInstance;
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

    testSaga = registry.getSaga("hermes", "test_saga");
  });

  afterAll(async () => {
    await iris.disconnect();
    await proteus.disconnect();
  });

  beforeEach(async () => {
    const eventBus = iris.messageBus(HermesEventMessage);
    const commandQueue = iris.workerQueue(HermesCommandMessage);
    const timeoutQueue = iris.workerQueue(HermesTimeoutMessage);
    const errorQueue = iris.workerQueue(HermesErrorMessage);

    commandPublishSpy = vi.spyOn(commandQueue, "publish").mockResolvedValue(undefined);
    timeoutPublishSpy = vi.spyOn(timeoutQueue, "publish").mockResolvedValue(undefined);
    errorPublishSpy = vi.spyOn(errorQueue, "publish").mockResolvedValue(undefined);

    domain = new SagaDomain({
      registry,
      proteusSource: proteus,
      eventBus,
      commandQueue,
      timeoutQueue,
      errorQueue,
      causationExpiryMs: 24 * 60 * 60 * 1000,
      logger,
    });
  });

  afterEach(() => {
    commandPublishSpy.mockRestore();
    timeoutPublishSpy.mockRestore();
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

  const createTimeoutMsg = (
    timeoutName: string,
    data: Record<string, unknown>,
    overrides: Partial<{
      id: string;
      aggregate: { id: string; name: string; namespace: string };
      causationId: string;
      correlationId: string | null;
      meta: Record<string, unknown>;
    }> = {},
  ): HermesTimeoutMessage => {
    const msg = new HermesTimeoutMessage();
    msg.id = overrides.id ?? randomUUID();
    msg.aggregate = overrides.aggregate ?? {
      id: randomUUID(),
      name: "test_saga",
      namespace: "hermes",
    };
    msg.name = timeoutName;
    msg.version = 1;
    msg.causationId = overrides.causationId ?? msg.id;
    msg.correlationId = overrides.correlationId ?? null;
    msg.data = data;
    msg.meta = overrides.meta ?? { origin: "test" };
    msg.timestamp = new Date();
    return msg;
  };

  const findEventHandler = (
    saga: RegisteredSaga,
    eventName: string,
  ): HandlerRegistration => {
    const handler = saga.eventHandlers.find((h) => {
      const dto = registry.getEvent(h.trigger);
      return dto.name === eventName;
    });
    if (!handler) throw new Error(`No handler for event: ${eventName}`);
    return handler;
  };

  const findTimeoutHandler = (
    saga: RegisteredSaga,
    timeoutName: string,
  ): HandlerRegistration => {
    const handler = saga.timeoutHandlers.find((h) => {
      const dto = registry.getTimeout(h.trigger);
      return dto.name === timeoutName;
    });
    if (!handler) throw new Error(`No handler for timeout: ${timeoutName}`);
    return handler;
  };

  const handleEvent = async (
    msg: HermesEventMessage,
    saga: RegisteredSaga,
    handler: HandlerRegistration,
  ): Promise<void> => {
    await (domain as any).handleEvent(msg, saga, handler);
  };

  const handleTimeout = async (
    msg: HermesTimeoutMessage,
    saga: RegisteredSaga,
    handler: HandlerRegistration,
  ): Promise<void> => {
    await (domain as any).handleTimeout(msg, saga, handler);
  };

  // -- Registration --

  it("should have registered event handlers in the saga", () => {
    expect(testSaga.eventHandlers.length).toBeGreaterThan(0);
    expect(testSaga.timeoutHandlers.length).toBeGreaterThan(0);
  });

  it("should subscribe to event topics using aggregate namespace and name, not saga namespace and name", async () => {
    const subscribeSpy = vi
      .spyOn((domain as any).eventBus, "subscribe")
      .mockResolvedValue(undefined);
    const timeoutConsumeSpy = vi
      .spyOn((domain as any).timeoutQueue, "consume")
      .mockResolvedValue(undefined);
    const errorConsumeSpy = vi
      .spyOn((domain as any).errorQueue, "consume")
      .mockResolvedValue(undefined);

    await domain.registerHandlers();

    const subscribeCalls = subscribeSpy.mock.calls;
    expect(subscribeCalls.length).toBeGreaterThan(0);

    for (const [arg] of subscribeCalls) {
      const { topic, queue } = arg as { topic: string; queue: string };
      // Topic must use aggregate identity (test_aggregate), not saga identity (test_saga)
      expect(topic).toMatch(/^hermes\.test_aggregate\./);
      // Queue uses saga identity for consumer isolation
      expect(queue).toMatch(/^queue\.saga\.hermes\.test_saga\./);
    }

    subscribeSpy.mockRestore();
    timeoutConsumeSpy.mockRestore();
    errorConsumeSpy.mockRestore();
  });

  // -- New saga creation --

  it("should handle event for new saga and create SagaRecord", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testSaga, "test_event_create");

    const event = createEventMsg(
      "test_event_create",
      { input: "saga-init" },
      { aggregate },
    );
    await handleEvent(event, testSaga, handler);

    const sagaRepo = proteus.repository(SagaRecord);
    const sagaRecord = await sagaRepo.findOne({
      id: aggregateId,
      name: "test_saga",
      namespace: "hermes",
    });

    expect(sagaRecord).not.toBeNull();
    expect(sagaRecord!.state).toEqual({ create: "saga-init" });
    expect(sagaRecord!.destroyed).toBe(false);
  });

  // -- Causation --

  it("should insert causation record when handling saga event", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testSaga, "test_event_create");

    const event = createEventMsg(
      "test_event_create",
      { input: "causation-check" },
      { aggregate },
    );
    await handleEvent(event, testSaga, handler);

    const causationRepo = proteus.repository(CausationRecord);
    const causations = await causationRepo.find({
      ownerId: aggregateId,
      ownerName: "test_saga",
    });

    expect(causations).toHaveLength(1);
    expect(causations[0].causationId).toBe(event.id);
  });

  // -- Duplicate skipping --

  it("should skip duplicate event when causation already exists", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testSaga, "test_event_create");

    const event = createEventMsg("test_event_create", { input: "first" }, { aggregate });
    await handleEvent(event, testSaga, handler);

    await handleEvent(event, testSaga, handler);

    const causationRepo = proteus.repository(CausationRecord);
    const causations = await causationRepo.find({
      ownerId: aggregateId,
      ownerName: "test_saga",
    });

    expect(causations).toHaveLength(1);
  });

  // -- Saga ID resolution --

  it("should resolve saga ID via @SagaIdHandler", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testSaga, "test_event_create");

    const event = createEventMsg(
      "test_event_create",
      { input: "id-test" },
      { aggregate },
    );
    await handleEvent(event, testSaga, handler);

    const sagaRepo = proteus.repository(SagaRecord);
    const sagaRecord = await sagaRepo.findOne({
      id: aggregateId,
      name: "test_saga",
      namespace: "hermes",
    });

    expect(sagaRecord).not.toBeNull();
    expect(sagaRecord!.id).toBe(aggregateId);
  });

  // -- RequireCreated (permanent domain error published, not rethrown) --

  it("should publish error when requireCreated and saga does not exist", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const mergeHandler = findEventHandler(testSaga, "test_event_merge_state");

    const mergeEvent = createEventMsg(
      "test_event_merge_state",
      { input: "orphan" },
      { aggregate },
    );
    await handleEvent(mergeEvent, testSaga, mergeHandler);

    const sagaRepo = proteus.repository(SagaRecord);
    const sagaRecord = await sagaRepo.findOne({
      id: aggregateId,
      name: "test_saga",
      namespace: "hermes",
    });
    expect(sagaRecord).toBeNull();
  });

  // -- RequireNotCreated (permanent domain error published, not rethrown) --

  it("should publish error when requireNotCreated and saga exists", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findEventHandler(testSaga, "test_event_create");

    const createEvent = createEventMsg(
      "test_event_create",
      { input: "first" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    const createEvent2 = createEventMsg(
      "test_event_create",
      { input: "duplicate" },
      { aggregate },
    );
    await handleEvent(createEvent2, testSaga, createHandler);

    const sagaRepo = proteus.repository(SagaRecord);
    const sagaRecord = await sagaRepo.findOne({
      id: aggregateId,
      name: "test_saga",
      namespace: "hermes",
    });

    expect(sagaRecord!.state).toEqual({ create: "first" });
  });

  // -- Saga model creation from existing record --

  it("should create model from existing record with correct properties", () => {
    const createModel = (domain as any).createModel.bind(domain);
    const identifier = { id: "test-id", name: "test_saga", namespace: "hermes" };

    const record = new SagaRecord();
    record.id = "test-id";
    record.name = "test_saga";
    record.namespace = "hermes";
    record.destroyed = false;
    record.messagesToDispatch = [];
    record.revision = 3;
    record.state = { foo: "bar" };

    const model = createModel(identifier, record, testSaga);

    expect(model.id).toBe("test-id");
    expect(model.name).toBe("test_saga");
    expect(model.namespace).toBe("hermes");
    expect(model.revision).toBe(3);
    expect(model.state).toEqual({ foo: "bar" });
    expect(model.destroyed).toBe(false);
  });

  it("should create model without record as new saga", () => {
    const createModel = (domain as any).createModel.bind(domain);
    const identifier = { id: "new-id", name: "test_saga", namespace: "hermes" };

    const model = createModel(identifier, null, testSaga);

    expect(model.id).toBe("new-id");
    expect(model.name).toBe("test_saga");
    expect(model.revision).toBe(0);
    expect(model.state).toEqual({});
    expect(model.destroyed).toBe(false);
  });

  // -- Condition validation --

  it("should validate requireCreated condition", () => {
    const validateConditions = (domain as any).validateConditions.bind(domain);
    const handler = findEventHandler(testSaga, "test_event_merge_state");

    const createModel = (domain as any).createModel.bind(domain);
    const model = createModel(
      { id: "x", name: "test_saga", namespace: "hermes" },
      null,
      testSaga,
    );

    expect(() => validateConditions(model, handler)).toThrow(SagaNotCreatedError);
  });

  it("should validate requireNotCreated condition", () => {
    const validateConditions = (domain as any).validateConditions.bind(domain);
    const handler = findEventHandler(testSaga, "test_event_create");

    const record = new SagaRecord();
    record.id = "x";
    record.name = "test_saga";
    record.namespace = "hermes";
    record.revision = 1;
    record.state = {};

    const createModel = (domain as any).createModel.bind(domain);
    const model = createModel(
      { id: "x", name: "test_saga", namespace: "hermes" },
      record,
      testSaga,
    );

    expect(() => validateConditions(model, handler)).toThrow(SagaAlreadyCreatedError);
  });

  it("should validate destroyed condition", () => {
    const validateConditions = (domain as any).validateConditions.bind(domain);
    const handler = findEventHandler(testSaga, "test_event_create");

    const record = new SagaRecord();
    record.id = "x";
    record.name = "test_saga";
    record.namespace = "hermes";
    record.revision = 1;
    record.destroyed = true;
    record.state = {};

    const createModel = (domain as any).createModel.bind(domain);
    const model = createModel(
      { id: "x", name: "test_saga", namespace: "hermes" },
      record,
      testSaga,
    );

    expect(() => validateConditions(model, handler)).toThrow(SagaDestroyedError);
  });

  // -- EventEmitter --

  it("should emit saga events via EventEmitter", async () => {
    const emitted: Array<unknown> = [];
    domain.on("saga", (data) => emitted.push(data));

    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testSaga, "test_event_create");

    const event = createEventMsg(
      "test_event_create",
      { input: "emitted" },
      { aggregate },
    );
    await handleEvent(event, testSaga, handler);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(
      expect.objectContaining({
        id: aggregateId,
        name: "test_saga",
        namespace: "hermes",
        destroyed: false,
        state: { create: "emitted" },
      }),
    );
  });

  it("should emit namespaced saga events", async () => {
    const namespacedEmitted: Array<unknown> = [];
    const nameEmitted: Array<unknown> = [];

    domain.on("saga.hermes", (data) => namespacedEmitted.push(data));
    domain.on("saga.hermes.test_saga", (data) => nameEmitted.push(data));

    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testSaga, "test_event_create");

    const event = createEventMsg(
      "test_event_create",
      { input: "namespaced" },
      { aggregate },
    );
    await handleEvent(event, testSaga, handler);

    expect(namespacedEmitted).toHaveLength(1);
    expect(nameEmitted).toHaveLength(1);
  });

  // -- Inspect --

  it("should inspect saga state", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testSaga, "test_event_create");

    const event = createEventMsg(
      "test_event_create",
      { input: "inspectable" },
      { aggregate },
    );
    await handleEvent(event, testSaga, handler);

    const record = await domain.inspect({
      id: aggregateId,
      name: "test_saga",
      namespace: "hermes",
    });

    expect(record).not.toBeNull();
    expect(record!.id).toBe(aggregateId);
    expect(record!.state).toEqual({ create: "inspectable" });
  });

  // -- Saga ID resolution helper --

  it("should resolve saga ID via private resolveSagaId method", () => {
    const resolveSagaId = (domain as any).resolveSagaId.bind(domain);

    const msg = createEventMsg(
      "test_event_create",
      { input: "test" },
      { aggregate: { id: "agg-123", name: "test_aggregate", namespace: "hermes" } },
    );

    const event = new TestEventCreate("test");
    const sagaId = resolveSagaId(msg, event, testSaga);

    // TestSaga @SagaIdHandler(TestEventCreate) returns ctx.aggregate.id
    expect(sagaId).toBe("agg-123");
  });

  it("should default saga ID to aggregate.id when no ID handler for event", () => {
    const resolveSagaId = (domain as any).resolveSagaId.bind(domain);

    const msg = createEventMsg(
      "test_event_merge_state",
      { input: "test" },
      { aggregate: { id: "agg-456", name: "test_aggregate", namespace: "hermes" } },
    );

    const event = new TestEventMergeState("test");
    const sagaId = resolveSagaId(msg, event, testSaga);

    expect(sagaId).toBe("agg-456");
  });

  // -- DTO hydration --

  it("should hydrate DTO from event data", () => {
    const hydrateDto = (domain as any).hydrateDto.bind(domain);

    const dto = hydrateDto(TestEventCreate, { input: "hydrated" });
    expect(dto).toBeInstanceOf(TestEventCreate);
    expect(dto.input).toBe("hydrated");
  });

  // -- Permanent error handling (H3) --

  it("should publish error and acknowledge when permanent domain error occurs and publish succeeds", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const mergeHandler = findEventHandler(testSaga, "test_event_merge_state");

    // requireCreated throws SagaNotCreatedError which is permanent
    const event = createEventMsg(
      "test_event_merge_state",
      { input: "orphan" },
      { aggregate },
    );
    await handleEvent(event, testSaga, mergeHandler);

    // Error was published (not swallowed)
    expect(errorPublishSpy).toHaveBeenCalledTimes(1);
  });

  it("should re-throw permanent domain error when error publish fails", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const mergeHandler = findEventHandler(testSaga, "test_event_merge_state");

    errorPublishSpy.mockRejectedValueOnce(new Error("publish failed"));

    const event = createEventMsg(
      "test_event_merge_state",
      { input: "orphan" },
      { aggregate },
    );
    await expect(handleEvent(event, testSaga, mergeHandler)).rejects.toThrow(
      SagaNotCreatedError,
    );
  });

  // -- Dispatch round-trip (M1) --

  it("should publish dispatched commands after saga event handler dispatches", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // First create the saga
    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    // Then handle an event whose handler dispatches a command
    const dispatchHandler = findEventHandler(testSaga, "test_event_dispatch");
    const dispatchEvent = createEventMsg(
      "test_event_dispatch",
      { input: "dispatch-trigger" },
      { aggregate },
    );
    await handleEvent(dispatchEvent, testSaga, dispatchHandler);

    // Verify command was published
    expect(commandPublishSpy).toHaveBeenCalledTimes(1);

    // Verify messagesToDispatch is cleared in the saga record
    const sagaRepo = proteus.repository(SagaRecord);
    const sagaRecord = await sagaRepo.findOne({
      id: aggregateId,
      name: "test_saga",
      namespace: "hermes",
    });
    expect(sagaRecord).not.toBeNull();
    expect(sagaRecord!.messagesToDispatch).toEqual([]);
    expect(sagaRecord!.state).toEqual({ create: "init", dispatch: "dispatch-trigger" });
  });

  // -- Handler error propagation (M2) --

  it("should propagate non-domain errors from saga event handler", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // First create the saga
    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    // Then handle an event whose handler throws a non-domain Error
    const throwsHandler = findEventHandler(testSaga, "test_event_throws");
    const throwsEvent = createEventMsg(
      "test_event_throws",
      { input: "boom" },
      { aggregate },
    );
    await expect(handleEvent(throwsEvent, testSaga, throwsHandler)).rejects.toThrow(
      "boom",
    );

    // Verify no commands were published
    expect(commandPublishSpy).not.toHaveBeenCalled();

    // Verify saga state was not changed by the throws handler
    const sagaRepo = proteus.repository(SagaRecord);
    const sagaRecord = await sagaRepo.findOne({
      id: aggregateId,
      name: "test_saga",
      namespace: "hermes",
    });
    expect(sagaRecord!.state).toEqual({ create: "init" });
  });

  // -- Timeout handler round-trip (U4) --

  it("should handle timeout and update saga state", async () => {
    const sagaId = randomUUID();
    const aggregate = { id: sagaId, name: "test_aggregate", namespace: "hermes" };

    // First create the saga via event
    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "pre-timeout" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    // Then handle a timeout
    const timeoutHandler = findTimeoutHandler(testSaga, "test_timeout_reminder");
    const timeoutMsg = createTimeoutMsg(
      "test_timeout_reminder",
      { data: "reminder" },
      { aggregate: { id: sagaId, name: "test_saga", namespace: "hermes" } },
    );
    await handleTimeout(timeoutMsg, testSaga, timeoutHandler);

    // Verify the saga state was updated by the timeout handler
    const sagaRepo = proteus.repository(SagaRecord);
    const sagaRecord = await sagaRepo.findOne({
      id: sagaId,
      name: "test_saga",
      namespace: "hermes",
    });

    expect(sagaRecord).not.toBeNull();
    expect(sagaRecord!.state).toEqual({ create: "pre-timeout", timeout: true });
  });

  it("should insert causation record when handling timeout", async () => {
    const sagaId = randomUUID();
    const aggregate = { id: sagaId, name: "test_aggregate", namespace: "hermes" };

    // Create saga first
    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "timeout-causation" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    // Handle timeout
    const timeoutHandler = findTimeoutHandler(testSaga, "test_timeout_reminder");
    const timeoutMsg = createTimeoutMsg(
      "test_timeout_reminder",
      { data: "causation-check" },
      { aggregate: { id: sagaId, name: "test_saga", namespace: "hermes" } },
    );
    await handleTimeout(timeoutMsg, testSaga, timeoutHandler);

    // Verify causation was recorded
    const causationRepo = proteus.repository(CausationRecord);
    const causations = await causationRepo.find({
      ownerId: sagaId,
      ownerName: "test_saga",
    });

    // 2 causations: one from create event, one from timeout
    expect(causations).toHaveLength(2);
    expect(causations.map((c) => c.causationId)).toContain(timeoutMsg.id);
  });

  // -- EventEmitter cleanup (H1) --

  it("should remove listener via off()", () => {
    const listener = vi.fn();
    domain.on("saga", listener);
    domain.off("saga", listener);
    // Verify the listener was removed by triggering an emit and checking it's not called
    (domain as any).eventEmitter.emit("saga", {
      id: "test",
      name: "test",
      namespace: "test",
      destroyed: false,
      state: {},
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it("should remove all listeners via removeAllListeners()", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    domain.on("saga", listener1);
    domain.on("saga.hermes", listener2);

    domain.removeAllListeners();

    (domain as any).eventEmitter.emit("saga", {
      id: "test",
      name: "test",
      namespace: "test",
      destroyed: false,
      state: {},
    });
    (domain as any).eventEmitter.emit("saga.hermes", {
      id: "test",
      name: "test",
      namespace: "test",
      destroyed: false,
      state: {},
    });

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });

  // -- C2: Saga recovery sweep with pending messages --

  it("should recover and publish pending messages from a previous partial failure before processing new event", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // First create the saga normally
    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    // Simulate a previous partial failure: insert pending messages directly into the saga record
    const sagaRepo = proteus.repository(SagaRecord);
    const sagaRecord = await sagaRepo.findOne({
      id: aggregateId,
      name: "test_saga",
      namespace: "hermes",
    });
    expect(sagaRecord).not.toBeNull();

    // Construct a pending command message that was not published (SagaPendingMessage format)
    const pendingCommand = {
      kind: "command" as const,
      data: {
        name: "test_command_merge_state",
        data: { input: "recovered" },
        aggregate: { id: aggregateId, name: "test_aggregate", namespace: "hermes" },
        causationId: randomUUID(),
        correlationId: null,
        meta: {},
        version: 1,
      },
    };

    sagaRecord!.messagesToDispatch = [pendingCommand];
    await sagaRepo.save(sagaRecord!);

    // Now handle a new event for the saga. Recovery sweep should detect
    // the pending messages and publish them BEFORE processing the new event.
    const dispatchHandler = findEventHandler(testSaga, "test_event_dispatch");
    const dispatchEvent = createEventMsg(
      "test_event_dispatch",
      { input: "new-event" },
      { aggregate },
    );
    await handleEvent(dispatchEvent, testSaga, dispatchHandler);

    // The pending command should have been published first (recovery sweep)
    // plus the command dispatched by the dispatch handler itself
    expect(commandPublishSpy).toHaveBeenCalledTimes(2);

    // Verify messagesToDispatch is cleared
    const updatedRecord = await sagaRepo.findOne({
      id: aggregateId,
      name: "test_saga",
      namespace: "hermes",
    });
    expect(updatedRecord!.messagesToDispatch).toEqual([]);
  });

  // -- H7: Timeout on destroyed saga --

  it("should handle timeout on destroyed saga as permanent error", async () => {
    const sagaId = randomUUID();
    const aggregate = { id: sagaId, name: "test_aggregate", namespace: "hermes" };

    // Create and then destroy the saga
    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "born" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    const destroyHandler = findEventHandler(testSaga, "test_event_destroy");
    const destroyEvent = createEventMsg(
      "test_event_destroy",
      { input: "dead" },
      { aggregate },
    );
    await handleEvent(destroyEvent, testSaga, destroyHandler);

    // Now handle a timeout -- saga is destroyed, should throw SagaDestroyedError
    // which is a permanent DomainError, so it gets published to error queue
    const timeoutHandler = findTimeoutHandler(testSaga, "test_timeout_reminder");
    const timeoutMsg = createTimeoutMsg(
      "test_timeout_reminder",
      { data: "too-late" },
      { aggregate: { id: sagaId, name: "test_saga", namespace: "hermes" } },
    );

    // SagaDestroyedError is permanent, published to error queue, not rethrown
    await handleTimeout(timeoutMsg, testSaga, timeoutHandler);

    // Verify error was published
    expect(errorPublishSpy).toHaveBeenCalledTimes(1);
  });

  // -- H8: Timeout error paths --

  it("should re-throw ConcurrencyError from timeout handler", async () => {
    const sagaId = randomUUID();
    const aggregate = { id: sagaId, name: "test_aggregate", namespace: "hermes" };

    // Create the saga
    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    // Mock the proteus transaction to throw ConcurrencyError during save
    vi.spyOn(proteus, "transaction").mockRejectedValueOnce(
      new ConcurrencyError("saga concurrency conflict"),
    );

    const timeoutHandler = findTimeoutHandler(testSaga, "test_timeout_reminder");
    const timeoutMsg = createTimeoutMsg(
      "test_timeout_reminder",
      { data: "concurrent" },
      { aggregate: { id: sagaId, name: "test_saga", namespace: "hermes" } },
    );

    await expect(handleTimeout(timeoutMsg, testSaga, timeoutHandler)).rejects.toThrow(
      ConcurrencyError,
    );

    (proteus.transaction as Mock).mockRestore();
  });

  it("should publish error and acknowledge when timeout handler throws permanent DomainError", async () => {
    const sagaId = randomUUID();
    const aggregate = { id: sagaId, name: "test_aggregate", namespace: "hermes" };

    // Create the saga
    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    const timeoutHandler = findTimeoutHandler(testSaga, "test_timeout_reminder");

    // Override target to a class whose onTimeout throws permanent DomainError
    const origTarget = testSaga.target;
    testSaga.target = class {
      async onTimeout(): Promise<void> {
        throw new DomainError("permanent timeout failure", { permanent: true });
      }
    } as any;

    const timeoutMsg = createTimeoutMsg(
      "test_timeout_reminder",
      { data: "permanent" },
      { aggregate: { id: sagaId, name: "test_saga", namespace: "hermes" } },
    );

    // Permanent DomainError should be published and acknowledged (not rethrown)
    await handleTimeout(timeoutMsg, testSaga, timeoutHandler);
    expect(errorPublishSpy).toHaveBeenCalled();

    testSaga.target = origTarget;
  });

  it("should re-throw generic error from timeout handler", async () => {
    const sagaId = randomUUID();
    const aggregate = { id: sagaId, name: "test_aggregate", namespace: "hermes" };

    // Create the saga
    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    const timeoutHandler = findTimeoutHandler(testSaga, "test_timeout_reminder");

    // Override target to a class whose onTimeout throws a generic Error
    const origTarget = testSaga.target;
    testSaga.target = class {
      async onTimeout(): Promise<void> {
        throw new Error("generic timeout failure");
      }
    } as any;

    const timeoutMsg = createTimeoutMsg(
      "test_timeout_reminder",
      { data: "generic" },
      { aggregate: { id: sagaId, name: "test_saga", namespace: "hermes" } },
    );

    await expect(handleTimeout(timeoutMsg, testSaga, timeoutHandler)).rejects.toThrow(
      "generic timeout failure",
    );

    testSaga.target = origTarget;
  });

  // -- H9: saveWithCausation record not found on update --

  it("should throw error when saga record not found during update in saveWithCausation", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create the saga first
    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    // Intercept the transaction so that txSagaRepo.findOne returns null
    // (simulating the record being deleted between load and save)
    const origTransaction = proteus.transaction.bind(proteus);
    vi.spyOn(proteus, "transaction").mockImplementation(async (fn: any) => {
      return origTransaction(async (tx: any) => {
        const origRepo = tx.repository.bind(tx);
        vi.spyOn(tx, "repository").mockImplementation((entity: any) => {
          const repo = origRepo(entity);
          if (entity === SagaRecord) {
            const origFindOne = repo.findOne.bind(repo);
            vi.spyOn(repo, "findOne").mockResolvedValue(null);
          }
          return repo;
        });
        return fn(tx);
      });
    });

    const mergeHandler = findEventHandler(testSaga, "test_event_merge_state");
    const mergeEvent = createEventMsg(
      "test_event_merge_state",
      { input: "orphan" },
      { aggregate },
    );

    // The error from saveWithCausation is caught by handleDomainError which re-throws
    // non-domain errors
    await expect(handleEvent(mergeEvent, testSaga, mergeHandler)).rejects.toThrow(
      /Saga record not found for update/,
    );

    (proteus.transaction as Mock).mockRestore();
  });

  // -- MEDIUM: causation expiry null path (expiryMs = 0) --

  it("should set causation expiresAt to null when causationExpiryMs is 0", async () => {
    const localEventBus = iris.messageBus(HermesEventMessage);
    const localCmdQueue = iris.workerQueue(HermesCommandMessage);
    const localTimeoutQueue = iris.workerQueue(HermesTimeoutMessage);
    const localErrQueue = iris.workerQueue(HermesErrorMessage);

    vi.spyOn(localCmdQueue, "publish").mockResolvedValue(undefined);
    vi.spyOn(localTimeoutQueue, "publish").mockResolvedValue(undefined);
    vi.spyOn(localErrQueue, "publish").mockResolvedValue(undefined);

    const zeroDomain = new SagaDomain({
      registry,
      proteusSource: proteus,
      eventBus: localEventBus,
      commandQueue: localCmdQueue,
      timeoutQueue: localTimeoutQueue,
      errorQueue: localErrQueue,
      causationExpiryMs: 0,
      logger,
    });

    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findEventHandler(testSaga, "test_event_create");

    const event = createEventMsg(
      "test_event_create",
      { input: "no-expiry" },
      { aggregate },
    );
    await (zeroDomain as any).handleEvent(event, testSaga, handler);

    const causationRepo = proteus.repository(CausationRecord);
    const causations = await causationRepo.find({
      ownerId: aggregateId,
      ownerName: "test_saga",
    });

    expect(causations).toHaveLength(1);
    expect(causations[0].expiresAt).toBeNull();
  });

  // -- MEDIUM: Non-domain error propagation without error publish --

  it("should propagate non-domain error with original message and not publish error", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    const throwsHandler = findEventHandler(testSaga, "test_event_throws");
    const throwsEvent = createEventMsg(
      "test_event_throws",
      { input: "specific error text" },
      { aggregate },
    );

    await expect(handleEvent(throwsEvent, testSaga, throwsHandler)).rejects.toThrow(
      "specific error text",
    );

    expect(errorPublishSpy).not.toHaveBeenCalled();
  });

  // -- MEDIUM: Recovery sweep skipped for empty messagesToDispatch --

  it("should skip recovery when saga has empty messagesToDispatch", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "no-pending" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    expect(commandPublishSpy).not.toHaveBeenCalled();

    commandPublishSpy.mockClear();
    const dispatchHandler = findEventHandler(testSaga, "test_event_dispatch");
    const dispatchEvent = createEventMsg(
      "test_event_dispatch",
      { input: "dispatch" },
      { aggregate },
    );
    await handleEvent(dispatchEvent, testSaga, dispatchHandler);

    // Only the dispatched command from the handler, no recovery
    expect(commandPublishSpy).toHaveBeenCalledTimes(1);
  });

  // -- MEDIUM: publishAllMessages command with delay --

  it("should pass delay option when publishing dispatched command with delay", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // TestSaga.onMergeStateEvent dispatches with delay: 100
    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    const mergeHandler = findEventHandler(testSaga, "test_event_merge_state");
    const mergeEvent = createEventMsg(
      "test_event_merge_state",
      { input: "delayed" },
      { aggregate },
    );
    await handleEvent(mergeEvent, testSaga, mergeHandler);

    expect(commandPublishSpy).toHaveBeenCalledTimes(1);
    const publishArgs = commandPublishSpy.mock.calls[0];
    expect(publishArgs[1]).toEqual({ delay: 100 });
  });

  // -- MEDIUM: handleDomainError ConcurrencyError path --

  it("should re-throw ConcurrencyError from saga event handling", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    // Mock transaction to throw ConcurrencyError during save
    vi.spyOn(proteus, "transaction").mockRejectedValueOnce(
      new ConcurrencyError("saga concurrency"),
    );

    const dispatchHandler = findEventHandler(testSaga, "test_event_dispatch");
    const dispatchEvent = createEventMsg(
      "test_event_dispatch",
      { input: "concurrent" },
      { aggregate },
    );

    await expect(handleEvent(dispatchEvent, testSaga, dispatchHandler)).rejects.toThrow(
      ConcurrencyError,
    );

    (proteus.transaction as Mock).mockRestore();
  });

  // -- C1: Saga error handler registration and invocation --

  it("should invoke saga error handler when error message is received", async () => {
    const handleError = (domain as any).handleError.bind(domain);

    const errorHandler = testSaga.errorHandlers.find((h) => h.trigger === DomainError);
    expect(errorHandler).toBeDefined();

    const errorMsg = new HermesErrorMessage();
    errorMsg.id = randomUUID();
    errorMsg.aggregate = {
      id: randomUUID(),
      name: "test_aggregate",
      namespace: "hermes",
    };
    errorMsg.name = "domain_error";
    errorMsg.version = 1;
    errorMsg.causationId = randomUUID();
    errorMsg.correlationId = null;
    errorMsg.data = { error: { message: "saga test error", name: "DomainError" } };
    errorMsg.meta = { origin: "test" };
    errorMsg.timestamp = new Date();

    await handleError(errorMsg, testSaga, errorHandler!);

    // TestSaga.onDomainError dispatches TestCommandCreate("recovery")
    expect(commandPublishSpy).toHaveBeenCalledTimes(1);
  });

  it("should register error handlers in registerHandlers", async () => {
    const errorConsumeSpy = vi
      .spyOn((domain as any).errorQueue, "consume")
      .mockResolvedValue(undefined);

    await domain.registerHandlers();

    // Should have been called at least once for the DomainError handler
    const errorCalls = errorConsumeSpy.mock.calls.filter((call) => {
      const arg = call[0];
      return typeof arg === "object" && (arg as any).queue?.includes("queue.saga.error.");
    });
    expect(errorCalls.length).toBeGreaterThan(0);

    errorConsumeSpy.mockRestore();
  });

  // -- C3: clearMessages uses version check --

  it("should skip clearMessages when saga revision changed during publish", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Create the saga
    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    // Get the saga record and manually bump its revision to simulate concurrent modification
    const sagaRepo = proteus.repository(SagaRecord);
    const origFindOne = sagaRepo.findOne.bind(sagaRepo);
    let findOneCallCount = 0;

    vi.spyOn(sagaRepo, "findOne").mockImplementation(async (criteria?: any) => {
      findOneCallCount++;
      const result = await origFindOne(criteria);
      // On the 3rd call (the post-publish re-load in publishMessages),
      // return a record with a bumped revision to simulate concurrent write
      if (findOneCallCount === 3 && result) {
        result.revision = result.revision + 5;
      }
      return result;
    });

    const dispatchHandler = findEventHandler(testSaga, "test_event_dispatch");
    const dispatchEvent = createEventMsg(
      "test_event_dispatch",
      { input: "concurrent" },
      { aggregate },
    );
    await handleEvent(dispatchEvent, testSaga, dispatchHandler);

    // Command was still published
    expect(commandPublishSpy).toHaveBeenCalledTimes(1);

    (sagaRepo.findOne as Mock).mockRestore();
  });

  // -- C5: DuplicateKeyError on concurrent saga creation --

  it("should wrap DuplicateKeyError as ConcurrencyError for concurrent saga creation", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findEventHandler(testSaga, "test_event_create");

    // Mock the proteus transaction to throw DuplicateKeyError (simulating concurrent insert)
    vi.spyOn(proteus, "transaction").mockRejectedValueOnce(
      new DuplicateKeyError("unique constraint violation"),
    );

    const event = createEventMsg(
      "test_event_create",
      { input: "concurrent" },
      { aggregate },
    );

    // handleDomainError catches ConcurrencyError and re-throws it
    await expect(handleEvent(event, testSaga, createHandler)).rejects.toThrow(
      ConcurrencyError,
    );

    (proteus.transaction as Mock).mockRestore();
  });

  it("should not wrap DuplicateKeyError as ConcurrencyError for saga update path", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // First create the saga normally
    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    // Now mock transaction to throw DuplicateKeyError on update (not insert)
    vi.spyOn(proteus, "transaction").mockRejectedValueOnce(
      new DuplicateKeyError("unique constraint violation on update"),
    );

    const dispatchHandler = findEventHandler(testSaga, "test_event_dispatch");
    const dispatchEvent = createEventMsg(
      "test_event_dispatch",
      { input: "update" },
      { aggregate },
    );

    // On update path, DuplicateKeyError should NOT be wrapped as ConcurrencyError
    await expect(handleEvent(dispatchEvent, testSaga, dispatchHandler)).rejects.toThrow(
      DuplicateKeyError,
    );

    (proteus.transaction as Mock).mockRestore();
  });

  // -- G3: publishAllMessages command/timeout discrimination with SagaPendingMessage --

  it("should publish commands and timeouts correctly from typed SagaPendingMessage structure", async () => {
    const publishAll = (domain as any).publishAllMessages.bind(domain);

    const pendingMessages = [
      {
        kind: "command" as const,
        data: {
          aggregate: { id: "agg-1", name: "test_aggregate", namespace: "hermes" },
          causationId: "cause-1",
          correlationId: null,
          data: { input: "cmd-data" },
          meta: {},
          name: "test_command_merge_state",
          version: 1,
        },
      },
      {
        kind: "timeout" as const,
        data: {
          aggregate: { id: "agg-2", name: "test_saga", namespace: "hermes" },
          causationId: "cause-2",
          correlationId: null,
          data: { reminder: true },
          meta: {},
          name: "reminder_timeout",
        },
        delay: 5000,
      },
      {
        kind: "command" as const,
        data: {
          aggregate: { id: "agg-3", name: "test_aggregate", namespace: "hermes" },
          causationId: "cause-3",
          correlationId: null,
          data: { input: "delayed-cmd" },
          meta: {},
          name: "test_command_create",
          version: 1,
        },
        delay: 200,
      },
    ];

    await publishAll(pendingMessages);

    // Two commands published
    expect(commandPublishSpy).toHaveBeenCalledTimes(2);
    // First command: no delay
    expect(commandPublishSpy.mock.calls[0][1]).toBeUndefined();
    // Second command: with delay
    expect(commandPublishSpy.mock.calls[1][1]).toEqual({ delay: 200 });

    // One timeout published with delay
    expect(timeoutPublishSpy).toHaveBeenCalledTimes(1);
    expect(timeoutPublishSpy.mock.calls[0][1]).toEqual({ delay: 5000 });
  });

  // -- E7: OptimisticLockError wrapped as ConcurrencyError on saga update --

  it("should wrap OptimisticLockError as ConcurrencyError for saga update path", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // First create the saga normally
    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    // Mock transaction to throw OptimisticLockError on update
    vi.spyOn(proteus, "transaction").mockRejectedValueOnce(
      new OptimisticLockError("saga", { id: aggregateId }),
    );

    const dispatchHandler = findEventHandler(testSaga, "test_event_dispatch");
    const dispatchEvent = createEventMsg(
      "test_event_dispatch",
      { input: "update" },
      { aggregate },
    );

    // On update path, OptimisticLockError should be wrapped as ConcurrencyError
    await expect(handleEvent(dispatchEvent, testSaga, dispatchHandler)).rejects.toThrow(
      ConcurrencyError,
    );

    (proteus.transaction as Mock).mockRestore();
  });

  it("should not wrap OptimisticLockError as ConcurrencyError for new saga creation", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Mock transaction to throw OptimisticLockError on insert (unusual but should not wrap)
    vi.spyOn(proteus, "transaction").mockRejectedValueOnce(
      new OptimisticLockError("saga", { id: aggregateId }),
    );

    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );

    // On isNew path, OptimisticLockError should NOT be wrapped (only DuplicateKeyError is wrapped for new)
    await expect(handleEvent(createEvent, testSaga, createHandler)).rejects.toThrow(
      OptimisticLockError,
    );

    (proteus.transaction as Mock).mockRestore();
  });

  // -- E8: Saga error handler failures propagate (not swallowed) --

  it("should propagate error when saga error handler throws", async () => {
    const handleError = (domain as any).handleError.bind(domain);

    const errorHandler = testSaga.errorHandlers.find((h) => h.trigger === DomainError);
    expect(errorHandler).toBeDefined();

    // Override target to a class whose error handler throws
    const origTarget = testSaga.target;
    testSaga.target = class {
      async onDomainError(): Promise<void> {
        throw new Error("error handler crashed");
      }
    } as any;

    const errorMsg = new HermesErrorMessage();
    errorMsg.id = randomUUID();
    errorMsg.aggregate = {
      id: randomUUID(),
      name: "test_aggregate",
      namespace: "hermes",
    };
    errorMsg.name = "domain_error";
    errorMsg.version = 1;
    errorMsg.causationId = randomUUID();
    errorMsg.correlationId = null;
    errorMsg.data = { error: { message: "underlying error", name: "DomainError" } };
    errorMsg.meta = { origin: "test" };
    errorMsg.timestamp = new Date();

    await expect(handleError(errorMsg, testSaga, errorHandler!)).rejects.toThrow(
      "error handler crashed",
    );

    // Verify no commands were dispatched (collect-then-dispatch: handler failed, dispatches discarded)
    expect(commandPublishSpy).not.toHaveBeenCalled();

    testSaga.target = origTarget;
  });

  it("should not dispatch commands when error handler throws (collect-then-dispatch)", async () => {
    const handleError = (domain as any).handleError.bind(domain);

    const errorHandler = testSaga.errorHandlers.find((h) => h.trigger === DomainError);
    expect(errorHandler).toBeDefined();

    // Override target: dispatch a command, then throw
    const origTarget = testSaga.target;
    testSaga.target = class {
      async onDomainError(ctx: any): Promise<void> {
        ctx.dispatch(new TestCommandCreate("recovery-attempt"));
        throw new Error("handler failed after dispatch");
      }
    } as any;

    const errorMsg = new HermesErrorMessage();
    errorMsg.id = randomUUID();
    errorMsg.aggregate = {
      id: randomUUID(),
      name: "test_aggregate",
      namespace: "hermes",
    };
    errorMsg.name = "domain_error";
    errorMsg.version = 1;
    errorMsg.causationId = randomUUID();
    errorMsg.correlationId = null;
    errorMsg.data = { error: { message: "test error", name: "DomainError" } };
    errorMsg.meta = {};
    errorMsg.timestamp = new Date();

    await expect(handleError(errorMsg, testSaga, errorHandler!)).rejects.toThrow(
      "handler failed after dispatch",
    );

    // Even though dispatch() was called before the throw, the collect-then-dispatch
    // pattern means commands are only published AFTER handler succeeds
    expect(commandPublishSpy).not.toHaveBeenCalled();

    testSaga.target = origTarget;
  });

  // -- MEDIUM: publishMessages clearMessages with null record --

  it("should still call model.clearMessages when loadSaga returns null after publish", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const createHandler = findEventHandler(testSaga, "test_event_create");
    const createEvent = createEventMsg(
      "test_event_create",
      { input: "init" },
      { aggregate },
    );
    await handleEvent(createEvent, testSaga, createHandler);

    // After save, the publishMessages path re-loads the saga to clear messages.
    // We need to intercept loadSaga to return null after publishing.
    // We'll use a roundabout spy that counts calls.
    const sagaRepo = proteus.repository(SagaRecord);
    let findOneCallCount = 0;
    const origFindOne = sagaRepo.findOne.bind(sagaRepo);
    vi.spyOn(sagaRepo, "findOne").mockImplementation(async (criteria?: any) => {
      findOneCallCount++;
      if (findOneCallCount > 2) return null;
      return origFindOne(criteria);
    });

    const dispatchHandler = findEventHandler(testSaga, "test_event_dispatch");
    const dispatchEvent = createEventMsg(
      "test_event_dispatch",
      { input: "null-record" },
      { aggregate },
    );
    await handleEvent(dispatchEvent, testSaga, dispatchHandler);

    // Command was still published
    expect(commandPublishSpy).toHaveBeenCalledTimes(1);

    (sagaRepo.findOne as Mock).mockRestore();
  });
});
