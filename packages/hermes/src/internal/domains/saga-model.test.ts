import { createMockLogger } from "@lindorm/logger";
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
import { TestViewQuery } from "../../__fixtures__/modules/queries";
import { TestSaga } from "../../__fixtures__/modules/sagas";
import { TestTimeoutReminder } from "../../__fixtures__/modules/timeouts";
import { TestView } from "../../__fixtures__/modules/views/TestView";
import { SagaDestroyedError } from "../../errors";
import { HermesRegistry, scanModules } from "#internal/registry";
import { SagaModel } from "./saga-model";
import type { SagaPendingMessage } from "./saga-model";

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
  TestTimeoutReminder,
  TestViewQuery,
  TestAggregate,
  TestForgettableAggregate,
  TestSaga,
  TestView,
];

describe("SagaModel", () => {
  let registry: HermesRegistry;

  beforeAll(() => {
    const scanned = scanModules(ALL_CONSTRUCTORS);
    registry = new HermesRegistry(scanned);
  });

  const createModel = (
    overrides: Partial<{
      id: string;
      name: string;
      namespace: string;
      destroyed: boolean;
      revision: number;
      state: Record<string, unknown>;
    }> = {},
  ): SagaModel => {
    return new SagaModel(
      {
        id: overrides.id ?? "test-saga-id",
        name: overrides.name ?? "test_saga",
        namespace: overrides.namespace ?? "hermes",
        destroyed: overrides.destroyed,
        revision: overrides.revision,
        state: overrides.state,
      },
      {
        registry,
        logger: createMockLogger(),
      },
    );
  };

  // -- Construction --

  test("should construct with correct defaults", () => {
    const model = createModel();

    expect(model.id).toBe("test-saga-id");
    expect(model.name).toBe("test_saga");
    expect(model.namespace).toBe("hermes");
    expect(model.destroyed).toBe(false);
    expect(model.messagesToDispatch).toEqual([]);
    expect(model.revision).toBe(0);
    expect(model.state).toEqual({});
  });

  test("should construct with provided state/revision/destroyed values", () => {
    const model = createModel({
      destroyed: true,
      revision: 5,
      state: { custom: "state" },
    });

    expect(model.destroyed).toBe(true);
    expect(model.revision).toBe(5);
    expect(model.state).toEqual({ custom: "state" });
  });

  test("should return toJSON() snapshot", () => {
    const model = createModel();

    expect(model.toJSON()).toMatchSnapshot();
  });

  // -- destroy --

  test("should destroy() and set destroyed to true", () => {
    const model = createModel();

    model.destroy();

    expect(model.destroyed).toBe(true);
  });

  test("should throw SagaDestroyedError on destroy() when already destroyed", () => {
    const model = createModel({ destroyed: true });

    expect(() => model.destroy()).toThrow(SagaDestroyedError);
  });

  // -- dispatch --

  test("should dispatch command and accumulate in messagesToDispatch", () => {
    const model = createModel();

    model.dispatch(
      "causation-id",
      "correlation-id",
      { origin: "test" },
      new TestCommandMergeState("dispatched-merge"),
    );

    expect(model.messagesToDispatch).toHaveLength(1);
    const pending = model.messagesToDispatch[0];
    expect(pending.kind).toBe("command");
    expect(pending.data).toEqual(
      expect.objectContaining({
        name: "test_command_merge_state",
        version: 1,
        data: { input: "dispatched-merge" },
        causationId: "causation-id",
        correlationId: "correlation-id",
      }),
    );
    expect(pending).toMatchSnapshot();
  });

  test("should dispatch command with options (id, delay, mandatory, meta)", () => {
    const model = createModel();

    model.dispatch(
      "causation-id",
      "correlation-id",
      { origin: "test" },
      new TestCommandCreate("dispatched-create"),
      {
        id: "override-id",
        delay: 500,
        mandatory: false,
        meta: { extra: "meta" },
      },
    );

    expect(model.messagesToDispatch).toHaveLength(1);

    const pending = model.messagesToDispatch[0];
    expect(pending.delay).toBe(500);
    expect(pending.data).toEqual(expect.objectContaining({ mandatory: false }));
  });

  test("should dispatch timeout message via dispatch()", () => {
    const model = createModel();

    model.dispatch(
      "causation-id",
      null,
      { origin: "test" },
      new TestTimeoutReminder("timeout-data"),
    );

    expect(model.messagesToDispatch).toHaveLength(1);
    expect(model.messagesToDispatch[0].kind).toBe("timeout");
  });

  test("should throw SagaDestroyedError on dispatch() when destroyed", () => {
    const model = createModel({ destroyed: true });

    expect(() =>
      model.dispatch("causation-id", null, {}, new TestCommandMergeState("dispatched")),
    ).toThrow(SagaDestroyedError);
  });

  test("should throw when dispatching unregistered message type", () => {
    const model = createModel();

    class UnregisteredMessage {
      public constructor(public readonly data: string) {}
    }

    expect(() =>
      model.dispatch("causation-id", null, {}, new UnregisteredMessage("invalid")),
    ).toThrow(/not registered as command or timeout/);
  });

  // -- timeout --

  test("should timeout() and accumulate timeout message in messagesToDispatch", () => {
    const model = createModel();

    model.timeout(
      "causation-id",
      "correlation-id",
      { origin: "test" },
      "reminder_timeout",
      { reminder: true },
      250,
    );

    expect(model.messagesToDispatch).toHaveLength(1);
    const pending = model.messagesToDispatch[0];
    expect(pending.kind).toBe("timeout");
    expect(pending.delay).toBe(250);
    expect(pending.data).toEqual(
      expect.objectContaining({
        aggregate: {
          id: "test-saga-id",
          name: "test_saga",
          namespace: "hermes",
        },
        causationId: "causation-id",
        correlationId: "correlation-id",
        data: { reminder: true },
        meta: { origin: "test" },
        name: "reminder_timeout",
      }),
    );
  });

  test("should throw SagaDestroyedError on timeout() when destroyed", () => {
    const model = createModel({ destroyed: true });

    expect(() =>
      model.timeout(
        "causation-id",
        null,
        {},
        "reminder_timeout",
        { reminder: true },
        250,
      ),
    ).toThrow(SagaDestroyedError);
  });

  test("should validate timeout params with zod schema", () => {
    const model = createModel();

    expect(() =>
      model.timeout("causation-id", null, {}, 123 as any, { reminder: true }, 250),
    ).toThrow();
  });

  test("should attach delay to timeout message (M6)", () => {
    const model = createModel();

    model.timeout("causation-id", null, {}, "reminder_timeout", { reminder: true }, 5000);

    const pending = model.messagesToDispatch[0];
    expect(pending.delay).toBe(5000);
  });

  test("should set kind discriminator to 'timeout' on timeout messages (M2)", () => {
    const model = createModel();

    model.timeout("causation-id", null, {}, "reminder_timeout", { reminder: true }, 250);

    const pending = model.messagesToDispatch[0];
    expect(pending.kind).toBe("timeout");
  });

  // -- dispatch kind discriminator --

  test("should set kind discriminator to 'command' on dispatched commands (M2)", () => {
    const model = createModel();

    model.dispatch("causation-id", null, {}, new TestCommandMergeState("test"));

    const pending = model.messagesToDispatch[0];
    expect(pending.kind).toBe("command");
  });

  test("should set kind discriminator to 'timeout' on dispatched timeouts via dispatch() (M2)", () => {
    const model = createModel();

    model.dispatch("causation-id", null, {}, new TestTimeoutReminder("test"));

    const pending = model.messagesToDispatch[0];
    expect(pending.kind).toBe("timeout");
  });

  // -- mergeState --

  test("should mergeState() with deep merge", () => {
    const model = createModel({ state: { existing: "value", nested: { a: 1 } } });

    model.mergeState({ added: "new", nested: { b: 2 } });

    expect(model.state).toMatchSnapshot();
  });

  test("should throw SagaDestroyedError on mergeState() when destroyed", () => {
    const model = createModel({ destroyed: true });

    expect(() => model.mergeState({ key: "value" })).toThrow(SagaDestroyedError);
  });

  test("should validate mergeState params with zod schema", () => {
    const model = createModel();

    expect(() => model.mergeState("not-an-object" as any)).toThrow();
  });

  // -- setState --

  test("should setState() with full replacement", () => {
    const model = createModel({ state: { old: "value" } });

    model.setState({ new: "state" });

    expect(model.state).toEqual({ new: "state" });
  });

  test("should throw SagaDestroyedError on setState() when destroyed", () => {
    const model = createModel({ destroyed: true });

    expect(() => model.setState({ key: "value" })).toThrow(SagaDestroyedError);
  });

  test("should validate setState params with zod schema", () => {
    const model = createModel();

    expect(() => model.setState("not-an-object" as any)).toThrow();
  });

  // -- clearMessages --

  test("should clearMessages() reset messagesToDispatch to empty", () => {
    const model = createModel();

    model.dispatch("causation-id", null, {}, new TestCommandMergeState("dispatched"));

    expect(model.messagesToDispatch).toHaveLength(1);

    model.clearMessages();

    expect(model.messagesToDispatch).toEqual([]);
  });

  // -- dispatch meta merging --

  test("should merge causation meta with dispatch option meta", () => {
    const model = createModel();

    model.dispatch(
      "causation-id",
      null,
      { origin: "causation" },
      new TestCommandCreate("create"),
      { meta: { extra: "dispatch-meta" } },
    );

    const pending = model.messagesToDispatch[0];
    expect(pending.data).toEqual(
      expect.objectContaining({
        meta: { origin: "causation", extra: "dispatch-meta" },
      }),
    );
  });

  // -- resolveAggregateForDispatch (M6) --

  test("should resolve aggregate from registry when command has registered handler", () => {
    const model = createModel();

    model.dispatch("causation-id", null, {}, new TestCommandMergeState("resolve-test"));

    // TestCommandMergeState is handled by TestAggregate (name: "test_aggregate", namespace: "hermes")
    const pending = model.messagesToDispatch[0];
    expect(pending.data).toEqual(
      expect.objectContaining({
        aggregate: {
          id: "test-saga-id",
          name: "test_aggregate",
          namespace: "hermes",
        },
      }),
    );
  });

  test("should fall back to saga identity when dispatched command has no registered aggregate", () => {
    const model = createModel();

    // TestTimeoutReminder is not a command, so it goes through the timeout path
    // and uses the saga's own identity for the aggregate
    model.dispatch("causation-id", null, {}, new TestTimeoutReminder("fallback-test"));

    const pending = model.messagesToDispatch[0];
    expect(pending.data).toEqual(
      expect.objectContaining({
        aggregate: {
          id: "test-saga-id",
          name: "test_saga",
          namespace: "hermes",
        },
      }),
    );
  });

  test("should use overrideId when provided for dispatch aggregate resolution", () => {
    const model = createModel();

    model.dispatch("causation-id", null, {}, new TestCommandMergeState("override-test"), {
      id: "custom-aggregate-id",
    });

    const pending = model.messagesToDispatch[0];
    expect(pending.data).toEqual(
      expect.objectContaining({
        aggregate: {
          id: "custom-aggregate-id",
          name: "test_aggregate",
          namespace: "hermes",
        },
      }),
    );
  });
});
