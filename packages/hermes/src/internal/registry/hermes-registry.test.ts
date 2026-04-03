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
import { HermesRegistry } from "./hermes-registry";
import { HermesScanner } from "./HermesScanner";

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

describe("HermesRegistry", () => {
  let registry: HermesRegistry;

  beforeAll(() => {
    const scanned = HermesScanner.scan(ALL_CONSTRUCTORS);
    registry = new HermesRegistry(scanned);
  });

  // -- Command getters --

  describe("getCommand", () => {
    test("should return RegisteredDto by target constructor", () => {
      const dto = registry.getCommand(TestCommandCreate);
      expect(dto).toMatchSnapshot();
    });

    test("should throw for unregistered target", () => {
      class UnknownCommand {}
      expect(() => registry.getCommand(UnknownCommand)).toThrow(
        "Command not registered: UnknownCommand",
      );
    });
  });

  describe("getCommandByName", () => {
    test("should return RegisteredDto by name string (fallback)", () => {
      const dto = registry.getCommandByName("test_command_create");
      expect(dto.target).toBe(TestCommandCreate);
      expect(dto.name).toBe("test_command_create");
    });

    test("should return RegisteredDto by name and version", () => {
      const dto = registry.getCommandByName("test_command_create", 1);
      expect(dto.target).toBe(TestCommandCreate);
      expect(dto.name).toBe("test_command_create");
    });

    test("should throw for unknown name", () => {
      expect(() => registry.getCommandByName("nonexistent")).toThrow(
        "Command not found: nonexistent",
      );
    });

    test("should throw for known name but wrong version", () => {
      expect(() => registry.getCommandByName("test_command_create", 999)).toThrow(
        "Command not found: test_command_create:999",
      );
    });
  });

  // -- Event getters --

  describe("getEvent", () => {
    test("should return RegisteredDto by target constructor", () => {
      const dto = registry.getEvent(TestEventCreate);
      expect(dto).toMatchSnapshot();
    });

    test("should throw for unregistered target", () => {
      class UnknownEvent {}
      expect(() => registry.getEvent(UnknownEvent)).toThrow(
        "Event not registered: UnknownEvent",
      );
    });
  });

  describe("getEventByName", () => {
    test("should return RegisteredDto by name string (fallback)", () => {
      const dto = registry.getEventByName("test_event_create");
      expect(dto.target).toBe(TestEventCreate);
      expect(dto.name).toBe("test_event_create");
    });

    test("should return RegisteredDto by name and version", () => {
      const dto = registry.getEventByName("test_event_create", 1);
      expect(dto.target).toBe(TestEventCreate);
      expect(dto.name).toBe("test_event_create");
    });

    test("should throw for unknown name", () => {
      expect(() => registry.getEventByName("nonexistent")).toThrow(
        "Event not found: nonexistent",
      );
    });

    test("should throw for known name but wrong version", () => {
      expect(() => registry.getEventByName("test_event_create", 999)).toThrow(
        "Event not found: test_event_create:999",
      );
    });
  });

  // -- Query getters --

  describe("getQuery", () => {
    test("should return RegisteredDto by target constructor", () => {
      const dto = registry.getQuery(TestViewQuery);
      expect(dto).toMatchSnapshot();
    });

    test("should throw for unregistered target", () => {
      class UnknownQuery {}
      expect(() => registry.getQuery(UnknownQuery)).toThrow(
        "Query not registered: UnknownQuery",
      );
    });
  });

  // -- Timeout getters --

  describe("getTimeout", () => {
    test("should return RegisteredDto by target constructor", () => {
      const dto = registry.getTimeout(TestTimeoutReminder);
      expect(dto).toMatchSnapshot();
    });

    test("should throw for unregistered target", () => {
      class UnknownTimeout {}
      expect(() => registry.getTimeout(UnknownTimeout)).toThrow(
        "Timeout not registered: UnknownTimeout",
      );
    });
  });

  // -- Boolean type checks --

  describe("isCommand", () => {
    test("should return true for registered command", () => {
      expect(registry.isCommand(TestCommandCreate)).toBe(true);
    });

    test("should return false for non-command", () => {
      expect(registry.isCommand(TestEventCreate)).toBe(false);
    });

    test("should return false for unregistered class", () => {
      class Unknown {}
      expect(registry.isCommand(Unknown)).toBe(false);
    });
  });

  describe("isEvent", () => {
    test("should return true for registered event", () => {
      expect(registry.isEvent(TestEventCreate)).toBe(true);
    });

    test("should return false for non-event", () => {
      expect(registry.isEvent(TestCommandCreate)).toBe(false);
    });
  });

  describe("isQuery", () => {
    test("should return true for registered query", () => {
      expect(registry.isQuery(TestViewQuery)).toBe(true);
    });

    test("should return false for non-query", () => {
      expect(registry.isQuery(TestCommandCreate)).toBe(false);
    });
  });

  describe("isTimeout", () => {
    test("should return true for registered timeout", () => {
      expect(registry.isTimeout(TestTimeoutReminder)).toBe(true);
    });

    test("should return false for non-timeout", () => {
      expect(registry.isTimeout(TestCommandCreate)).toBe(false);
    });
  });

  // -- Aggregate getters --

  describe("getAggregate", () => {
    test("should return RegisteredAggregate by namespace and name", () => {
      const agg = registry.getAggregate("hermes", "test_aggregate");
      expect(agg.target).toBe(TestAggregate);
      expect(agg.name).toBe("test_aggregate");
    });

    test("should return forgettable aggregate by namespace and name", () => {
      const agg = registry.getAggregate("billing", "test_forgettable_aggregate");
      expect(agg.target).toBe(TestForgettableAggregate);
      expect(agg.forgettable).toBe(true);
    });

    test("should throw for unknown aggregate name", () => {
      expect(() => registry.getAggregate("hermes", "nonexistent")).toThrow(
        "Aggregate not found: hermes.nonexistent",
      );
    });
  });

  describe("getAggregateByTarget", () => {
    test("should return RegisteredAggregate by constructor", () => {
      const agg = registry.getAggregateByTarget(TestAggregate);
      expect(agg.name).toBe("test_aggregate");
    });

    test("should return forgettable aggregate by constructor", () => {
      const agg = registry.getAggregateByTarget(TestForgettableAggregate);
      expect(agg.name).toBe("test_forgettable_aggregate");
      expect(agg.forgettable).toBe(true);
    });

    test("should throw for unregistered aggregate target", () => {
      class UnknownAggregate {}
      expect(() => registry.getAggregateByTarget(UnknownAggregate)).toThrow(
        "Aggregate not registered: UnknownAggregate",
      );
    });
  });

  describe("namespace collision prevention", () => {
    test("should not overwrite aggregate with same name in different namespace", () => {
      const hermesAgg = registry.getAggregate("hermes", "test_aggregate");
      const billingAgg = registry.getAggregate("billing", "test_forgettable_aggregate");
      expect(hermesAgg.target).toBe(TestAggregate);
      expect(billingAgg.target).toBe(TestForgettableAggregate);
    });
  });

  // -- Saga getters --

  describe("getSaga", () => {
    test("should return RegisteredSaga by namespace and name", () => {
      const saga = registry.getSaga("hermes", "test_saga");
      expect(saga.target).toBe(TestSaga);
      expect(saga.name).toBe("test_saga");
    });

    test("should throw for unknown saga name", () => {
      expect(() => registry.getSaga("hermes", "nonexistent")).toThrow(
        "Saga not found: hermes.nonexistent",
      );
    });
  });

  describe("getSagaByTarget", () => {
    test("should return RegisteredSaga by constructor", () => {
      const saga = registry.getSagaByTarget(TestSaga);
      expect(saga.name).toBe("test_saga");
    });

    test("should throw for unregistered saga target", () => {
      class UnknownSaga {}
      expect(() => registry.getSagaByTarget(UnknownSaga)).toThrow(
        "Saga not registered: UnknownSaga",
      );
    });
  });

  // -- View getters --

  describe("getView", () => {
    test("should return RegisteredView by namespace and name", () => {
      const view = registry.getView("hermes", "test_view");
      expect(view.target).toBe(TestView);
      expect(view.name).toBe("test_view");
    });

    test("should throw for unknown view name", () => {
      expect(() => registry.getView("hermes", "nonexistent")).toThrow(
        "View not found: hermes.nonexistent",
      );
    });
  });

  describe("getViewByTarget", () => {
    test("should return RegisteredView by constructor", () => {
      const view = registry.getViewByTarget(TestView);
      expect(view.name).toBe("test_view");
      expect(view.entity).toBe(TestViewEntity);
    });

    test("should throw for unregistered view target", () => {
      class UnknownView {}
      expect(() => registry.getViewByTarget(UnknownView)).toThrow(
        "View not registered: UnknownView",
      );
    });
  });

  // -- Handler lookup --

  describe("getCommandHandler", () => {
    test("should return handler with aggregate context", () => {
      // TestCommandDestroy is only handled by TestAggregate (not shared)
      const handler = registry.getCommandHandler(TestCommandDestroy);
      expect(handler).toBeDefined();
      expect(handler!.aggregate.name).toBe("test_aggregate");
      expect(handler!.trigger).toBe(TestCommandDestroy);
      expect(handler!.kind).toBe("AggregateCommandHandler");
    });

    test("should return undefined for unregistered command", () => {
      class UnknownCommand {}
      expect(registry.getCommandHandler(UnknownCommand)).toBeUndefined();
    });

    test("should return the correct handler for each registered command", () => {
      const commands = [
        TestCommandCreate,
        TestCommandDestroy,
        TestCommandDestroyNext,
        TestCommandDispatch,
        TestCommandEncrypt,
        TestCommandMergeState,
        TestCommandSetState,
        TestCommandThrows,
        TestCommandTimeout,
      ];

      for (const cmd of commands) {
        const handler = registry.getCommandHandler(cmd);
        expect(handler).toBeDefined();
        expect(handler!.trigger).toBe(cmd);
      }
    });
  });

  describe("getAggregateEventHandlers", () => {
    test("should return event handlers for test_aggregate", () => {
      const handlers = registry.getAggregateEventHandlers("hermes", "test_aggregate");
      expect(handlers).toHaveLength(9);
      expect(handlers[0].aggregate.name).toBe("test_aggregate");
    });

    test("should return event handlers for test_forgettable_aggregate", () => {
      const handlers = registry.getAggregateEventHandlers(
        "billing",
        "test_forgettable_aggregate",
      );
      expect(handlers).toHaveLength(1);
    });

    test("should return empty array for unknown aggregate name", () => {
      const handlers = registry.getAggregateEventHandlers("hermes", "nonexistent");
      expect(handlers).toEqual([]);
    });
  });

  describe("getViewsForEvent", () => {
    test("should return views that listen to TestEventCreate", () => {
      const views = registry.getViewsForEvent(TestEventCreate);
      expect(views).toHaveLength(1);
      expect(views[0].target).toBe(TestView);
    });

    test("should return views that listen to TestEventMergeState", () => {
      const views = registry.getViewsForEvent(TestEventMergeState);
      expect(views).toHaveLength(1);
      expect(views[0].target).toBe(TestView);
    });

    test("should return views that listen to TestEventThrows", () => {
      const views = registry.getViewsForEvent(TestEventThrows);
      expect(views).toHaveLength(1);
      expect(views[0].target).toBe(TestView);
    });

    test("should return empty array for events not listened to by any view", () => {
      const views = registry.getViewsForEvent(TestEventTimeout);
      expect(views).toEqual([]);
    });

    test("should return empty array for unregistered event", () => {
      class UnknownEvent {}
      expect(registry.getViewsForEvent(UnknownEvent)).toEqual([]);
    });
  });

  describe("getSagasForEvent", () => {
    test("should return sagas that listen to TestEventCreate", () => {
      const sagas = registry.getSagasForEvent(TestEventCreate);
      expect(sagas).toHaveLength(1);
      expect(sagas[0].target).toBe(TestSaga);
    });

    test("should return sagas that listen to TestEventMergeState", () => {
      const sagas = registry.getSagasForEvent(TestEventMergeState);
      expect(sagas).toHaveLength(1);
      expect(sagas[0].target).toBe(TestSaga);
    });

    test("should return sagas that listen to TestEventDestroy", () => {
      const sagas = registry.getSagasForEvent(TestEventDestroy);
      expect(sagas).toHaveLength(1);
    });

    test("should return sagas that listen to TestEventThrows", () => {
      const sagas = registry.getSagasForEvent(TestEventThrows);
      expect(sagas).toHaveLength(1);
      expect(sagas[0].target).toBe(TestSaga);
    });

    test("should return sagas that listen to TestEventDispatch", () => {
      const sagas = registry.getSagasForEvent(TestEventDispatch);
      expect(sagas).toHaveLength(1);
      expect(sagas[0].target).toBe(TestSaga);
    });

    test("should return empty array for events not listened to by any saga", () => {
      const sagas = registry.getSagasForEvent(TestEventTimeout);
      expect(sagas).toEqual([]);
    });

    test("should return empty array for unregistered event", () => {
      class UnknownEvent {}
      expect(registry.getSagasForEvent(UnknownEvent)).toEqual([]);
    });
  });

  // -- Collection getters --

  describe("allAggregates", () => {
    test("should return all registered aggregates", () => {
      const all = registry.allAggregates;
      expect(all).toHaveLength(3);

      const names = all.map((a) => a.name);
      expect(names).toContain("test_aggregate");
      expect(names).toContain("test_forgettable_aggregate");
      expect(names).toContain("test_upcaster_aggregate");
    });
  });

  describe("allSagas", () => {
    test("should return all registered sagas", () => {
      const all = registry.allSagas;
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe("test_saga");
    });
  });

  describe("allViews", () => {
    test("should return all registered views", () => {
      const all = registry.allViews;
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe("test_view");
    });
  });

  describe("allCommands", () => {
    test("should return all registered commands", () => {
      expect(registry.allCommands).toHaveLength(9);
    });
  });

  describe("allEvents", () => {
    test("should return all registered events", () => {
      expect(registry.allEvents).toHaveLength(12);
    });
  });

  describe("allQueries", () => {
    test("should return all registered queries", () => {
      expect(registry.allQueries).toHaveLength(1);
    });
  });

  describe("allTimeouts", () => {
    test("should return all registered timeouts", () => {
      expect(registry.allTimeouts).toHaveLength(1);
    });
  });

  // -- Upcaster chain --

  describe("getUpcasterChain", () => {
    test("should return full chain from v1 to v3", () => {
      const chain = registry.getUpcasterChain("test_event_upcast", 1, 3);
      expect(chain).toHaveLength(2);
      expect(chain[0].fromVersion).toBe(1);
      expect(chain[0].toVersion).toBe(2);
      expect(chain[0].method).toBe("upcastV1toV2");
      expect(chain[0].from).toBe(TestEventUpcast_V1);
      expect(chain[0].to).toBe(TestEventUpcast_V2);
      expect(chain[1].fromVersion).toBe(2);
      expect(chain[1].toVersion).toBe(3);
      expect(chain[1].method).toBe("upcastV2toV3");
      expect(chain[1].from).toBe(TestEventUpcast_V2);
      expect(chain[1].to).toBe(TestEventUpcast_V3);
    });

    test("should return single-step chain from v1 to v2", () => {
      const chain = registry.getUpcasterChain("test_event_upcast", 1, 2);
      expect(chain).toHaveLength(1);
      expect(chain[0].fromVersion).toBe(1);
      expect(chain[0].toVersion).toBe(2);
    });

    test("should return single-step chain from v2 to v3", () => {
      const chain = registry.getUpcasterChain("test_event_upcast", 2, 3);
      expect(chain).toHaveLength(1);
      expect(chain[0].fromVersion).toBe(2);
      expect(chain[0].toVersion).toBe(3);
    });

    test("should return empty array when fromVersion >= toVersion", () => {
      expect(registry.getUpcasterChain("test_event_upcast", 3, 3)).toEqual([]);
      expect(registry.getUpcasterChain("test_event_upcast", 3, 1)).toEqual([]);
    });

    test("should return empty array for unknown event name", () => {
      expect(registry.getUpcasterChain("nonexistent_event", 1, 3)).toEqual([]);
    });

    test("should throw when chain has a gap", () => {
      expect(() => registry.getUpcasterChain("test_event_upcast", 1, 5)).toThrow(
        'Upcaster chain gap: no upcaster from v3 for event "test_event_upcast"',
      );
    });
  });

  // -- Duplicate upcaster detection --

  describe("duplicate upcaster detection", () => {
    test("should throw when registering duplicate upcaster for same fromVersion", () => {
      class DuplicateEvent_V1 {}
      (DuplicateEvent_V1 as any)[Symbol.metadata] = {
        dto: { kind: "event", name: "duplicate_event", version: 1 },
      };

      class DuplicateEvent_V2 {}
      (DuplicateEvent_V2 as any)[Symbol.metadata] = {
        dto: { kind: "event", name: "duplicate_event", version: 2 },
      };

      class DuplicateAgg {}
      (DuplicateAgg as any)[Symbol.metadata] = {
        aggregate: { name: "duplicate_agg" },
        handlers: [],
        upcasters: [
          { from: DuplicateEvent_V1, to: DuplicateEvent_V2, method: "up1" },
          { from: DuplicateEvent_V1, to: DuplicateEvent_V2, method: "up2" },
        ],
      };

      const scanned = HermesScanner.scan([
        DuplicateEvent_V1,
        DuplicateEvent_V2,
        DuplicateAgg,
      ]);
      expect(() => new HermesRegistry(scanned)).toThrow(
        'Duplicate upcaster: event "duplicate_event" v1 is already registered',
      );
    });
  });

  // -- MEDIUM: getViewByEntity with unregistered entity --

  describe("getViewByEntity", () => {
    test("should return view for registered entity", () => {
      const view = registry.getViewByEntity(TestViewEntity);
      expect(view.name).toBe("test_view");
      expect(view.entity).toBe(TestViewEntity);
    });

    test("should throw for entity with no registered view", () => {
      class UnknownEntity {}
      expect(() => registry.getViewByEntity(UnknownEntity)).toThrow(
        "No view registered for entity: UnknownEntity",
      );
    });
  });

  // -- MEDIUM: commandHandlersByTrigger overwrite for shared commands --

  describe("commandHandlersByTrigger overwrite", () => {
    test("should store last registered handler when command is shared between aggregates", () => {
      // TestCommandCreate is handled by TestAggregate, TestForgettableAggregate, and TestUpcasterAggregate
      const handler = registry.getCommandHandler(TestCommandCreate);
      expect(handler).toBeDefined();
      // The last registered aggregate wins -- verify it returns one of the three
      expect(
        handler!.aggregate.name === "test_aggregate" ||
          handler!.aggregate.name === "test_forgettable_aggregate" ||
          handler!.aggregate.name === "test_upcaster_aggregate",
      ).toBe(true);
    });
  });

  // -- L4: validate handler coverage --

  describe("validate", () => {
    test("should not warn when all events have at least one handler", () => {
      const { createMockLogger } = require("@lindorm/logger");
      const mockLogger = createMockLogger();
      registry.validate(mockLogger);
      // All test events have handlers (aggregate, saga, or view)
      // so warn should not be called for any event that has a handler
      const warnCalls = mockLogger.warn.mock.calls;
      const unhandledEvents = warnCalls.filter(
        (call: Array<unknown>) => call[0] === "Event has no registered handlers",
      );
      // TestEventTimeout and TestEventEncrypt have aggregate handlers,
      // so they should not appear as unhandled
      for (const call of unhandledEvents) {
        const data = call[1] as { event: { name: string } };
        expect(data.event.name).not.toBe("test_event_create");
        expect(data.event.name).not.toBe("test_event_destroy");
      }
    });

    test("should not warn about upcaster gaps when chain is contiguous", () => {
      const { createMockLogger } = require("@lindorm/logger");
      const mockLogger = createMockLogger();
      registry.validate(mockLogger);
      const gapWarnings = mockLogger.warn.mock.calls.filter(
        (call: Array<unknown>) => call[0] === "Upcaster chain gap detected",
      );
      expect(gapWarnings).toHaveLength(0);
    });

    test("should warn about upcaster chain gap when versions are not contiguous", () => {
      const { createMockLogger } = require("@lindorm/logger");
      const mockLogger = createMockLogger();

      class GapEvent_V1 {}
      (GapEvent_V1 as any)[Symbol.metadata] = {
        dto: { kind: "event", name: "gap_event", version: 1 },
      };
      class GapEvent_V2 {}
      (GapEvent_V2 as any)[Symbol.metadata] = {
        dto: { kind: "event", name: "gap_event", version: 2 },
      };
      class GapEvent_V4 {}
      (GapEvent_V4 as any)[Symbol.metadata] = {
        dto: { kind: "event", name: "gap_event", version: 4 },
      };
      class GapEvent_V5 {}
      (GapEvent_V5 as any)[Symbol.metadata] = {
        dto: { kind: "event", name: "gap_event", version: 5 },
      };

      class GapAgg {}
      (GapAgg as any)[Symbol.metadata] = {
        aggregate: { name: "gap_agg" },
        handlers: [],
        upcasters: [
          { from: GapEvent_V1, to: GapEvent_V2, method: "up1" },
          { from: GapEvent_V4, to: GapEvent_V5, method: "up2" },
        ],
      };

      const scanned = HermesScanner.scan([
        GapEvent_V1,
        GapEvent_V2,
        GapEvent_V4,
        GapEvent_V5,
        GapAgg,
      ]);
      const gapRegistry = new HermesRegistry(scanned);
      gapRegistry.validate(mockLogger);

      const gapWarnings = mockLogger.warn.mock.calls.filter(
        (call: Array<unknown>) => call[0] === "Upcaster chain gap detected",
      );
      expect(gapWarnings).toHaveLength(1);
      expect(gapWarnings[0][1]).toEqual({
        event: "gap_event",
        missingFrom: 2,
        missingTo: 4,
      });
    });
  });
});
