import { SagaEventHandler } from "../handler";
import { SagaEventHandlerOptions } from "../types";
import { TEST_AGGREGATE_IDENTIFIER } from "./aggregate.fixture";
import { TEST_COMMAND } from "./command.fixture";
import { TEST_SAGA_IDENTIFIER } from "./saga.fixture";
import {
  TEST_DOMAIN_EVENT,
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_DESTROY,
  TEST_DOMAIN_EVENT_DISPATCH,
  TEST_DOMAIN_EVENT_MERGE_STATE,
  TEST_DOMAIN_EVENT_SET_STATE,
  TEST_DOMAIN_EVENT_THROWS,
  TEST_DOMAIN_EVENT_TIMEOUT,
} from "./domain-event.fixture";

export const TEST_SAGA_EVENT_HANDLER_OPTIONS: SagaEventHandlerOptions = {
  aggregate: {
    name: TEST_AGGREGATE_IDENTIFIER.name,
    context: TEST_AGGREGATE_IDENTIFIER.context,
  },
  saga: {
    name: TEST_SAGA_IDENTIFIER.name,
    context: TEST_SAGA_IDENTIFIER.context,
  },
  eventName: TEST_DOMAIN_EVENT.name,

  conditions: { created: true },

  getSagaId: (event) => event.aggregate.id,
  handler: jest.fn().mockImplementation(async () => {}),
};

export const TEST_SAGA_EVENT_HANDLER = new SagaEventHandler(TEST_SAGA_EVENT_HANDLER_OPTIONS);

export const TEST_SAGA_EVENT_HANDLER_CREATE = new SagaEventHandler({
  ...TEST_SAGA_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_CREATE.name,
  conditions: { created: false },
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.setState("created", true);
  }),
});

export const TEST_SAGA_EVENT_HANDLER_DESTROY = new SagaEventHandler({
  ...TEST_SAGA_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_DESTROY.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.destroy();
  }),
});

export const TEST_SAGA_EVENT_HANDLER_DISPATCH = new SagaEventHandler({
  ...TEST_SAGA_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_DISPATCH.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.dispatch(TEST_COMMAND.name, TEST_COMMAND.data);
  }),
});

export const TEST_SAGA_EVENT_HANDLER_MERGE_STATE = new SagaEventHandler({
  ...TEST_SAGA_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_MERGE_STATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.mergeState({ merge: ctx.event.data });
  }),
});

export const TEST_SAGA_EVENT_HANDLER_SET_STATE = new SagaEventHandler({
  ...TEST_SAGA_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_SET_STATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.setState("path", { value: ctx.event.data });
  }),
});

export const TEST_SAGA_EVENT_HANDLER_TIMEOUT = new SagaEventHandler({
  ...TEST_SAGA_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_TIMEOUT.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.timeout("timeoutName", { timeoutData: true }, 500);
  }),
});

export const TEST_SAGA_EVENT_HANDLER_THROWS = new SagaEventHandler({
  ...TEST_SAGA_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_THROWS.name,
  handler: jest.fn().mockImplementation(async () => {
    throw new Error("throw");
  }),
});
