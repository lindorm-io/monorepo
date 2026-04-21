import {
  TestAggregate,
  TestForgettableAggregate,
  TestUpcasterAggregate,
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
  TestEventUpcast_V1,
  TestEventUpcast_V2,
  TestEventUpcast_V3,
} from "../../__fixtures__/modules/events";
import { TestViewQuery } from "../../__fixtures__/modules/queries";
import { TestSaga } from "../../__fixtures__/modules/sagas";
import { TestTimeoutReminder } from "../../__fixtures__/modules/timeouts";
import { TestView } from "../../__fixtures__/modules/views/TestView";
import { TestViewEntity } from "../../__fixtures__/modules/views/TestViewEntity";
import { HermesViewEntity } from "../../entities/HermesViewEntity";
import { HermesScanner } from "./HermesScanner";
import type { ScannedModules } from "./types";
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

describe("HermesScanner", () => {
  describe("scan", () => {
    let result: ScannedModules;

    beforeAll(async () => {
      result = await HermesScanner.scan(ALL_CONSTRUCTORS);
    });

    test("should return complete scanned modules structure", () => {
      expect(result).toMatchSnapshot();
    });

    // -- Commands --

    test("should classify @Command classes as commands", () => {
      expect(result.commands).toHaveLength(9);

      const names = result.commands.map((c) => c.name);
      expect(names).toContain("test_command_create");
      expect(names).toContain("test_command_destroy");
      expect(names).toContain("test_command_destroy_next");
      expect(names).toContain("test_command_dispatch");
      expect(names).toContain("test_command_encrypt");
      expect(names).toContain("test_command_merge_state");
      expect(names).toContain("test_command_set_state");
      expect(names).toContain("test_command_throws");
      expect(names).toContain("test_command_timeout");
    });

    test("should set version to 1 for commands without explicit version", () => {
      for (const cmd of result.commands) {
        expect(cmd.version).toBe(1);
      }
    });

    test("should set kind to 'command' for all command DTOs", () => {
      for (const cmd of result.commands) {
        expect(cmd.kind).toBe("command");
      }
    });

    test("should set target constructor on command DTOs", () => {
      const create = result.commands.find((c) => c.name === "test_command_create");
      expect(create?.target).toBe(TestCommandCreate);
    });

    // -- Events --

    test("should classify @Event classes as events", () => {
      expect(result.events).toHaveLength(12);

      const names = result.events.map((e) => e.name);
      expect(names).toContain("test_event_create");
      expect(names).toContain("test_event_destroy");
      expect(names).toContain("test_event_destroy_next");
      expect(names).toContain("test_event_dispatch");
      expect(names).toContain("test_event_encrypt");
      expect(names).toContain("test_event_merge_state");
      expect(names).toContain("test_event_set_state");
      expect(names).toContain("test_event_throws");
      expect(names).toContain("test_event_timeout");
      expect(names).toContain("test_event_upcast");
    });

    test("should set kind to 'event' for all event DTOs", () => {
      for (const evt of result.events) {
        expect(evt.kind).toBe("event");
      }
    });

    // -- Queries --

    test("should classify @Query classes as queries", () => {
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0].name).toBe("test_view_query");
      expect(result.queries[0].kind).toBe("query");
      expect(result.queries[0].target).toBe(TestViewQuery);
    });

    // -- Timeouts --

    test("should classify @Timeout classes as timeouts", () => {
      expect(result.timeouts).toHaveLength(1);
      expect(result.timeouts[0].name).toBe("test_timeout_reminder");
      expect(result.timeouts[0].kind).toBe("timeout");
      expect(result.timeouts[0].target).toBe(TestTimeoutReminder);
    });

    // -- Aggregates --

    test("should classify @Aggregate classes with all handlers resolved", () => {
      expect(result.aggregates).toHaveLength(3);
    });

    test("should resolve TestAggregate with correct name and namespace", () => {
      const agg = result.aggregates.find((a) => a.target === TestAggregate);
      expect(agg).toBeDefined();
      expect(agg!.name).toBe("test_aggregate");
      expect(agg!.namespace).toBe("hermes");
      expect(agg!.forgettable).toBe(false);
    });

    test("should resolve TestAggregate command handlers", () => {
      const agg = result.aggregates.find((a) => a.target === TestAggregate)!;
      expect(agg.commandHandlers).toHaveLength(9);

      const triggers = agg.commandHandlers.map((h) => h.trigger);
      expect(triggers).toContain(TestCommandCreate);
      expect(triggers).toContain(TestCommandDestroy);
      expect(triggers).toContain(TestCommandDestroyNext);
      expect(triggers).toContain(TestCommandDispatch);
      expect(triggers).toContain(TestCommandEncrypt);
      expect(triggers).toContain(TestCommandMergeState);
      expect(triggers).toContain(TestCommandSetState);
      expect(triggers).toContain(TestCommandThrows);
      expect(triggers).toContain(TestCommandTimeout);
    });

    test("should resolve TestAggregate event handlers", () => {
      const agg = result.aggregates.find((a) => a.target === TestAggregate)!;
      expect(agg.eventHandlers).toHaveLength(9);

      const triggers = agg.eventHandlers.map((h) => h.trigger);
      expect(triggers).toContain(TestEventCreate);
      expect(triggers).toContain(TestEventDestroy);
      expect(triggers).toContain(TestEventDestroyNext);
      expect(triggers).toContain(TestEventDispatch);
      expect(triggers).toContain(TestEventEncrypt);
      expect(triggers).toContain(TestEventMergeState);
      expect(triggers).toContain(TestEventSetState);
      expect(triggers).toContain(TestEventThrows);
      expect(triggers).toContain(TestEventTimeout);
    });

    test("should resolve TestAggregate error handlers", () => {
      const agg = result.aggregates.find((a) => a.target === TestAggregate)!;
      expect(agg.errorHandlers).toHaveLength(1);
      expect(agg.errorHandlers[0].kind).toBe("AggregateErrorHandler");
    });

    test("should resolve @RequireNotCreated condition on create command handler", () => {
      const agg = result.aggregates.find((a) => a.target === TestAggregate)!;
      const createHandler = agg.commandHandlers.find(
        (h) => h.trigger === TestCommandCreate,
      )!;
      expect(createHandler.conditions).toMatchSnapshot();
    });

    test("should resolve @RequireCreated condition on destroy command handler", () => {
      const agg = result.aggregates.find((a) => a.target === TestAggregate)!;
      const destroyHandler = agg.commandHandlers.find(
        (h) => h.trigger === TestCommandDestroy,
      )!;
      expect(destroyHandler.conditions).toMatchSnapshot();
    });

    test("should resolve @Validate schema on create command handler", () => {
      const agg = result.aggregates.find((a) => a.target === TestAggregate)!;
      const createHandler = agg.commandHandlers.find(
        (h) => h.trigger === TestCommandCreate,
      )!;
      expect(createHandler.schema).not.toBeNull();
    });

    test("should have null schema on handlers without @Validate", () => {
      const agg = result.aggregates.find((a) => a.target === TestAggregate)!;
      const destroyHandler = agg.commandHandlers.find(
        (h) => h.trigger === TestCommandDestroy,
      )!;
      expect(destroyHandler.schema).toBeNull();
    });

    // -- Forgettable aggregate --

    test("should resolve @Forgettable on TestForgettableAggregate", () => {
      const agg = result.aggregates.find((a) => a.target === TestForgettableAggregate);
      expect(agg).toBeDefined();
      expect(agg!.forgettable).toBe(true);
    });

    test("should resolve @Namespace on TestForgettableAggregate", () => {
      const agg = result.aggregates.find((a) => a.target === TestForgettableAggregate);
      expect(agg!.namespace).toBe("billing");
    });

    test("should resolve TestForgettableAggregate handlers", () => {
      const agg = result.aggregates.find((a) => a.target === TestForgettableAggregate)!;
      expect(agg.commandHandlers).toHaveLength(1);
      expect(agg.eventHandlers).toHaveLength(1);
      expect(agg.errorHandlers).toHaveLength(0);
    });

    // -- Upcaster aggregate --

    test("should resolve TestUpcasterAggregate with upcasters", () => {
      const agg = result.aggregates.find((a) => a.target === TestUpcasterAggregate);
      expect(agg).toBeDefined();
      expect(agg!.name).toBe("test_upcaster_aggregate");
      expect(agg!.upcasters).toHaveLength(2);
    });

    test("should resolve upcaster from/to versions via extractNameData", () => {
      const agg = result.aggregates.find((a) => a.target === TestUpcasterAggregate)!;
      const v1to2 = agg.upcasters.find((u) => u.fromVersion === 1);
      expect(v1to2).toBeDefined();
      expect(v1to2!.fromName).toBe("test_event_upcast");
      expect(v1to2!.fromVersion).toBe(1);
      expect(v1to2!.toVersion).toBe(2);
      expect(v1to2!.method).toBe("upcastV1toV2");
      expect(v1to2!.from).toBe(TestEventUpcast_V1);
      expect(v1to2!.to).toBe(TestEventUpcast_V2);
    });

    test("should resolve second upcaster v2 to v3", () => {
      const agg = result.aggregates.find((a) => a.target === TestUpcasterAggregate)!;
      const v2to3 = agg.upcasters.find((u) => u.fromVersion === 2);
      expect(v2to3).toBeDefined();
      expect(v2to3!.fromName).toBe("test_event_upcast");
      expect(v2to3!.toVersion).toBe(3);
      expect(v2to3!.method).toBe("upcastV2toV3");
      expect(v2to3!.from).toBe(TestEventUpcast_V2);
      expect(v2to3!.to).toBe(TestEventUpcast_V3);
    });

    test("should have empty upcasters on aggregates without upcaster metadata", () => {
      const agg = result.aggregates.find((a) => a.target === TestAggregate)!;
      expect(agg.upcasters).toEqual([]);
    });

    // -- Sagas --

    test("should classify @Saga with aggregate references resolved", () => {
      expect(result.sagas).toHaveLength(1);
      const saga = result.sagas[0];
      expect(saga.name).toBe("test_saga");
      expect(saga.namespace).toBe("hermes");
      expect(saga.target).toBe(TestSaga);
    });

    test("should resolve saga aggregate references to names", () => {
      const saga = result.sagas[0];
      expect(saga.aggregates).toHaveLength(1);
      expect(saga.aggregates[0].name).toBe("test_aggregate");
      expect(saga.aggregates[0].namespace).toBe("hermes");
    });

    test("should resolve saga event handlers", () => {
      const saga = result.sagas[0];
      expect(saga.eventHandlers).toHaveLength(5);

      const triggers = saga.eventHandlers.map((h) => h.trigger);
      expect(triggers).toContain(TestEventCreate);
      expect(triggers).toContain(TestEventMergeState);
      expect(triggers).toContain(TestEventDispatch);
      expect(triggers).toContain(TestEventThrows);
      expect(triggers).toContain(TestEventDestroy);
    });

    test("should resolve saga id handlers", () => {
      const saga = result.sagas[0];
      expect(saga.idHandlers).toHaveLength(1);
      expect(saga.idHandlers[0].trigger).toBe(TestEventCreate);
      expect(saga.idHandlers[0].kind).toBe("SagaIdHandler");
    });

    test("should resolve saga timeout handlers", () => {
      const saga = result.sagas[0];
      expect(saga.timeoutHandlers).toHaveLength(1);
      expect(saga.timeoutHandlers[0].trigger).toBe(TestTimeoutReminder);
      expect(saga.timeoutHandlers[0].kind).toBe("SagaTimeoutHandler");
    });

    test("should resolve saga error handlers", () => {
      const saga = result.sagas[0];
      expect(saga.errorHandlers).toHaveLength(1);
      expect(saga.errorHandlers[0].kind).toBe("SagaErrorHandler");
    });

    test("should resolve @RequireNotCreated on saga create event handler", () => {
      const saga = result.sagas[0];
      const createHandler = saga.eventHandlers.find(
        (h) => h.trigger === TestEventCreate,
      )!;
      expect(createHandler.conditions).toMatchSnapshot();
    });

    test("should resolve @RequireCreated on saga merge state event handler", () => {
      const saga = result.sagas[0];
      const mergeHandler = saga.eventHandlers.find(
        (h) => h.trigger === TestEventMergeState,
      )!;
      expect(mergeHandler.conditions).toMatchSnapshot();
    });

    // -- Views --

    test("should classify @View with entity constructor and handlers", () => {
      expect(result.views).toHaveLength(1);
      const view = result.views[0];
      expect(view.name).toBe("test_view");
      expect(view.namespace).toBe("hermes");
      expect(view.target).toBe(TestView);
      expect(view.entity).toBe(TestViewEntity);
      expect(view.driverType).toBeNull();
    });

    test("should resolve view aggregate references to names", () => {
      const view = result.views[0];
      expect(view.aggregates).toHaveLength(1);
      expect(view.aggregates[0].name).toBe("test_aggregate");
      expect(view.aggregates[0].namespace).toBe("hermes");
    });

    test("should resolve view event handlers", () => {
      const view = result.views[0];
      expect(view.eventHandlers).toHaveLength(5);

      const triggers = view.eventHandlers.map((h) => h.trigger);
      expect(triggers).toContain(TestEventCreate);
      expect(triggers).toContain(TestEventMergeState);
      expect(triggers).toContain(TestEventSetState);
      expect(triggers).toContain(TestEventThrows);
      expect(triggers).toContain(TestEventDestroy);
    });

    test("should resolve view id handlers", () => {
      const view = result.views[0];
      expect(view.idHandlers).toHaveLength(1);
      expect(view.idHandlers[0].trigger).toBe(TestEventCreate);
      expect(view.idHandlers[0].kind).toBe("ViewIdHandler");
    });

    test("should resolve view query handlers", () => {
      const view = result.views[0];
      expect(view.queryHandlers).toHaveLength(1);
      expect(view.queryHandlers[0].trigger).toBe(TestViewQuery);
      expect(view.queryHandlers[0].kind).toBe("ViewQueryHandler");
    });

    test("should resolve view error handlers", () => {
      const view = result.views[0];
      expect(view.errorHandlers).toHaveLength(2);
      expect(view.errorHandlers[0].kind).toBe("ViewErrorHandler");
      expect(view.errorHandlers[1].kind).toBe("ViewErrorHandler");
    });

    // -- Error cases --

    test("should throw when view entity does not extend HermesViewEntity", async () => {
      class BadEntity {
        id = "";
      }

      class BadView {}
      (BadView as any)[Symbol.metadata] = {
        view: {
          name: "bad_view",
          aggregates: [TestAggregate],
          entity: BadEntity,
          driverType: null,
        },
        handlers: [],
      };

      await expect(HermesScanner.scan([BadView])).rejects.toThrow(
        'View "bad_view" entity class "BadEntity" must extend HermesViewEntity',
      );
    });

    // -- Empty input --

    test("should handle empty input", async () => {
      const empty = await HermesScanner.scan([]);
      expect(empty).toMatchSnapshot();
    });

    // -- Constructor input (no file scanning) --

    test("should accept Constructor[] input without file paths", async () => {
      const partial = await HermesScanner.scan([TestCommandCreate, TestEventCreate]);
      expect(partial.commands).toHaveLength(1);
      expect(partial.events).toHaveLength(1);
      expect(partial.queries).toHaveLength(0);
      expect(partial.timeouts).toHaveLength(0);
      expect(partial.aggregates).toHaveLength(0);
      expect(partial.sagas).toHaveLength(0);
      expect(partial.views).toHaveLength(0);
    });

    // -- Classes without hermes metadata are silently skipped --

    test("should skip classes without hermes metadata", async () => {
      class PlainClass {}

      const partial = await HermesScanner.scan([PlainClass, TestCommandCreate]);
      expect(partial.commands).toHaveLength(1);
      expect(partial.commands[0].target).toBe(TestCommandCreate);
    });

    // -- MEDIUM: Multiple plain classes silently skipped --

    test("should silently skip multiple classes without hermes metadata", async () => {
      class PlainA {}
      class PlainB {}
      class PlainC {}

      const partial = await HermesScanner.scan([PlainA, PlainB, PlainC, TestEventCreate]);
      expect(partial.commands).toHaveLength(0);
      expect(partial.events).toHaveLength(1);
      expect(partial.events[0].target).toBe(TestEventCreate);
      expect(partial.aggregates).toHaveLength(0);
      expect(partial.sagas).toHaveLength(0);
      expect(partial.views).toHaveLength(0);
    });

    // -- MEDIUM: resolveAggregateName: missing @Aggregate metadata --

    test("should throw when saga references a class without @Aggregate metadata", async () => {
      class NotAnAggregate {}

      class BadSaga {}
      (BadSaga as any)[Symbol.metadata] = {
        saga: {
          name: "bad_saga",
          aggregates: [NotAnAggregate],
        },
        handlers: [],
      };

      await expect(HermesScanner.scan([BadSaga])).rejects.toThrow(
        /has no @Aggregate\(\) metadata/,
      );
    });
  });
});
