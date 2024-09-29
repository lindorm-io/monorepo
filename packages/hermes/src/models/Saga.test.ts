import { TEST_HERMES_EVENT } from "../__fixtures__/hermes-event";
import { TEST_SAGA_OPTIONS } from "../__fixtures__/saga";
import { SagaDestroyedError } from "../errors";
import { HermesEvent, HermesTimeout } from "../messages";
import { Saga } from "./Saga";

describe("Saga", () => {
  let saga: Saga;

  beforeEach(() => {
    saga = new Saga(TEST_SAGA_OPTIONS);
  });

  test("should construct", () => {
    expect(() => new Saga(TEST_SAGA_OPTIONS)).not.toThrow();
  });

  test("should return json object", async () => {
    expect(saga.toJSON()).toEqual({
      id: expect.any(String),
      name: "name",
      context: "default",
      destroyed: false,
      hash: expect.any(String),
      messagesToDispatch: [],
      processedCausationIds: [],
      revision: 0,
      state: {},
    });
  });

  test("should destroy", () => {
    expect(() => saga.destroy()).not.toThrow();

    expect(saga.destroyed).toBe(true);
  });

  test("should dispatch command", () => {
    class DispatchedCommand {
      public constructor(public readonly dispatchedData: any) {}
    }

    const event = new HermesEvent(TEST_HERMES_EVENT);

    expect(() => saga.dispatch(event, new DispatchedCommand(true))).not.toThrow();

    expect(saga.messagesToDispatch).toEqual([
      expect.objectContaining({
        id: expect.any(String),
        name: "dispatched_command",
        aggregate: event.aggregate,
        causationId: expect.any(String),
        correlationId: event.correlationId,
        data: { dispatchedData: true },
        delay: 0,
        mandatory: true,
        meta: {
          origin: "test",
        },
        timestamp: expect.any(Date),
        topic: "default.aggregate_name.dispatched_command",
        type: "HermesCommand",
        version: 1,
      }),
    ]);
  });

  test("should get state", () => {
    saga = new Saga({
      ...TEST_SAGA_OPTIONS,
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
        new HermesEvent(TEST_HERMES_EVENT),
        "timeoutName",
        { timeoutData: true },
        250,
      ),
    ).not.toThrow();

    expect(saga.messagesToDispatch).toEqual([expect.any(HermesTimeout)]);
  });

  test("should throw on destroy when destroyed", () => {
    saga = new Saga({
      ...TEST_SAGA_OPTIONS,
      destroyed: true,
    });

    expect(() => saga.destroy()).toThrow(SagaDestroyedError);
  });

  test("should throw on dispatch when destroyed", () => {
    class DispatchedCommand {
      public constructor(public readonly data: any) {}
    }

    saga = new Saga({
      ...TEST_SAGA_OPTIONS,
      destroyed: true,
    });

    expect(() =>
      saga.dispatch(
        new HermesEvent(TEST_HERMES_EVENT),
        new DispatchedCommand("destroyed"),
      ),
    ).toThrow(SagaDestroyedError);
  });

  test("should throw on merge state when destroyed", () => {
    saga = new Saga({
      ...TEST_SAGA_OPTIONS,
      destroyed: true,
    });

    expect(() => saga.mergeState({ merge: "mergeState" })).toThrow(SagaDestroyedError);
  });

  test("should throw on merge state when destroyed", () => {
    saga = new Saga({
      ...TEST_SAGA_OPTIONS,
      destroyed: true,
    });

    expect(() => saga.mergeState({ value: "setState" })).toThrow(SagaDestroyedError);
  });

  test("should throw on dispatch timeout event when destroyed", () => {
    saga = new Saga({
      ...TEST_SAGA_OPTIONS,
      destroyed: true,
    });

    expect(() =>
      saga.timeout(
        new HermesEvent(TEST_HERMES_EVENT),
        "timeoutName",
        { timeoutData: true },
        250,
      ),
    ).toThrow();
  });
});
