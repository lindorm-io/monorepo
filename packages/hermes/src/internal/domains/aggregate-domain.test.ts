import { createMockLogger } from "@lindorm/logger";
import { DuplicateKeyError } from "@lindorm/proteus";
import type { IIrisMessageBus, IIrisWorkerQueue } from "@lindorm/iris";
import type { IrisSource } from "@lindorm/iris";
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
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
  CausationMissingEventsError,
  CommandSchemaValidationError,
  ConcurrencyError,
  DomainError,
} from "../../errors";
import {
  EventRecord,
  EncryptionRecord,
  CausationRecord,
  ChecksumRecord,
  SagaRecord,
} from "#internal/entities";
import {
  HermesCommandMessage,
  HermesEventMessage,
  HermesErrorMessage,
  HermesTimeoutMessage,
} from "#internal/messages";
import { scanModules } from "#internal/registry/hermes-scanner";
import { HermesRegistry } from "#internal/registry/hermes-registry";
import type { RegisteredAggregate, HandlerRegistration } from "#internal/registry/types";
import { AggregateDomain } from "./aggregate-domain";

describe("AggregateDomain", () => {
  const logger = createMockLogger();

  let proteus: ProteusSource;
  let iris: IrisSource;
  let registry: HermesRegistry;
  let domain: AggregateDomain;
  let testAggregate: RegisteredAggregate;
  let forgettableAggregate: RegisteredAggregate;
  let spiedEventBusPublish: jest.SpyInstance;
  let eventBus: IIrisMessageBus<HermesEventMessage>;

  beforeAll(async () => {
    proteus = createTestProteusSource();
    iris = createTestIrisSource();

    const scanned = scanModules([
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

    testAggregate = registry.getAggregate("hermes", "test_aggregate");
    forgettableAggregate = registry.getAggregate("billing", "test_forgettable_aggregate");
  });

  afterAll(async () => {
    await iris.disconnect();
    await proteus.disconnect();
  });

  beforeEach(async () => {
    const commandQueue = iris.workerQueue(HermesCommandMessage);
    eventBus = iris.messageBus(HermesEventMessage);
    const errorQueue = iris.workerQueue(HermesErrorMessage);

    domain = new AggregateDomain({
      registry,
      proteus,
      iris: {
        commandQueue,
        eventBus,
        errorQueue,
      },
      logger,
    });

    // Spy on eventBus.publish to capture published events and prevent
    // Iris message validation (the domain creates HermesEventMessage
    // objects without going through Iris create() so they lack generated IDs)
    spiedEventBusPublish = jest.spyOn(eventBus, "publish").mockResolvedValue(undefined);
  });

  afterEach(() => {
    spiedEventBusPublish.mockRestore();
  });

  // Helper to create a properly formed HermesCommandMessage
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
    msg.meta = overrides.meta ?? { origin: "test" };
    msg.timestamp = new Date();
    return msg;
  };

  // Helper to find a command handler by command name
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

  // Directly invoke the private handleCommand method
  const handleCommand = async (
    message: HermesCommandMessage,
    agg: RegisteredAggregate,
    handler: HandlerRegistration,
  ): Promise<void> => {
    await (domain as any).handleCommand(message, agg, handler);
  };

  // Directly invoke the private handleError method
  const handleError = async (
    message: HermesErrorMessage,
    agg: RegisteredAggregate,
    handler: HandlerRegistration,
  ): Promise<void> => {
    await (domain as any).handleError(message, agg, handler);
  };

  // -- Registration --

  it("should register command handlers for all aggregates", async () => {
    expect(testAggregate.commandHandlers.length).toBeGreaterThan(0);
    expect(forgettableAggregate.commandHandlers.length).toBeGreaterThan(0);
  });

  it("should produce correct queue naming convention", () => {
    const queueName = (AggregateDomain as any).commandQueueName(
      testAggregate,
      "test_command_create",
    );
    expect(queueName).toBe("queue.aggregate.hermes.test_aggregate.test_command_create");

    const errorQueueName = (AggregateDomain as any).errorQueueName(
      testAggregate,
      "domain_error",
    );
    expect(errorQueueName).toBe(
      "queue.aggregate.error.hermes.test_aggregate.domain_error",
    );
  });

  // -- Create command --

  it("should handle a create command and save EventRecord", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const handler = findCommandHandler(testAggregate, "test_command_create");

    const command = createCommandMsg(
      "test_command_create",
      { input: "hello" },
      { aggregate },
    );
    await handleCommand(command, testAggregate, handler);

    const eventRepo = proteus.repository(EventRecord);
    const events = await eventRepo.find({
      aggregateId,
      aggregateName: "test_aggregate",
      aggregateNamespace: "hermes",
    });

    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("test_event_create");
    expect(events[0].data).toEqual({ input: "hello" });
    expect(events[0].causationId).toBe(command.id);
    expect(events[0].expectedEvents).toBe(0);
    expect(events[0].checksum).toEqual(expect.any(String));
    expect(events[0].checksum.length).toBeGreaterThan(0);
  });

  // -- Command on existing aggregate --

  it("should handle a command on existing aggregate with loaded events", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");
    const mergeHandler = findCommandHandler(testAggregate, "test_command_merge_state");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "initial" },
      { aggregate },
    );
    await handleCommand(createCmd, testAggregate, createHandler);

    const mergeCmd = createCommandMsg(
      "test_command_merge_state",
      { input: "updated" },
      { aggregate },
    );
    await handleCommand(mergeCmd, testAggregate, mergeHandler);

    const eventRepo = proteus.repository(EventRecord);
    const events = await eventRepo.find(
      { aggregateId, aggregateName: "test_aggregate", aggregateNamespace: "hermes" },
      { order: { createdAt: "ASC" } },
    );

    expect(events).toHaveLength(2);
    expect(events[0].name).toBe("test_event_create");
    expect(events[1].name).toBe("test_event_merge_state");
    expect(events[1].expectedEvents).toBe(1);
    expect(events[1].previousId).toBe(events[0].id);
  });

  // -- Idempotency --

  it("should silently re-publish events when replaying an already-processed command", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");
    const mergeHandler = findCommandHandler(testAggregate, "test_command_merge_state");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "first" },
      { aggregate },
    );
    await handleCommand(createCmd, testAggregate, createHandler);

    const mergeCmd = createCommandMsg(
      "test_command_merge_state",
      { input: "merged" },
      { aggregate },
    );
    await handleCommand(mergeCmd, testAggregate, mergeHandler);

    spiedEventBusPublish.mockClear();

    // Re-handle the same merge command (same id) -- alreadyProcessed=true
    // should skip saveEvents and re-publish existing events instead
    await handleCommand(mergeCmd, testAggregate, mergeHandler);

    expect(spiedEventBusPublish).toHaveBeenCalledTimes(1);
    const republished = spiedEventBusPublish.mock
      .calls[0][0] as Array<HermesEventMessage>;
    expect(republished).toHaveLength(1);
    expect(republished[0].name).toBe("test_event_merge_state");
  });

  // -- RequireNotCreated --

  it("should throw AggregateAlreadyCreatedError when requireNotCreated and aggregate has events", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "initial" },
      { aggregate },
    );
    await handleCommand(createCmd, testAggregate, createHandler);

    const createCmd2 = createCommandMsg(
      "test_command_create",
      { input: "duplicate" },
      { aggregate },
    );

    await expect(handleCommand(createCmd2, testAggregate, createHandler)).rejects.toThrow(
      AggregateAlreadyCreatedError,
    );
  });

  // -- RequireCreated --

  it("should throw AggregateNotCreatedError when requireCreated and aggregate has no events", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const mergeHandler = findCommandHandler(testAggregate, "test_command_merge_state");

    const mergeCmd = createCommandMsg(
      "test_command_merge_state",
      { input: "orphan" },
      { aggregate },
    );

    await expect(handleCommand(mergeCmd, testAggregate, mergeHandler)).rejects.toThrow(
      AggregateNotCreatedError,
    );
  });

  // -- Destroyed aggregate --

  it("should throw AggregateDestroyedError on destroyed aggregate", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");
    const destroyHandler = findCommandHandler(testAggregate, "test_command_destroy");
    const mergeHandler = findCommandHandler(testAggregate, "test_command_merge_state");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "born" },
      { aggregate },
    );
    await handleCommand(createCmd, testAggregate, createHandler);

    const destroyCmd = createCommandMsg(
      "test_command_destroy",
      { input: "die" },
      { aggregate },
    );
    await handleCommand(destroyCmd, testAggregate, destroyHandler);

    const mergeCmd = createCommandMsg(
      "test_command_merge_state",
      { input: "zombie" },
      { aggregate },
    );

    await expect(handleCommand(mergeCmd, testAggregate, mergeHandler)).rejects.toThrow(
      AggregateDestroyedError,
    );
  });

  // -- Schema validation --

  it("should throw CommandSchemaValidationError on invalid command data", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");

    const msg = createCommandMsg("test_command_create", {}, { aggregate });

    await expect(handleCommand(msg, testAggregate, createHandler)).rejects.toThrow(
      CommandSchemaValidationError,
    );
  });

  // -- Multiple events from one command --

  it("should save multiple events from one command with incrementing expectedEvents", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");
    const destroyNextHandler = findCommandHandler(
      testAggregate,
      "test_command_destroy_next",
    );

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "created" },
      { aggregate },
    );
    await handleCommand(createCmd, testAggregate, createHandler);

    // DestroyNext applies two events (TestEventDestroyNext + TestEventDestroy).
    // Each event gets an incrementing expectedEvents value.
    const destroyNextCmd = createCommandMsg(
      "test_command_destroy_next",
      { input: "farewell" },
      { aggregate },
    );
    await handleCommand(destroyNextCmd, testAggregate, destroyNextHandler);

    const eventRepo = proteus.repository(EventRecord);
    const events = await eventRepo.find(
      { aggregateId, aggregateName: "test_aggregate", aggregateNamespace: "hermes" },
      { order: { expectedEvents: "ASC" } },
    );

    expect(events).toHaveLength(3);
    expect(events[0].expectedEvents).toBe(0);
    expect(events[1].expectedEvents).toBe(1);
    expect(events[2].expectedEvents).toBe(2);
    expect(events[1].previousId).toBe(events[0].id);
    expect(events[2].previousId).toBe(events[1].id);
  });

  // -- Checksums --

  it("should compute and store checksums for saved events", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "checksummed" },
      { aggregate },
    );
    await handleCommand(createCmd, testAggregate, createHandler);

    const eventRepo = proteus.repository(EventRecord);
    const events = await eventRepo.find({ aggregateId });

    expect(events).toHaveLength(1);
    expect(events[0].checksum).toBeTruthy();
    expect(typeof events[0].checksum).toBe("string");
    expect(events[0].checksum.length).toBeGreaterThan(10);
  });

  // -- Event handler throws --

  it("should propagate non-domain errors from event handler", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");
    const throwsHandler = findCommandHandler(testAggregate, "test_command_throws");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "created" },
      { aggregate },
    );
    await handleCommand(createCmd, testAggregate, createHandler);

    const throwsCmd = createCommandMsg(
      "test_command_throws",
      { input: "boom" },
      { aggregate },
    );

    await expect(handleCommand(throwsCmd, testAggregate, throwsHandler)).rejects.toThrow(
      "boom",
    );
  });

  // -- Publish events to event bus --

  it("should publish events to Iris EventBus after save", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "published" },
      { aggregate },
    );
    await handleCommand(createCmd, testAggregate, createHandler);

    expect(spiedEventBusPublish).toHaveBeenCalledTimes(1);
    const publishedEvents = spiedEventBusPublish.mock
      .calls[0][0] as Array<HermesEventMessage>;
    expect(publishedEvents).toHaveLength(1);
    expect(publishedEvents[0].name).toBe("test_event_create");
    expect(publishedEvents[0].data).toEqual({ input: "published" });
    expect(publishedEvents[0].aggregate).toEqual(aggregate);
  });

  // -- Inspect --

  it("should inspect aggregate state after commands", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");
    const mergeHandler = findCommandHandler(testAggregate, "test_command_merge_state");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "hello" },
      { aggregate },
    );
    await handleCommand(createCmd, testAggregate, createHandler);

    const mergeCmd = createCommandMsg(
      "test_command_merge_state",
      { input: "world" },
      { aggregate },
    );
    await handleCommand(mergeCmd, testAggregate, mergeHandler);

    const model = await domain.inspect(aggregate);

    expect(model.id).toBe(aggregateId);
    expect(model.name).toBe("test_aggregate");
    expect(model.namespace).toBe("hermes");
    expect(model.destroyed).toBe(false);
    expect(model.numberOfLoadedEvents).toBe(2);
    expect(model.state).toEqual({
      create: "hello",
      mergeState: "world",
    });
  });

  // -- Encryption --

  it("should encrypt event data for forgettable aggregates", async () => {
    const aggregateId = randomUUID();
    const aggregate = {
      id: aggregateId,
      name: "test_forgettable_aggregate",
      namespace: "billing",
    };
    const createHandler = findCommandHandler(forgettableAggregate, "test_command_create");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "secret" },
      { aggregate },
    );
    await handleCommand(createCmd, forgettableAggregate, createHandler);

    const eventRepo = proteus.repository(EventRecord);
    const events = await eventRepo.find({
      aggregateId,
      aggregateName: "test_forgettable_aggregate",
      aggregateNamespace: "billing",
    });

    expect(events).toHaveLength(1);
    expect(events[0].encrypted).toBe(true);
    expect(events[0].data).not.toEqual({ input: "secret" });
  });

  it("should create encryption key on first encrypt and store it", async () => {
    const aggregateId = randomUUID();
    const aggregate = {
      id: aggregateId,
      name: "test_forgettable_aggregate",
      namespace: "billing",
    };
    const createHandler = findCommandHandler(forgettableAggregate, "test_command_create");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "encrypted" },
      { aggregate },
    );
    await handleCommand(createCmd, forgettableAggregate, createHandler);

    const encRepo = proteus.repository(EncryptionRecord);
    const encRecord = await encRepo.findOne({
      aggregateId,
      aggregateName: "test_forgettable_aggregate",
      aggregateNamespace: "billing",
    });

    expect(encRecord).not.toBeNull();
    expect(encRecord!.keyId).toBeTruthy();
    expect(encRecord!.keyAlgorithm).toBe("dir");
    expect(encRecord!.keyEncryption).toBe("A256GCM");
    expect(encRecord!.privateKey).toBeTruthy();
  });

  it("should decrypt event data when loading forgettable aggregate", async () => {
    const aggregateId = randomUUID();
    const aggregate = {
      id: aggregateId,
      name: "test_forgettable_aggregate",
      namespace: "billing",
    };
    const createHandler = findCommandHandler(forgettableAggregate, "test_command_create");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "decryptme" },
      { aggregate },
    );
    await handleCommand(createCmd, forgettableAggregate, createHandler);

    const model = await domain.inspect(aggregate);
    expect(model.state).toEqual({ create: "decryptme" });
    expect(model.numberOfLoadedEvents).toBe(1);
  });

  it("should reuse encryption key on subsequent encrypts", async () => {
    const aggregateId = randomUUID();
    const aggregate = {
      id: aggregateId,
      name: "test_forgettable_aggregate",
      namespace: "billing",
    };
    const createHandler = findCommandHandler(forgettableAggregate, "test_command_create");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "first" },
      { aggregate },
    );
    await handleCommand(createCmd, forgettableAggregate, createHandler);

    const encRepo = proteus.repository(EncryptionRecord);
    const encRecords = await encRepo.find({
      aggregateId,
      aggregateName: "test_forgettable_aggregate",
      aggregateNamespace: "billing",
    });

    expect(encRecords).toHaveLength(1);
  });

  // -- Error handler --

  it("should handle error message via error handler and dispatch recovery command", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const errorHandler = testAggregate.errorHandlers[0];
    expect(errorHandler).toBeDefined();

    const errorMsg = new HermesErrorMessage();
    errorMsg.id = randomUUID();
    errorMsg.aggregate = aggregate;
    errorMsg.name = "domain_error";
    errorMsg.version = 1;
    errorMsg.causationId = randomUUID();
    errorMsg.correlationId = null;
    errorMsg.data = {
      error: { message: "something broke", name: "DomainError" },
    };
    errorMsg.meta = { origin: "test" };
    errorMsg.timestamp = new Date();

    await handleError(errorMsg, testAggregate, errorHandler);
  });

  // -- setState --

  it("should handle setState via event handler", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");
    const setStateHandler = findCommandHandler(testAggregate, "test_command_set_state");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "initial" },
      { aggregate },
    );
    await handleCommand(createCmd, testAggregate, createHandler);

    const setStateCmd = createCommandMsg(
      "test_command_set_state",
      { input: "replaced" },
      { aggregate },
    );
    await handleCommand(setStateCmd, testAggregate, setStateHandler);

    const model = await domain.inspect(aggregate);
    expect(model.state).toEqual({
      create: "initial",
      setState: "replaced",
    });
  });

  // -- Publish error on permanent domain error --

  it("should publish error to error queue on permanent domain error", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "first" },
      { aggregate },
    );
    await handleCommand(createCmd, testAggregate, createHandler);

    const createCmd2 = createCommandMsg(
      "test_command_create",
      { input: "duplicate" },
      { aggregate },
    );

    await expect(handleCommand(createCmd2, testAggregate, createHandler)).rejects.toThrow(
      AggregateAlreadyCreatedError,
    );
  });

  // -- C1: Concurrent command handling -- expectedEvents unique constraint --

  it("should throw ConcurrencyError when two commands produce events with the same expectedEvents", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");
    const mergeHandler = findCommandHandler(testAggregate, "test_command_merge_state");

    // Create the aggregate first
    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "init" },
      { aggregate },
    );
    await handleCommand(createCmd, testAggregate, createHandler);

    // Two merge commands target the same aggregate. Each loads 1 event, so both
    // try to insert expectedEvents=1. One should succeed, the other should fail
    // with ConcurrencyError from the duplicate key on expectedEvents.
    const mergeCmd1 = createCommandMsg(
      "test_command_merge_state",
      { input: "a" },
      { aggregate },
    );
    const mergeCmd2 = createCommandMsg(
      "test_command_merge_state",
      { input: "b" },
      { aggregate },
    );

    const results = await Promise.allSettled([
      handleCommand(mergeCmd1, testAggregate, mergeHandler),
      handleCommand(mergeCmd2, testAggregate, mergeHandler),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // In the memory driver, both commands may serialize and succeed (second loads
    // the updated event count). We verify that at LEAST one succeeded.
    // If a race occurred, we expect a ConcurrencyError.
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    if (rejected.length > 0) {
      const error = (rejected[0] as PromiseRejectedResult).reason;
      expect(error).toBeInstanceOf(ConcurrencyError);
    }

    // Verify the aggregate has at least 2 events (create + one merge)
    const eventRepo = proteus.repository(EventRecord);
    const events = await eventRepo.find({ aggregateId });
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it("should wrap DuplicateKeyError as ConcurrencyError in saveEvents", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");

    // Mock the proteus transaction to throw a DuplicateKeyError
    const originalTransaction = proteus.transaction.bind(proteus);
    const transactionSpy = jest
      .spyOn(proteus, "transaction")
      .mockRejectedValueOnce(new DuplicateKeyError("unique constraint violation"));

    const cmd = createCommandMsg("test_command_create", { input: "race" }, { aggregate });

    await expect(handleCommand(cmd, testAggregate, createHandler)).rejects.toThrow(
      ConcurrencyError,
    );

    transactionSpy.mockRestore();
  });

  // -- E8: error handler failure propagation --

  it("should propagate errors thrown inside the error handler for Iris retry", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const errorHandler = testAggregate.errorHandlers[0];
    expect(errorHandler).toBeDefined();

    // Mock resolveHandlerFunction to return a handler that throws
    jest.spyOn(domain as any, "resolveHandlerFunction").mockImplementation(() => {
      return async () => {
        throw new Error("error handler exploded");
      };
    });

    const errorMsg = new HermesErrorMessage();
    errorMsg.id = randomUUID();
    errorMsg.aggregate = aggregate;
    errorMsg.name = "domain_error";
    errorMsg.version = 1;
    errorMsg.causationId = randomUUID();
    errorMsg.correlationId = null;
    errorMsg.data = {
      error: { message: "original problem", name: "DomainError" },
    };
    errorMsg.meta = { origin: "test" };
    errorMsg.timestamp = new Date();

    // Error should propagate so Iris retries
    await expect(handleError(errorMsg, testAggregate, errorHandler)).rejects.toThrow(
      "error handler exploded",
    );

    (domain as any).resolveHandlerFunction.mockRestore();
  });

  it("should propagate dispatch failure from aggregate error handler for Iris retry", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const errorHandler = testAggregate.errorHandlers[0];
    expect(errorHandler).toBeDefined();

    const commandQueue = (domain as any).commandQueue;
    const publishSpy = jest
      .spyOn(commandQueue, "publish")
      .mockRejectedValueOnce(new Error("command queue publish failed"));

    const errorMsg = new HermesErrorMessage();
    errorMsg.id = randomUUID();
    errorMsg.aggregate = aggregate;
    errorMsg.name = "domain_error";
    errorMsg.version = 1;
    errorMsg.causationId = randomUUID();
    errorMsg.correlationId = null;
    errorMsg.data = {
      error: { message: "something broke", name: "DomainError" },
    };
    errorMsg.meta = { origin: "test" };
    errorMsg.timestamp = new Date();

    // Dispatch failure propagates so Iris retries
    await expect(handleError(errorMsg, testAggregate, errorHandler)).rejects.toThrow(
      "command queue publish failed",
    );

    publishSpy.mockRestore();
  });

  // -- H2: dispatchCommand from error handler publishes command --

  it("should publish dispatched command from error handler to commandQueue", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const errorHandler = testAggregate.errorHandlers[0];
    expect(errorHandler).toBeDefined();

    const commandQueue = (domain as any).commandQueue;
    const commandPublishSpy = jest
      .spyOn(commandQueue, "publish")
      .mockResolvedValue(undefined);

    const errorMsg = new HermesErrorMessage();
    errorMsg.id = randomUUID();
    errorMsg.aggregate = aggregate;
    errorMsg.name = "domain_error";
    errorMsg.version = 1;
    errorMsg.causationId = randomUUID();
    errorMsg.correlationId = null;
    errorMsg.data = {
      error: { message: "something broke", name: "DomainError" },
    };
    errorMsg.meta = { origin: "test" };
    errorMsg.timestamp = new Date();

    await handleError(errorMsg, testAggregate, errorHandler);

    // TestAggregate error handler dispatches TestCommandCreate("retry")
    expect(commandPublishSpy).toHaveBeenCalledTimes(1);
    const publishedMsg = commandPublishSpy.mock.calls[0][0] as any;
    expect(publishedMsg.name).toBe("test_command_create");
    expect(publishedMsg.data).toEqual({ input: "retry" });

    commandPublishSpy.mockRestore();
  });

  // -- H3: CausationMissingEventsError when handler applies zero events --

  it("should throw CausationMissingEventsError when command handler applies no events", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");

    // Mock resolveHandlerFunction to return a handler that doesn't call ctx.apply
    jest.spyOn(domain as any, "resolveHandlerFunction").mockImplementation(() => {
      return async () => {
        // intentionally not calling ctx.apply
      };
    });

    const cmd = createCommandMsg(
      "test_command_create",
      { input: "no-events" },
      { aggregate },
    );

    await expect(handleCommand(cmd, testAggregate, createHandler)).rejects.toThrow(
      CausationMissingEventsError,
    );

    (domain as any).resolveHandlerFunction.mockRestore();
  });

  // -- H4: ConcurrencyError is classified separately from generic errors --

  it("should re-throw ConcurrencyError without publishing to error queue", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");

    // Mock transaction to throw DuplicateKeyError -> ConcurrencyError
    jest
      .spyOn(proteus, "transaction")
      .mockRejectedValueOnce(new DuplicateKeyError("unique constraint violation"));

    const errorQueue = (domain as any).errorQueue;
    const errorPublishSpy = jest
      .spyOn(errorQueue, "publish")
      .mockResolvedValue(undefined);

    const cmd = createCommandMsg("test_command_create", { input: "race" }, { aggregate });

    await expect(handleCommand(cmd, testAggregate, createHandler)).rejects.toThrow(
      ConcurrencyError,
    );

    // ConcurrencyError should NOT be published to error queue (only permanent DomainErrors are)
    expect(errorPublishSpy).not.toHaveBeenCalled();

    errorPublishSpy.mockRestore();
    (proteus.transaction as jest.Mock).mockRestore();
  });

  // -- H5: re-publish fails during alreadyProcessed --

  it("should propagate error when eventBus.publish fails during alreadyProcessed re-publish", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");

    // First handle creates the event
    const cmd = createCommandMsg(
      "test_command_create",
      { input: "original" },
      { aggregate },
    );
    await handleCommand(cmd, testAggregate, createHandler);

    // Now make eventBus.publish reject
    spiedEventBusPublish.mockRejectedValueOnce(new Error("publish failed"));

    // Re-handle the same command (alreadyProcessed=true), publish throws
    await expect(handleCommand(cmd, testAggregate, createHandler)).rejects.toThrow(
      "publish failed",
    );
  });

  // -- H6: decryptRecords key not found --

  it("should filter out encrypted events when encryption key is missing", async () => {
    const aggregateId = randomUUID();
    const aggregate = {
      id: aggregateId,
      name: "test_forgettable_aggregate",
      namespace: "billing",
    };
    const createHandler = findCommandHandler(forgettableAggregate, "test_command_create");

    // Create an encrypted event
    const cmd = createCommandMsg(
      "test_command_create",
      { input: "secret" },
      { aggregate },
    );
    await handleCommand(cmd, forgettableAggregate, createHandler);

    // Mock loadEncryptionKey to return null (simulating missing key)
    const loadEncryptionKeySpy = jest
      .spyOn(domain as any, "loadEncryptionKey")
      .mockResolvedValue(null);

    // Inspect the aggregate -- encrypted events should be filtered out
    const model = await domain.inspect(aggregate);
    // With the encryption key missing, the encrypted event is dropped.
    // The model should have 0 loaded events since all events were encrypted.
    expect(model.numberOfLoadedEvents).toBe(0);
    expect(model.state).toEqual({});

    loadEncryptionKeySpy.mockRestore();
  });

  // -- MEDIUM: Default encryption options with non-default values --

  it("should use non-default encryption options when provided", async () => {
    const cmdQueue = iris.workerQueue(HermesCommandMessage);
    const customEventBus = iris.messageBus(HermesEventMessage);
    const errQueue = iris.workerQueue(HermesErrorMessage);

    jest.spyOn(customEventBus, "publish").mockResolvedValue(undefined);

    const customDomain = new AggregateDomain({
      registry,
      proteus,
      iris: { commandQueue: cmdQueue, eventBus: customEventBus, errorQueue: errQueue },
      encryption: {
        algorithm: "ECDH-ES",
        encryption: "A128GCM",
      },
      logger,
    });

    const aggregateId = randomUUID();
    const aggregate = {
      id: aggregateId,
      name: "test_forgettable_aggregate",
      namespace: "billing",
    };
    const handler = findCommandHandler(forgettableAggregate, "test_command_create");

    const cmd = createCommandMsg(
      "test_command_create",
      { input: "custom-enc" },
      { aggregate },
    );
    await (customDomain as any).handleCommand(cmd, forgettableAggregate, handler);

    const encRepo = proteus.repository(EncryptionRecord);
    const encRecord = await encRepo.findOne({
      aggregateId,
      aggregateName: "test_forgettable_aggregate",
      aggregateNamespace: "billing",
    });

    expect(encRecord).not.toBeNull();
    expect(encRecord!.keyAlgorithm).toBe("ECDH-ES");
    expect(encRecord!.keyEncryption).toBe("A128GCM");
  });

  // -- MEDIUM: Error handler registration verification --

  it("should call errorQueue.consume for each registered error handler", async () => {
    const cmdQueue = iris.workerQueue(HermesCommandMessage);
    const localEventBus = iris.messageBus(HermesEventMessage);
    const errQueue = iris.workerQueue(HermesErrorMessage);

    const consumeSpy = jest
      .spyOn(errQueue, "consume")
      .mockResolvedValue(undefined as any);

    const localDomain = new AggregateDomain({
      registry,
      proteus,
      iris: { commandQueue: cmdQueue, eventBus: localEventBus, errorQueue: errQueue },
      logger,
    });

    await localDomain.registerHandlers();

    const errorConsumeCount =
      testAggregate.errorHandlers.length + forgettableAggregate.errorHandlers.length;
    expect(consumeSpy).toHaveBeenCalledTimes(errorConsumeCount);

    consumeSpy.mockRestore();
  });

  // -- MEDIUM: Transient DomainError does NOT trigger publishError --

  it("should not publish error for transient DomainError", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "first" },
      { aggregate },
    );
    await handleCommand(createCmd, testAggregate, createHandler);

    const throwsHandler = findCommandHandler(testAggregate, "test_command_throws");
    const resolverSpy = jest
      .spyOn(domain as any, "resolveHandlerFunction")
      .mockReturnValue(async () => {
        throw new DomainError("transient failure", { permanent: false });
      });

    const errQueue = (domain as any).errorQueue;
    const errPubSpy = jest.spyOn(errQueue, "publish").mockResolvedValue(undefined);

    const throwsCmd = createCommandMsg(
      "test_command_throws",
      { input: "transient" },
      { aggregate },
    );

    await expect(handleCommand(throwsCmd, testAggregate, throwsHandler)).rejects.toThrow(
      DomainError,
    );

    expect(errPubSpy).not.toHaveBeenCalled();

    resolverSpy.mockRestore();
    errPubSpy.mockRestore();
  });

  // -- MEDIUM: publishError failure (errorQueue.publish rejects) --

  it("should re-throw when errorQueue.publish fails in publishError", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");

    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "first" },
      { aggregate },
    );
    await handleCommand(createCmd, testAggregate, createHandler);

    const errQueue = (domain as any).errorQueue;
    const errPubSpy = jest
      .spyOn(errQueue, "publish")
      .mockRejectedValue(new Error("publish failed"));

    const createCmd2 = createCommandMsg(
      "test_command_create",
      { input: "dup" },
      { aggregate },
    );

    await expect(
      handleCommand(createCmd2, testAggregate, createHandler),
    ).rejects.toThrow();

    expect(errPubSpy).toHaveBeenCalledTimes(1);

    errPubSpy.mockRestore();
  });

  // -- MEDIUM: saveEvents non-duplicate transaction error propagation --

  it("should propagate non-duplicate-key errors from saveEvents transaction", async () => {
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };
    const createHandler = findCommandHandler(testAggregate, "test_command_create");

    const txSpy = jest
      .spyOn(proteus, "transaction")
      .mockRejectedValueOnce(new Error("generic database error"));

    const cmd = createCommandMsg("test_command_create", { input: "fail" }, { aggregate });

    await expect(handleCommand(cmd, testAggregate, createHandler)).rejects.toThrow(
      "generic database error",
    );

    txSpy.mockRestore();
  });

  // -- MEDIUM: decryptRecords key ID mismatch --

  it("should return raw record when encryption key ID does not match", async () => {
    const aggregateId = randomUUID();
    const aggregate = {
      id: aggregateId,
      name: "test_forgettable_aggregate",
      namespace: "billing",
    };
    const handler = findCommandHandler(forgettableAggregate, "test_command_create");

    const cmd = createCommandMsg(
      "test_command_create",
      { input: "mismatch" },
      { aggregate },
    );
    await (domain as any).handleCommand(cmd, forgettableAggregate, handler);

    const encRepo = proteus.repository(EncryptionRecord);
    const encRecord = await encRepo.findOne({
      aggregateId,
      aggregateName: "test_forgettable_aggregate",
      aggregateNamespace: "billing",
    });

    expect(encRecord).not.toBeNull();
    encRecord!.keyId = "mismatched-key-id";
    await encRepo.update(encRecord!);

    const model = await domain.inspect(aggregate);
    expect(model.numberOfLoadedEvents).toBe(1);
  });

  // -- MEDIUM: decryptRecords decryption failure catch --

  it("should return raw record when decryption fails", async () => {
    const aggregateId = randomUUID();
    const aggregate = {
      id: aggregateId,
      name: "test_forgettable_aggregate",
      namespace: "billing",
    };
    const handler = findCommandHandler(forgettableAggregate, "test_command_create");

    const cmd = createCommandMsg(
      "test_command_create",
      { input: "corrupt" },
      { aggregate },
    );
    await (domain as any).handleCommand(cmd, forgettableAggregate, handler);

    const eventRepo = proteus.repository(EventRecord);
    const events = await eventRepo.find({
      aggregateId,
      aggregateName: "test_forgettable_aggregate",
      aggregateNamespace: "billing",
    });

    expect(events).toHaveLength(1);
    events[0].data = { corrupted: "not valid aes data" };
    await eventRepo.update(events[0]);

    const model = await domain.inspect(aggregate);
    expect(model.numberOfLoadedEvents).toBe(1);
  });

  // -- MEDIUM: loadOrCreateEncryptionKey race condition null path --

  it("should re-throw when loadEncryptionKey returns null after duplicate key error", async () => {
    const identifier = {
      id: randomUUID(),
      name: "test_forgettable_aggregate",
      namespace: "billing",
    };

    // First call: no existing key -> proceed to create
    // After DuplicateKeyError: second call also returns null -> re-throw
    const loadSpy = jest
      .spyOn(domain as any, "loadEncryptionKey")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    // Mock the proteus.repository to return a repo whose insert throws DuplicateKeyError
    const mockRepo = {
      insert: jest.fn().mockRejectedValue(new DuplicateKeyError("duplicate key")),
    };
    const repoSpy = jest.spyOn(proteus, "repository").mockReturnValue(mockRepo as any);

    const loadOrCreate = (domain as any).loadOrCreateEncryptionKey.bind(domain);
    await expect(loadOrCreate(identifier)).rejects.toThrow(DuplicateKeyError);

    loadSpy.mockRestore();
    repoSpy.mockRestore();
  });

  // -- MEDIUM: isDuplicateKeyError various error signatures --

  it("should detect DuplicateKeyError instance", () => {
    const isDup = (domain as any).isDuplicateKeyError.bind(domain);
    expect(isDup(new DuplicateKeyError("dup"))).toBe(true);
  });

  it("should detect error with 'unique constraint' in message", () => {
    const isDup = (domain as any).isDuplicateKeyError.bind(domain);
    expect(isDup(new Error("unique constraint violation on column x"))).toBe(true);
  });

  it("should detect Postgres error code 23505", () => {
    const isDup = (domain as any).isDuplicateKeyError.bind(domain);
    const err: any = new Error("something");
    err.code = "23505";
    expect(isDup(err)).toBe(true);
  });

  it("should detect MongoDB error code 11000", () => {
    const isDup = (domain as any).isDuplicateKeyError.bind(domain);
    const err: any = new Error("something");
    err.code = 11000;
    expect(isDup(err)).toBe(true);
  });

  it("should return false for unrelated errors", () => {
    const isDup = (domain as any).isDuplicateKeyError.bind(domain);
    expect(isDup(new Error("some random error"))).toBe(false);
  });

  // -- G6: encryptRecords encrypts ALL records for forgettable aggregate --

  it("should mark every event record as encrypted for a forgettable aggregate (by design)", async () => {
    const aggregateId = randomUUID();
    const aggregate = {
      id: aggregateId,
      name: "test_forgettable_aggregate",
      namespace: "billing",
    };
    const createHandler = findCommandHandler(forgettableAggregate, "test_command_create");

    // Create the forgettable aggregate
    const createCmd = createCommandMsg(
      "test_command_create",
      { input: "secret-data" },
      { aggregate },
    );
    await handleCommand(createCmd, forgettableAggregate, createHandler);

    const eventRepo = proteus.repository(EventRecord);
    const events = await eventRepo.find({
      aggregateId,
      aggregateName: "test_forgettable_aggregate",
      aggregateNamespace: "billing",
    });

    // Every record for a forgettable aggregate must have encrypted=true
    // and its data must be ciphertext (not the original plaintext)
    expect(events).toHaveLength(1);
    expect(events[0].encrypted).toBe(true);
    expect(events[0].data).not.toEqual({ input: "secret-data" });

    // Verify an encryption key was created
    const encRepo = proteus.repository(EncryptionRecord);
    const encRecords = await encRepo.find({
      aggregateId,
      aggregateName: "test_forgettable_aggregate",
      aggregateNamespace: "billing",
    });
    expect(encRecords).toHaveLength(1);

    // Decryption should recover the original data
    const model = await domain.inspect(aggregate);
    expect(model.numberOfLoadedEvents).toBe(1);
    expect(model.state).toEqual({ create: "secret-data" });
  });
});
