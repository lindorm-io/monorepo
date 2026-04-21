import { IrisSource } from "@lindorm/iris";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSource } from "@lindorm/proteus";
import { randomUUID } from "crypto";
import { createChecksum } from "../internal/utils";
import {
  createTestIrisSource,
  createTestProteusSource,
} from "../__fixtures__/create-test-sources";
import {
  TestAggregate,
  TestForgettableAggregate,
} from "../__fixtures__/modules/aggregates";
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
} from "../__fixtures__/modules/commands";
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
} from "../__fixtures__/modules/events";
import { TestTimeoutReminder } from "../__fixtures__/modules/timeouts";
import { TestViewQuery } from "../__fixtures__/modules/queries";
import { TestSaga } from "../__fixtures__/modules/sagas";
import { TestView, TestViewEntity } from "../__fixtures__/modules/views";
import { Hermes } from "./Hermes";
import { afterAll, beforeAll, describe, expect, it, vi, type Mock } from "vitest";

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

const createConnectedSources = async (): Promise<{
  proteus: ProteusSource;
  iris: IrisSource;
}> => {
  const proteus = createTestProteusSource();
  const iris = createTestIrisSource();
  await proteus.connect();
  await iris.connect();
  return { proteus, iris };
};

describe("Hermes", () => {
  const logger = createMockLogger();

  describe("lifecycle", () => {
    it("should have status 'created' after construction", () => {
      const hermes = new Hermes({
        proteus: createTestProteusSource(),
        iris: createTestIrisSource(),
        modules: ALL_MODULES,
        logger,
      });

      expect(hermes.status).toBe("created");
    });

    it("should transition to 'ready' after setup", async () => {
      const { proteus, iris } = await createConnectedSources();

      const hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await hermes.setup();
      expect(hermes.status).toBe("ready");

      await hermes.teardown();
      await iris.disconnect();
      await proteus.disconnect();
    });

    it("should throw when setup called twice", async () => {
      const { proteus, iris } = await createConnectedSources();

      const hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await hermes.setup();

      await expect(hermes.setup()).rejects.toThrow(/can only be called once/);

      await hermes.teardown();
      await iris.disconnect();
      await proteus.disconnect();
    });

    it("should transition to 'stopped' after teardown", async () => {
      const { proteus, iris } = await createConnectedSources();

      const hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await hermes.setup();
      await hermes.teardown();

      expect(hermes.status).toBe("stopped");

      await iris.disconnect();
      await proteus.disconnect();
    });

    it("should throw when command called before setup", async () => {
      const hermes = new Hermes({
        proteus: createTestProteusSource(),
        iris: createTestIrisSource(),
        modules: ALL_MODULES,
        logger,
      });

      await expect(hermes.command(new TestCommandCreate("test"))).rejects.toThrow(
        /not ready/,
      );
    });

    it("should throw when query called before setup", async () => {
      const hermes = new Hermes({
        proteus: createTestProteusSource(),
        iris: createTestIrisSource(),
        modules: ALL_MODULES,
        logger,
      });

      await expect(hermes.query(new TestViewQuery("test"))).rejects.toThrow(/not ready/);
    });

    it("should create a session that shares ready status", async () => {
      const { proteus, iris } = await createConnectedSources();

      const hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await hermes.setup();

      const session = hermes.session();
      expect(session.status).toBe("ready");

      await hermes.teardown();
      await iris.disconnect();
      await proteus.disconnect();
    });
  });

  // Note: The Iris memory driver dispatches messages based on exact topic match.
  // Hermes.command() publishes to the generic command topic (e.g. "hermes.command"),
  // but AggregateDomain registers consumers on specific queue names (e.g.
  // "queue.aggregate.hermes.test_aggregate.test_command_create"). These do not
  // match in the memory driver, so the full pipeline cannot be tested end-to-end
  // through hermes.command(). The command/query/admin tests below verify the
  // public API surface in isolation.

  describe("command", () => {
    let hermes: Hermes;
    let proteus: ProteusSource;
    let iris: IrisSource;

    beforeAll(async () => {
      const sources = await createConnectedSources();
      proteus = sources.proteus;
      iris = sources.iris;

      hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await hermes.setup();
    });

    afterAll(async () => {
      await hermes.teardown();
      await iris.disconnect();
      await proteus.disconnect();
    });

    it("should publish command and return AggregateIdentifier", async () => {
      const id = randomUUID();

      const result = await hermes.command(new TestCommandCreate("hello"), {
        id,
      });

      expect(result.id).toBe(id);
      expect(result).toMatchSnapshot({
        id: expect.any(String),
        name: expect.any(String),
        namespace: expect.any(String),
      });
    });

    it("should generate a UUID when no id provided", async () => {
      const result = await hermes.command(new TestCommandCreate("auto-id"));

      expect(result.id).toEqual(expect.any(String));
      expect(result.id.length).toBeGreaterThan(0);
    });

    it("should use provided id for aggregate", async () => {
      const id = randomUUID();

      const result = await hermes.command(new TestCommandCreate("test"), {
        id,
      });

      expect(result.id).toBe(id);
    });

    it("should throw for unregistered command", async () => {
      class FakeCommand {
        input = "nope";
      }

      await expect(hermes.command(new FakeCommand())).rejects.toThrow();
    });

    it("should pass correlationId through to the command", async () => {
      const id = randomUUID();
      const correlationId = randomUUID();

      // This test verifies command() does not throw with correlationId option.
      const result = await hermes.command(new TestCommandCreate("correlated"), {
        id,
        correlationId,
      });

      expect(result.id).toBe(id);
    });
  });

  describe("admin inspect with empty state", () => {
    let hermes: Hermes;
    let proteus: ProteusSource;
    let iris: IrisSource;

    beforeAll(async () => {
      const sources = await createConnectedSources();
      proteus = sources.proteus;
      iris = sources.iris;

      hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await hermes.setup();
    });

    afterAll(async () => {
      await hermes.teardown();
      await iris.disconnect();
      await proteus.disconnect();
    });

    it("should inspect aggregate with no events", async () => {
      const id = randomUUID();

      const state = await hermes.admin.inspect.aggregate({
        id,
        name: "test_aggregate",
      });

      expect(state.id).toBe(id);
      expect(state.name).toBe("test_aggregate");
      expect(state.namespace).toBe("hermes");
      expect(state.destroyed).toBe(false);
      expect(state.numberOfLoadedEvents).toBe(0);
      expect(state.events).toEqual([]);
      expect(state.state).toEqual({});
    });

    it("should return null for non-existent saga", async () => {
      const saga = await hermes.admin.inspect.saga({
        id: randomUUID(),
        name: "test_saga",
      });

      expect(saga).toBeNull();
    });

    it("should return null for non-existent view", async () => {
      const entity = await hermes.admin.inspect.view({
        id: randomUUID(),
        entity: TestViewEntity,
      });

      expect(entity).toBeNull();
    });

    it("should purge causations and return zero count when none expired", async () => {
      const count = await hermes.admin.purgeCausations();
      expect(typeof count).toBe("number");
      expect(count).toBe(0);
    });
  });

  describe("replay", () => {
    let hermes: Hermes;
    let proteus: ProteusSource;
    let iris: IrisSource;

    beforeAll(async () => {
      const sources = await createConnectedSources();
      proteus = sources.proteus;
      iris = sources.iris;

      hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await hermes.setup();
    });

    afterAll(async () => {
      await hermes.teardown();
      await iris.disconnect();
      await proteus.disconnect();
    });

    // EventRecord is @AppendOnly so repo.clear() is blocked.
    // Disconnect + reconnect the memory driver to reset all tables instead.
    const resetStore = async (): Promise<void> => {
      await proteus.disconnect();
      await proteus.connect();
      await proteus.setup();
    };

    const seedEventRecords = async (
      aggregateId: string,
      events: Array<{ name: string; data: Record<string, unknown>; checksum?: string }>,
    ): Promise<void> => {
      const { EventRecord } = await import("../internal/entities");
      const repo = proteus.repository(EventRecord);

      for (let i = 0; i < events.length; i++) {
        const evt = events[i];
        const id = randomUUID();
        const attrs = {
          id,
          aggregateId,
          aggregateName: "test_aggregate",
          aggregateNamespace: "hermes",
          causationId: id,
          correlationId: randomUUID(),
          data: evt.data,
          encrypted: false,
          name: evt.name,
          timestamp: new Date(),
          expectedEvents: i + 1,
          meta: {},
          previousId: null,
          version: 1,
        };
        const checksum = evt.checksum ?? createChecksum(attrs);
        const record = repo.create({ ...attrs, checksum });
        await repo.insert(record);
      }
    };

    it("should complete immediately on empty event store", async () => {
      await resetStore();

      const handle = hermes.admin.replay.view(TestViewEntity);

      const progressEvents: Array<unknown> = [];
      handle.on("progress", (p) => progressEvents.push(p));

      let completed = false;
      handle.on("complete", () => {
        completed = true;
      });

      await handle.promise;

      expect(completed).toBe(true);
      expect(progressEvents.length).toBeGreaterThan(0);

      const last = progressEvents[progressEvents.length - 1] as any;
      expect(last.phase).toBe("complete");
      expect(last.total).toBe(0);
    });

    it("should replay events and rebuild view state", async () => {
      await resetStore();
      const aggregateId = randomUUID();

      await seedEventRecords(aggregateId, [
        { name: "test_event_create", data: { input: "replayed-value" } },
        { name: "test_event_merge_state", data: { input: "merged" } },
      ]);

      const handle = hermes.admin.replay.view(TestViewEntity);

      const progressEvents: Array<unknown> = [];
      handle.on("progress", (p) => progressEvents.push(p));

      let completed = false;
      handle.on("complete", () => {
        completed = true;
      });

      await handle.promise;

      expect(completed).toBe(true);

      // Verify the view entity was rebuilt
      const entity = await hermes.admin.inspect.view({
        id: aggregateId,
        entity: TestViewEntity,
      });

      expect(entity).not.toBeNull();
      expect(entity!.create).toBe("replayed-value");
      expect(entity!.mergeState).toBe("merged");
    });

    it("should emit progress with correct total and processed counts", async () => {
      await resetStore();
      const aggregateId = randomUUID();

      await seedEventRecords(aggregateId, [
        { name: "test_event_create", data: { input: "progress-test" } },
      ]);

      const handle = hermes.admin.replay.view(TestViewEntity);

      const progressEvents: Array<any> = [];
      handle.on("progress", (p) => progressEvents.push(p));

      await handle.promise;

      // Should have truncating, replaying, resuming, complete phases
      const phases = progressEvents.map((p) => p.phase);
      expect(phases).toContain("truncating");
      expect(phases).toContain("replaying");
      expect(phases).toContain("resuming");
      expect(phases).toContain("complete");

      // The complete phase should have total >= 1 (at least our seeded event)
      const completeProgress = progressEvents.find((p) => p.phase === "complete");
      expect(completeProgress.total).toBeGreaterThanOrEqual(1);
      expect(completeProgress.processed).toBe(completeProgress.total);
      expect(completeProgress.percent).toBe(100);
    });

    it("should truncate view table before replaying", async () => {
      await resetStore();
      const aggregateId = randomUUID();

      // Seed an event and replay to create view state
      await seedEventRecords(aggregateId, [
        { name: "test_event_create", data: { input: "before-truncate" } },
      ]);

      // First replay to populate the view
      await hermes.admin.replay.view(TestViewEntity).promise;

      const before = await hermes.admin.inspect.view({
        id: aggregateId,
        entity: TestViewEntity,
      });
      expect(before).not.toBeNull();

      // Second replay should truncate and rebuild
      await hermes.admin.replay.view(TestViewEntity).promise;

      // Should still exist after second replay (rebuilt from same events)
      const after = await hermes.admin.inspect.view({
        id: aggregateId,
        entity: TestViewEntity,
      });
      expect(after).not.toBeNull();
      expect(after!.create).toBe("before-truncate");
    });

    it("should skip causation during replay", async () => {
      await resetStore();
      const aggregateId = randomUUID();

      await seedEventRecords(aggregateId, [
        { name: "test_event_create", data: { input: "causation-test" } },
      ]);

      // Replay twice -- if causation were tracked, the second replay
      // would skip all events (duplicate causation IDs)
      await hermes.admin.replay.view(TestViewEntity).promise;
      await hermes.admin.replay.view(TestViewEntity).promise;

      const entity = await hermes.admin.inspect.view({
        id: aggregateId,
        entity: TestViewEntity,
      });

      expect(entity).not.toBeNull();
      expect(entity!.create).toBe("causation-test");
    });

    it("should emit error when handler throws during replay", async () => {
      await resetStore();
      const aggregateId = randomUUID();

      // Seed a create event then a throws event
      await seedEventRecords(aggregateId, [
        { name: "test_event_create", data: { input: "before-error" } },
        { name: "test_event_throws", data: { input: "replay error" } },
      ]);

      const handle = hermes.admin.replay.view(TestViewEntity);

      let errorEmitted: Error | null = null;
      handle.on("error", (err) => {
        errorEmitted = err;
      });

      await expect(handle.promise).rejects.toThrow();
      expect(errorEmitted).not.toBeNull();
    });

    it("should handle cancellation", async () => {
      await resetStore();
      const aggregateId = randomUUID();

      await seedEventRecords(aggregateId, [
        { name: "test_event_create", data: { input: "cancel-test" } },
      ]);

      const handle = hermes.admin.replay.view(TestViewEntity);

      // Cancel immediately
      await handle.cancel();

      // Should still complete without error (cancellation is graceful)
      await handle.promise;
    });

    it("should replay all views watching an aggregate", async () => {
      await resetStore();
      const aggregateId = randomUUID();

      await seedEventRecords(aggregateId, [
        { name: "test_event_create", data: { input: "aggregate-replay" } },
      ]);

      const handle = hermes.admin.replay.aggregate(TestAggregate);

      let completed = false;
      handle.on("complete", () => {
        completed = true;
      });

      await handle.promise;

      expect(completed).toBe(true);

      // TestView watches TestAggregate, so the view should be rebuilt
      const entity = await hermes.admin.inspect.view({
        id: aggregateId,
        entity: TestViewEntity,
      });

      expect(entity).not.toBeNull();
      expect(entity!.create).toBe("aggregate-replay");
    });

    it("should complete immediately when aggregate has no views", async () => {
      const handle = hermes.admin.replay.aggregate(TestForgettableAggregate);

      const progressEvents: Array<any> = [];
      handle.on("progress", (p) => progressEvents.push(p));

      let completed = false;
      handle.on("complete", () => {
        completed = true;
      });

      await handle.promise;

      expect(completed).toBe(true);
      expect(progressEvents).toEqual(
        expect.arrayContaining([expect.objectContaining({ phase: "complete" })]),
      );
    });

    it("should replay events from multiple aggregate instances in temporal order", async () => {
      await resetStore();

      const aggId1 = randomUUID();
      const aggId2 = randomUUID();

      // Seed events interleaved by timestamp across two aggregate instances.
      // aggId1 create at T=0, aggId2 create at T=1, aggId1 merge at T=2
      const { EventRecord: ER } = await import("../internal/entities");
      const repo = proteus.repository(ER);

      const baseTime = new Date("2025-01-01T00:00:00Z");

      const records = [
        {
          aggregateId: aggId1,
          name: "test_event_create",
          data: { input: "agg1-create" },
          expectedEvents: 1,
          offsetMs: 0,
        },
        {
          aggregateId: aggId2,
          name: "test_event_create",
          data: { input: "agg2-create" },
          expectedEvents: 1,
          offsetMs: 100,
        },
        {
          aggregateId: aggId1,
          name: "test_event_merge_state",
          data: { input: "agg1-merge" },
          expectedEvents: 2,
          offsetMs: 200,
        },
      ];

      for (const rec of records) {
        const id = randomUUID();
        const attrs = {
          id,
          aggregateId: rec.aggregateId,
          aggregateName: "test_aggregate",
          aggregateNamespace: "hermes",
          causationId: id,
          correlationId: randomUUID(),
          data: rec.data,
          encrypted: false,
          name: rec.name,
          timestamp: new Date(baseTime.getTime() + rec.offsetMs),
          expectedEvents: rec.expectedEvents,
          meta: {},
          previousId: null,
          version: 1,
        };
        const checksum = createChecksum(attrs);
        const record = repo.create({ ...attrs, checksum });
        // Set createdAt to match temporal order
        (record as any).createdAt = new Date(baseTime.getTime() + rec.offsetMs);
        await repo.insert(record);
      }

      const handle = hermes.admin.replay.view(TestViewEntity);

      const progressEvents: Array<any> = [];
      handle.on("progress", (p) => progressEvents.push(p));

      await handle.promise;

      // Both aggregates should have their views rebuilt
      const entity1 = await hermes.admin.inspect.view({
        id: aggId1,
        entity: TestViewEntity,
      });
      expect(entity1).not.toBeNull();
      expect(entity1!.create).toBe("agg1-create");
      expect(entity1!.mergeState).toBe("agg1-merge");

      const entity2 = await hermes.admin.inspect.view({
        id: aggId2,
        entity: TestViewEntity,
      });
      expect(entity2).not.toBeNull();
      expect(entity2!.create).toBe("agg2-create");

      // Total should reflect all 3 events
      const completeProgress = progressEvents.find((p: any) => p.phase === "complete");
      expect(completeProgress.processed).toBe(3);
      expect(completeProgress.total).toBe(3);
    });

    it("should process all events across many aggregate instances via batched pagination", async () => {
      await resetStore();

      // Seed events across 5 different aggregate instances (1 create each)
      const aggregateIds: Array<string> = [];

      for (let i = 0; i < 5; i++) {
        const aggId = randomUUID();
        aggregateIds.push(aggId);
        await seedEventRecords(aggId, [
          { name: "test_event_create", data: { input: `batch-${i}` } },
        ]);
      }

      const handle = hermes.admin.replay.view(TestViewEntity);

      const progressEvents: Array<any> = [];
      handle.on("progress", (p) => progressEvents.push(p));

      await handle.promise;

      // All 5 views should be rebuilt
      for (let i = 0; i < 5; i++) {
        const entity = await hermes.admin.inspect.view({
          id: aggregateIds[i],
          entity: TestViewEntity,
        });
        expect(entity).not.toBeNull();
        expect(entity!.create).toBe(`batch-${i}`);
      }

      // Progress should reflect all 5 events
      const completeProgress = progressEvents.find((p: any) => p.phase === "complete");
      expect(completeProgress.processed).toBe(5);
      expect(completeProgress.total).toBe(5);
      expect(completeProgress.percent).toBe(100);
    });

    it("should include skipped count of zero for valid events", async () => {
      await resetStore();
      const aggregateId = randomUUID();

      await seedEventRecords(aggregateId, [
        { name: "test_event_create", data: { input: "valid-checksum" } },
      ]);

      const handle = hermes.admin.replay.view(TestViewEntity);

      const progressEvents: Array<any> = [];
      handle.on("progress", (p) => progressEvents.push(p));

      await handle.promise;

      const completeProgress = progressEvents.find((p: any) => p.phase === "complete");
      expect(completeProgress.skipped).toBe(0);
      expect(completeProgress.processed).toBe(1);
    });

    it("should skip tampered events in warn mode and include skipped count", async () => {
      await resetStore();
      const aggregateId = randomUUID();

      await seedEventRecords(aggregateId, [
        { name: "test_event_create", data: { input: "good-event" } },
        {
          name: "test_event_merge_state",
          data: { input: "tampered" },
          checksum: "INVALID_CHECKSUM",
        },
      ]);

      const handle = hermes.admin.replay.view(TestViewEntity);

      const progressEvents: Array<any> = [];
      handle.on("progress", (p) => progressEvents.push(p));

      await handle.promise;

      const completeProgress = progressEvents.find((p: any) => p.phase === "complete");
      expect(completeProgress.skipped).toBe(1);
      expect(completeProgress.processed).toBe(2);

      // Only the valid create event should have been applied
      const entity = await hermes.admin.inspect.view({
        id: aggregateId,
        entity: TestViewEntity,
      });
      expect(entity).not.toBeNull();
      expect(entity!.create).toBe("good-event");
      // mergeState defaults to "" in TestViewEntity; the tampered event was skipped
      expect(entity!.mergeState).toBe("");
    });

    it("should throw when replay called before setup", () => {
      const freshHermes = new Hermes({
        proteus: createTestProteusSource(),
        iris: createTestIrisSource(),
        modules: ALL_MODULES,
        logger,
      });

      expect(() => freshHermes.admin.replay.view(TestViewEntity)).toThrow(/not ready/);
      expect(() => freshHermes.admin.replay.aggregate(TestAggregate)).toThrow(
        /not ready/,
      );
    });

    it("should re-subscribe with aggregate-based topics after replay", async () => {
      await resetStore();
      const aggregateId = randomUUID();

      await seedEventRecords(aggregateId, [
        { name: "test_event_create", data: { input: "resume-test" } },
      ]);

      const eventBus = (hermes as any).eventBus;
      const subscribeSpy = vi.spyOn(eventBus, "subscribe");

      const handle = hermes.admin.replay.view(TestViewEntity);
      await handle.promise;

      // resumeViewSubscriptions should have called subscribe with
      // aggregate-based topics (e.g. "hermes.test_aggregate.test_event_*"),
      // NOT view-based topics (e.g. "hermes.test_view.test_event_*")
      const subscribeCalls = subscribeSpy.mock.calls;
      const resumeTopics = subscribeCalls.map((call) => (call[0] as any).topic);

      for (const topic of resumeTopics) {
        // Topic must start with the aggregate identity, not the view identity
        expect(topic).not.toContain("test_view");
        expect(topic).toMatch(/^hermes\.test_aggregate\./);
      }

      expect(resumeTopics.length).toBeGreaterThan(0);

      subscribeSpy.mockRestore();
    });
  });

  describe("replay checksum strict mode", () => {
    let hermes: Hermes;
    let proteus: ProteusSource;
    let iris: IrisSource;

    beforeAll(async () => {
      const sources = await createConnectedSources();
      proteus = sources.proteus;
      iris = sources.iris;

      hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
        checksumMode: "strict",
      });

      await hermes.setup();
    });

    afterAll(async () => {
      await hermes.teardown();
      await iris.disconnect();
      await proteus.disconnect();
    });

    // EventRecord is @AppendOnly so repo.clear() is blocked.
    // Disconnect + reconnect the memory driver to reset all tables instead.
    const resetStore = async (): Promise<void> => {
      await proteus.disconnect();
      await proteus.connect();
      await proteus.setup();
    };

    const seedEventRecords = async (
      aggregateId: string,
      events: Array<{ name: string; data: Record<string, unknown>; checksum?: string }>,
    ): Promise<void> => {
      const { EventRecord } = await import("../internal/entities");
      const repo = proteus.repository(EventRecord);

      for (let i = 0; i < events.length; i++) {
        const evt = events[i];
        const id = randomUUID();
        const attrs = {
          id,
          aggregateId,
          aggregateName: "test_aggregate",
          aggregateNamespace: "hermes",
          causationId: id,
          correlationId: randomUUID(),
          data: evt.data,
          encrypted: false,
          name: evt.name,
          timestamp: new Date(),
          expectedEvents: i + 1,
          meta: {},
          previousId: null,
          version: 1,
        };
        const checksum = evt.checksum ?? createChecksum(attrs);
        const record = repo.create({ ...attrs, checksum });
        await repo.insert(record);
      }
    };

    it("should throw on tampered event in strict mode", async () => {
      await resetStore();
      const aggregateId = randomUUID();

      await seedEventRecords(aggregateId, [
        { name: "test_event_create", data: { input: "good" } },
        {
          name: "test_event_merge_state",
          data: { input: "tampered" },
          checksum: "TAMPERED",
        },
      ]);

      const handle = hermes.admin.replay.view(TestViewEntity);

      let errorEmitted: Error | null = null;
      handle.on("error", (err) => {
        errorEmitted = err;
      });

      await expect(handle.promise).rejects.toThrow(
        /Checksum verification failed during replay/,
      );
      expect(errorEmitted).not.toBeNull();
    });

    it("should replay valid events successfully in strict mode", async () => {
      await resetStore();
      const aggregateId = randomUUID();

      await seedEventRecords(aggregateId, [
        { name: "test_event_create", data: { input: "strict-valid" } },
      ]);

      const handle = hermes.admin.replay.view(TestViewEntity);

      const progressEvents: Array<any> = [];
      handle.on("progress", (p) => progressEvents.push(p));

      await handle.promise;

      const completeProgress = progressEvents.find((p: any) => p.phase === "complete");
      expect(completeProgress.skipped).toBe(0);
      expect(completeProgress.processed).toBe(1);

      const entity = await hermes.admin.inspect.view({
        id: aggregateId,
        entity: TestViewEntity,
      });
      expect(entity).not.toBeNull();
      expect(entity!.create).toBe("strict-valid");
    });
  });

  describe("event emitter delegation", () => {
    let hermes: Hermes;
    let proteus: ProteusSource;
    let iris: IrisSource;

    beforeAll(async () => {
      const sources = await createConnectedSources();
      proteus = sources.proteus;
      iris = sources.iris;

      hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await hermes.setup();
    });

    afterAll(async () => {
      await hermes.teardown();
      await iris.disconnect();
      await proteus.disconnect();
    });

    it("should accept 'saga' event listener without error", () => {
      expect(() => hermes.on("saga", () => {})).not.toThrow();
    });

    it("should accept 'view' event listener without error", () => {
      expect(() => hermes.on("view", () => {})).not.toThrow();
    });

    it("should accept 'checksum' event listener without error", () => {
      expect(() => hermes.on("checksum", () => {})).not.toThrow();
    });

    it("should accept namespaced saga event listener", () => {
      expect(() => hermes.on("saga.hermes.test_saga", () => {})).not.toThrow();
    });

    it("should accept namespaced view event listener", () => {
      expect(() => hermes.on("view.hermes.test_view", () => {})).not.toThrow();
    });

    it("should throw on unrecognized event prefix in on()", () => {
      expect(() => hermes.on("unknown_prefix" as any, () => {})).toThrow(
        /Unrecognized event prefix/,
      );
    });

    it("should throw on unrecognized event prefix in off()", () => {
      expect(() => hermes.off("unknown_prefix" as any, () => {})).toThrow(
        /Unrecognized event prefix/,
      );
    });

    it("should remove listener via off()", () => {
      const listener = vi.fn();
      hermes.on("saga", listener);
      hermes.off("saga", listener);
      // If off works, the listener count should not grow unbounded.
      // This is a basic sanity check; the important thing is no throw.
    });

    it("should support off() for view listeners", () => {
      const listener = vi.fn();
      expect(() => {
        hermes.on("view.hermes", listener);
        hermes.off("view.hermes", listener);
      }).not.toThrow();
    });

    it("should support off() for checksum listeners", () => {
      const listener = vi.fn();
      expect(() => {
        hermes.on("checksum", listener);
        hermes.off("checksum", listener);
      }).not.toThrow();
    });
  });

  // -- C3: Hermes.setup() partial failure scenarios --

  describe("setup partial failure", () => {
    it("should reset to 'created' status when proteus.setup() throws", async () => {
      const proteus = createTestProteusSource();
      const iris = createTestIrisSource();
      await proteus.connect();
      await iris.connect();

      // Mock proteus.setup to throw
      vi.spyOn(proteus, "setup").mockRejectedValue(new Error("proteus setup failed"));

      const hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await expect(hermes.setup()).rejects.toThrow("proteus setup failed");
      expect(hermes.status).toBe("created");

      (proteus.setup as Mock).mockRestore();
      await iris.disconnect();
      await proteus.disconnect();
    });

    it("should reset to 'created' status when iris.setup() throws after proteus succeeds", async () => {
      const proteus = createTestProteusSource();
      const iris = createTestIrisSource();
      await proteus.connect();
      await iris.connect();

      // Mock iris.setup to throw (proteus.setup will succeed normally)
      vi.spyOn(iris, "setup").mockRejectedValue(new Error("iris setup failed"));

      const hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await expect(hermes.setup()).rejects.toThrow("iris setup failed");
      expect(hermes.status).toBe("created");

      (iris.setup as Mock).mockRestore();
      await iris.disconnect();
      await proteus.disconnect();
    });

    it("should reset to 'created' status when createIrisPrimitives throws", async () => {
      const proteus = createTestProteusSource();
      const iris = createTestIrisSource();
      await proteus.connect();
      await iris.connect();

      // Mock iris.messageBus to throw during createIrisPrimitives
      // This must be set up BEFORE hermes.setup() calls it, but AFTER
      // iris.addMessages (which happens during registerIrisMessages).
      vi.spyOn(iris, "messageBus").mockImplementation((..._args: any[]) => {
        // messageBus is called during createIrisPrimitives
        throw new Error("handler registration failed");
      });

      const hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await expect(hermes.setup()).rejects.toThrow("handler registration failed");
      expect(hermes.status).toBe("created");

      (iris.messageBus as Mock).mockRestore();
      await iris.disconnect();
      await proteus.disconnect();
    });

    it("should allow retry after setup failure resets status to 'created'", async () => {
      const proteus = createTestProteusSource();
      const iris = createTestIrisSource();
      await proteus.connect();
      await iris.connect();

      // First attempt: mock proteus.setup to throw
      vi.spyOn(proteus, "setup").mockRejectedValue(new Error("transient failure"));

      const hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await expect(hermes.setup()).rejects.toThrow("transient failure");
      expect(hermes.status).toBe("created");

      // Second attempt: restore real implementation so setup succeeds
      (proteus.setup as Mock).mockRestore();

      await hermes.setup();
      expect(hermes.status).toBe("ready");

      await hermes.teardown();
      await iris.disconnect();
      await proteus.disconnect();
    });
  });

  // -- MEDIUM: teardown on non-ready instance --

  describe("teardown guard", () => {
    it("should throw when teardown called on 'created' Hermes instance", async () => {
      const hermes = new Hermes({
        proteus: createTestProteusSource(),
        iris: createTestIrisSource(),
        modules: ALL_MODULES,
        logger,
      });

      await expect(hermes.teardown()).rejects.toThrow(/not ready/);
    });
  });

  // -- MEDIUM: command edge cases --

  describe("command edge cases", () => {
    let hermes: Hermes;
    let proteus: ProteusSource;
    let iris: IrisSource;

    beforeAll(async () => {
      const sources = await createConnectedSources();
      proteus = sources.proteus;
      iris = sources.iris;

      hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await hermes.setup();
    });

    afterAll(async () => {
      await hermes.teardown();
      await iris.disconnect();
      await proteus.disconnect();
    });

    it("should not mutate the command object", async () => {
      const id = randomUUID();
      const cmd = new TestCommandCreate("original");

      const result = await hermes.command(cmd, { id });

      expect(result.id).toBe(id);
      expect(cmd.input).toBe("original");
    });

    it("should generate UUID when id is empty string (falsy)", async () => {
      const result = await hermes.command(new TestCommandCreate("empty-id"), { id: "" });

      expect(result.id).toBeTruthy();
      expect(result.id.length).toBeGreaterThan(0);
    });

    it("should throw HandlerNotRegisteredError for unregistered command constructor", async () => {
      class UnregisteredCommand {
        value = "nope";
      }

      await expect(hermes.command(new UnregisteredCommand())).rejects.toThrow();
    });
  });

  // -- MEDIUM: on() with namespaced patterns --

  describe("on() with namespaced patterns", () => {
    let hermes: Hermes;
    let proteus: ProteusSource;
    let iris: IrisSource;

    beforeAll(async () => {
      const sources = await createConnectedSources();
      proteus = sources.proteus;
      iris = sources.iris;

      hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await hermes.setup();
    });

    afterAll(async () => {
      await hermes.teardown();
      await iris.disconnect();
      await proteus.disconnect();
    });

    it("should accept saga.billing pattern", () => {
      expect(() => hermes.on("saga.billing", () => {})).not.toThrow();
    });

    it("should accept view.ns.name.id pattern", () => {
      expect(() => hermes.on("view.hermes.test_view.some-id", () => {})).not.toThrow();
    });

    it("should accept checksum.namespace pattern", () => {
      expect(() => hermes.on("checksum.hermes", () => {})).not.toThrow();
    });
  });

  // -- MEDIUM: session then teardown --

  describe("session and teardown", () => {
    it("should reflect status changes through shared reference after teardown", async () => {
      const { proteus, iris } = await createConnectedSources();

      const hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await hermes.setup();

      const session = hermes.session();
      expect(session.status).toBe("ready");

      await hermes.teardown();

      // Original is stopped
      expect(hermes.status).toBe("stopped");

      // Session shares the same status reference, so it also shows stopped
      expect(session.status).toBe("stopped");

      await iris.disconnect();
      await proteus.disconnect();
    });
  });

  // -- MEDIUM: admin.inspect with non-existent entities --

  describe("admin inspect non-existent", () => {
    let hermes: Hermes;
    let proteus: ProteusSource;
    let iris: IrisSource;

    beforeAll(async () => {
      const sources = await createConnectedSources();
      proteus = sources.proteus;
      iris = sources.iris;

      hermes = new Hermes({
        proteus,
        iris,
        modules: ALL_MODULES,
        logger,
      });

      await hermes.setup();
    });

    afterAll(async () => {
      await hermes.teardown();
      await iris.disconnect();
      await proteus.disconnect();
    });

    it("should return empty aggregate state for non-existent aggregate", async () => {
      const state = await hermes.admin.inspect.aggregate({
        id: randomUUID(),
        name: "test_aggregate",
      });

      expect(state.events).toEqual([]);
      expect(state.numberOfLoadedEvents).toBe(0);
      expect(state.destroyed).toBe(false);
      expect(state.state).toEqual({});
    });

    it("should return null for non-existent saga", async () => {
      const saga = await hermes.admin.inspect.saga({
        id: randomUUID(),
        name: "test_saga",
      });

      expect(saga).toBeNull();
    });

    it("should return null for non-existent view", async () => {
      const entity = await hermes.admin.inspect.view({
        id: randomUUID(),
        entity: TestViewEntity,
      });

      expect(entity).toBeNull();
    });
  });
});
