import { HermesSagaEventHandler } from "../handlers";
import { SagaEventHandlerOptions } from "../types";
import { TEST_AGGREGATE_IDENTIFIER } from "./aggregate";
import {
  TEST_HERMES_EVENT,
  TEST_HERMES_EVENT_CREATE,
  TEST_HERMES_EVENT_DESTROY,
  TEST_HERMES_EVENT_DISPATCH,
  TEST_HERMES_EVENT_MERGE_STATE,
  TEST_HERMES_EVENT_SET_STATE,
  TEST_HERMES_EVENT_THROWS,
  TEST_HERMES_EVENT_TIMEOUT,
} from "./hermes-event";
import { TEST_SAGA_IDENTIFIER } from "./saga";

export const TEST_SAGA_EVENT_HANDLER_OPTIONS: SagaEventHandlerOptions = {
  aggregate: {
    name: TEST_AGGREGATE_IDENTIFIER.name,
    context: TEST_AGGREGATE_IDENTIFIER.context,
  },
  saga: {
    name: TEST_SAGA_IDENTIFIER.name,
    context: TEST_SAGA_IDENTIFIER.context,
  },
  eventName: TEST_HERMES_EVENT.name,
  conditions: { created: true },
  getSagaId: (event) => event.aggregate.id,
  handler: jest.fn().mockImplementation(async () => {}),
};

export const TEST_SAGA_EVENT_HANDLER = new HermesSagaEventHandler(
  TEST_SAGA_EVENT_HANDLER_OPTIONS,
);

export const TEST_SAGA_EVENT_HANDLER_CREATE = new HermesSagaEventHandler({
  ...TEST_SAGA_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_CREATE.name,
  conditions: { created: false },
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.mergeState({ created: true });
  }),
});

export const TEST_SAGA_EVENT_HANDLER_DESTROY = new HermesSagaEventHandler({
  ...TEST_SAGA_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_DESTROY.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.destroy();
  }),
});

export const TEST_SAGA_EVENT_HANDLER_DISPATCH = new HermesSagaEventHandler({
  ...TEST_SAGA_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_DISPATCH.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    class CommandDefault {
      constructor(public readonly commandData: any) {}
    }
    ctx.dispatch(new CommandDefault(true));
  }),
});

export const TEST_SAGA_EVENT_HANDLER_MERGE_STATE = new HermesSagaEventHandler({
  ...TEST_SAGA_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_MERGE_STATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.mergeState({ merge: ctx.event });
  }),
});

export const TEST_SAGA_EVENT_HANDLER_SET_STATE = new HermesSagaEventHandler({
  ...TEST_SAGA_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_SET_STATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.mergeState({ set: "state" });
  }),
});

export const TEST_SAGA_EVENT_HANDLER_TIMEOUT = new HermesSagaEventHandler({
  ...TEST_SAGA_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_TIMEOUT.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.timeout("timeoutName", { timeoutData: true }, 500);
  }),
});

export const TEST_SAGA_EVENT_HANDLER_THROWS = new HermesSagaEventHandler({
  ...TEST_SAGA_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_THROWS.name,
  handler: jest.fn().mockImplementation(async () => {
    throw new Error("throw");
  }),
});
