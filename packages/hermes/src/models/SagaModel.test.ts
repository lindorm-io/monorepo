import { createMockLogger } from "@lindorm/logger";
import { createMockRabbitMessageBus } from "@lindorm/rabbit";
import { createTestEvent } from "../__fixtures__/create-message";
import { createTestRegistry } from "../__fixtures__/create-test-registry";
import { createTestSagaIdentifier } from "../__fixtures__/create-test-saga-identifier";
import { TestCommandMergeState } from "../__fixtures__/modules/commands/TestCommandMergeState";
import { TestEventCreate } from "../__fixtures__/modules/events/TestEventCreate";
import { SagaDestroyedError } from "../errors";
import { HermesCommand, HermesTimeout } from "../messages";
import { SagaModelOptions } from "../types";
import { SagaModel } from "./SagaModel";

describe("SagaModel", () => {
  const std: SagaModelOptions = {
    ...createTestSagaIdentifier(),
    commandBus: createMockRabbitMessageBus(HermesCommand),
    logger: createMockLogger(),
    registry: createTestRegistry(),
    timeoutBus: createMockRabbitMessageBus(HermesTimeout),
  };

  let saga: SagaModel;

  beforeEach(() => {
    saga = new SagaModel(std);
  });

  test("should construct", () => {
    expect(() => new SagaModel(std)).not.toThrow();
  });

  test("should return json object", async () => {
    expect(saga.toJSON()).toEqual({
      id: expect.any(String),
      name: "test_saga",
      namespace: "hermes",
      destroyed: false,
      messagesToDispatch: [],
      processedCausationIds: [],
      revision: 0,
      state: {},
    });
  });

  test("should destroy", () => {
    expect(() => saga.destroy()).not.toThrow();

    expect(saga.destroyed).toEqual(true);
  });

  test("should dispatch command", () => {
    const event = createTestEvent(new TestEventCreate("create"));

    expect(() =>
      saga.dispatch(event, new TestCommandMergeState("merge-state")),
    ).not.toThrow();

    expect(saga.messagesToDispatch).toEqual([
      expect.objectContaining({
        id: expect.any(String),
        name: "test_command_merge_state",
        aggregate: event.aggregate,
        causationId: expect.any(String),
        correlationId: event.correlationId,
        data: { input: "merge-state" },
        delay: 0,
        mandatory: true,
        meta: {
          origin: "test",
        },
        timestamp: expect.any(Date),
        version: 1,
      }),
    ]);
  });

  test("should get state", () => {
    saga = new SagaModel({
      ...std,
      state: { test: true },
    });

    expect(saga.state).toEqual({ test: true });
  });

  test("should merge state", () => {
    expect(() => saga.mergeState({ merge: "mergeState" })).not.toThrow();

    expect(saga.state).toEqual({
      merge: "mergeState",
    });
  });

  test("should dispatch timeout event", () => {
    expect(() =>
      saga.timeout(
        createTestEvent(new TestEventCreate("create")),
        "timeoutName",
        { timeoutData: true },
        250,
      ),
    ).not.toThrow();

    expect(saga.messagesToDispatch).toEqual([expect.any(HermesTimeout)]);
  });

  test("should throw on destroy when destroyed", () => {
    saga = new SagaModel({
      ...std,
      destroyed: true,
    });

    expect(() => saga.destroy()).toThrow(SagaDestroyedError);
  });

  test("should throw on dispatch when destroyed", () => {
    class DispatchedCommand {
      public constructor(public readonly data: any) {}
    }

    saga = new SagaModel({
      ...std,
      destroyed: true,
    });

    expect(() =>
      saga.dispatch(
        createTestEvent(new TestEventCreate("create")),
        new DispatchedCommand("destroyed"),
      ),
    ).toThrow(SagaDestroyedError);
  });

  test("should throw on merge state when destroyed", () => {
    saga = new SagaModel({
      ...std,
      destroyed: true,
    });

    expect(() => saga.mergeState({ merge: "mergeState" })).toThrow(SagaDestroyedError);
  });

  test("should throw on merge state when destroyed", () => {
    saga = new SagaModel({
      ...std,
      destroyed: true,
    });

    expect(() => saga.mergeState({ value: "setState" })).toThrow(SagaDestroyedError);
  });

  test("should throw on dispatch timeout event when destroyed", () => {
    saga = new SagaModel({
      ...std,
      destroyed: true,
    });

    expect(() =>
      saga.timeout(
        createTestEvent(new TestEventCreate("create")),
        "timeoutName",
        { timeoutData: true },
        250,
      ),
    ).toThrow();
  });
});
