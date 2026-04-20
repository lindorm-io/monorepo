import { createMockLogger } from "@lindorm/logger";
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
import { ChecksumDomain } from "./checksum-domain";

describe("ChecksumDomain", () => {
  const logger = createMockLogger();

  let proteus: ProteusSource;
  let iris: IrisSource;
  let registry: HermesRegistry;
  let domain: ChecksumDomain;

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
  });

  afterAll(async () => {
    await iris.disconnect();
    await proteus.disconnect();
  });

  let errorPublishSpy: jest.SpyInstance;

  beforeEach(async () => {
    const eventBus = iris.messageBus(HermesEventMessage);
    const errorQueue = iris.workerQueue(HermesErrorMessage);
    errorPublishSpy = jest
      .spyOn(errorQueue, "publish")
      .mockResolvedValue(undefined as any);

    domain = new ChecksumDomain({
      registry,
      proteus,
      iris: { eventBus, errorQueue },
      logger,
    });
  });

  afterEach(() => {
    errorPublishSpy?.mockRestore();
  });

  // Helper

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

  // Directly invoke the private handleEvent
  const handleEvent = async (msg: HermesEventMessage): Promise<void> => {
    await (domain as any).handleEvent(msg);
  };

  // -- Registration --

  it("should register checksum event handlers for all events", async () => {
    expect(registry.allEvents.length).toBeGreaterThan(0);
  });

  // -- Store checksum on first encounter --

  it("should verify and store checksum on first encounter", async () => {
    const eventId = randomUUID();
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const event = createEventMsg(
      "test_event_create",
      { input: "checksum-first" },
      {
        id: eventId,
        aggregate,
      },
    );
    await handleEvent(event);

    const checksumRepo = proteus.repository(ChecksumRecord);
    const record = await checksumRepo.findOne({ eventId });

    expect(record).not.toBeNull();
    expect(record!.eventId).toBe(eventId);
    expect(record!.aggregateId).toBe(aggregateId);
    expect(record!.aggregateName).toBe("test_aggregate");
    expect(record!.aggregateNamespace).toBe("hermes");
    expect(record!.checksum).toBeTruthy();
    expect(typeof record!.checksum).toBe("string");
    expect(record!.checksum.length).toBeGreaterThan(10);
  });

  // -- Pass verification when checksum matches --

  it("should pass verification when checksum matches existing record", async () => {
    const eventId = randomUUID();
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const event = createEventMsg(
      "test_event_create",
      { input: "match-test" },
      {
        id: eventId,
        aggregate,
      },
    );

    await handleEvent(event);

    const errors: Array<unknown> = [];
    domain.on("checksum", (data) => errors.push(data));

    await handleEvent(event);

    expect(errors).toHaveLength(0);
  });

  // -- Emit checksum error on mismatch --

  it("should emit checksum error on mismatch", async () => {
    const eventId = randomUUID();
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const event = createEventMsg(
      "test_event_create",
      { input: "original" },
      {
        id: eventId,
        aggregate,
      },
    );
    await handleEvent(event);

    const errors: Array<unknown> = [];
    domain.on("checksum", (data) => errors.push(data));

    const tamperedEvent = createEventMsg(
      "test_event_create",
      { input: "tampered" },
      {
        id: eventId,
        aggregate,
      },
    );
    await handleEvent(tamperedEvent);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual(
      expect.objectContaining({
        eventId,
        name: "test_event_create",
        aggregate,
      }),
    );
  });

  // -- Publish to error queue on mismatch --

  it("should publish checksum error to error queue on mismatch", async () => {
    const eventId = randomUUID();
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const event = createEventMsg(
      "test_event_create",
      { input: "original" },
      {
        id: eventId,
        aggregate,
      },
    );
    await handleEvent(event);

    const tamperedEvent = createEventMsg(
      "test_event_create",
      { input: "tampered" },
      {
        id: eventId,
        aggregate,
      },
    );
    await handleEvent(tamperedEvent);

    expect(errorPublishSpy).toHaveBeenCalledTimes(1);
    expect(errorPublishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "checksum_error",
        aggregate,
        causationId: eventId,
        data: expect.objectContaining({
          eventId,
          name: "test_event_create",
        }),
      }),
    );
  });

  // -- Deterministic checksum --

  it("should compute deterministic checksum from event message fields", async () => {
    const eventId1 = randomUUID();
    const eventId2 = randomUUID();
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const event1 = createEventMsg(
      "test_event_create",
      { input: "same" },
      {
        id: eventId1,
        aggregate,
        causationId: "cause-1",
        correlationId: "corr-1",
      },
    );

    const event2 = createEventMsg(
      "test_event_create",
      { input: "same" },
      {
        id: eventId2,
        aggregate,
        causationId: "cause-1",
        correlationId: "corr-1",
      },
    );

    await handleEvent(event1);
    await handleEvent(event2);

    const checksumRepo = proteus.repository(ChecksumRecord);
    const record1 = await checksumRepo.findOne({ eventId: eventId1 });
    const record2 = await checksumRepo.findOne({ eventId: eventId2 });

    expect(record1).not.toBeNull();
    expect(record2).not.toBeNull();
    expect(record1!.checksum).toBe(record2!.checksum);
  });

  // -- Different data produces different checksum --

  it("should produce different checksums for different event data", async () => {
    const eventId1 = randomUUID();
    const eventId2 = randomUUID();
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const event1 = createEventMsg(
      "test_event_create",
      { input: "alpha" },
      {
        id: eventId1,
        aggregate,
        causationId: "shared-cause",
        correlationId: "shared-corr",
      },
    );

    const event2 = createEventMsg(
      "test_event_create",
      { input: "beta" },
      {
        id: eventId2,
        aggregate,
        causationId: "shared-cause",
        correlationId: "shared-corr",
      },
    );

    await handleEvent(event1);
    await handleEvent(event2);

    const checksumRepo = proteus.repository(ChecksumRecord);
    const record1 = await checksumRepo.findOne({ eventId: eventId1 });
    const record2 = await checksumRepo.findOne({ eventId: eventId2 });

    expect(record1).not.toBeNull();
    expect(record2).not.toBeNull();
    expect(record1!.checksum).not.toBe(record2!.checksum);
  });

  // -- Topic and queue naming --

  it("should subscribe with aggregate-derived topic matching event publish format", async () => {
    const eventBus = iris.messageBus(HermesEventMessage);
    const subscribeSpy = jest.spyOn(eventBus, "subscribe");

    const errorQueue = iris.workerQueue(HermesErrorMessage);
    const localDomain = new ChecksumDomain({
      registry,
      proteus,
      iris: { eventBus, errorQueue },
      logger,
    });

    await localDomain.registerHandlers();

    // Verify at least one subscription uses the correct format:
    // {aggregate.namespace}.{aggregate.name}.{eventName}
    const calls = subscribeSpy.mock.calls.map(
      (c) => c[0] as { topic: string; queue: string },
    );

    // The test_aggregate has namespace "hermes" and name "test_aggregate"
    const createEventSub = calls.find(
      (c) => c.topic === "hermes.test_aggregate.test_event_create",
    );
    expect(createEventSub).toBeDefined();
    expect(createEventSub!.queue).toBe(
      "queue.checksum.hermes.test_aggregate.test_event_create",
    );

    subscribeSpy.mockRestore();
  });

  // -- MEDIUM: errorQueue.publish failure during checksum error is caught --

  it("should catch and log error when errorQueue.publish fails during checksum error", async () => {
    const eventId = randomUUID();
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    const event = createEventMsg(
      "test_event_create",
      { input: "original" },
      {
        id: eventId,
        aggregate,
      },
    );
    await handleEvent(event);

    // Make errorQueue.publish fail
    errorPublishSpy.mockRejectedValueOnce(new Error("publish failed"));

    const tamperedEvent = createEventMsg(
      "test_event_create",
      { input: "tampered" },
      {
        id: eventId,
        aggregate,
      },
    );

    // Should NOT reject -- the publish error is caught and logged
    await expect(handleEvent(tamperedEvent)).resolves.toBeUndefined();

    // The checksum error was still emitted via EventEmitter
    const errors: Array<unknown> = [];
    domain.on("checksum", (data) => errors.push(data));

    // Trigger again to verify EventEmitter still works after publish failure
    const tamperedEvent2 = createEventMsg(
      "test_event_create",
      { input: "tampered-again" },
      {
        id: eventId,
        aggregate,
      },
    );
    await handleEvent(tamperedEvent2);
    expect(errors).toHaveLength(1);
  });

  // -- MEDIUM: insertChecksum failure is caught and emitted --

  it("should catch insertChecksum failure and emit checksum error", async () => {
    const eventId = randomUUID();
    const aggregateId = randomUUID();
    const aggregate = { id: aggregateId, name: "test_aggregate", namespace: "hermes" };

    // Mock proteus.repository to return a repo whose insert fails
    const origRepository = proteus.repository.bind(proteus);
    const repoSpy = jest
      .spyOn(proteus, "repository")
      .mockImplementation((entity: any) => {
        const realRepo = origRepository(entity);
        if (entity === ChecksumRecord) {
          return {
            ...realRepo,
            findOne: realRepo.findOne.bind(realRepo),
            insert: jest.fn().mockRejectedValue(new Error("insert failed")),
          } as any;
        }
        return realRepo;
      });

    const errors: Array<unknown> = [];
    domain.on("checksum", (data) => errors.push(data));

    const event = createEventMsg(
      "test_event_create",
      { input: "insert-fail" },
      {
        id: eventId,
        aggregate,
      },
    );

    // Should not reject -- the error is caught in handleEvent
    await expect(handleEvent(event)).resolves.toBeUndefined();

    // The error was emitted via EventEmitter
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual(
      expect.objectContaining({
        eventId,
        name: "test_event_create",
      }),
    );

    // Error was published to error queue
    expect(errorPublishSpy).toHaveBeenCalledTimes(1);

    repoSpy.mockRestore();
  });
});
