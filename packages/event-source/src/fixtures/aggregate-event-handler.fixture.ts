import { AggregateEventHandlerImplementation } from "../handler";
import { AggregateEventHandlerOptions } from "../types";
import { TEST_AGGREGATE_OPTIONS } from "./aggregate.fixture";
import {
  TEST_DOMAIN_EVENT,
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_DESTROY,
  TEST_DOMAIN_EVENT_DESTROY_NEXT,
  TEST_DOMAIN_EVENT_MERGE_STATE,
  TEST_DOMAIN_EVENT_SET_STATE,
  TEST_DOMAIN_EVENT_THROWS,
} from "./domain-event.fixture";

export const TEST_AGGREGATE_EVENT_HANDLER_OPTIONS: AggregateEventHandlerOptions = {
  aggregate: {
    name: TEST_AGGREGATE_OPTIONS.name,
    context: TEST_AGGREGATE_OPTIONS.context,
  },
  eventName: TEST_DOMAIN_EVENT.name,

  handler: jest.fn().mockImplementation(async () => {}),
};

export const TEST_AGGREGATE_EVENT_HANDLER = new AggregateEventHandlerImplementation(
  TEST_AGGREGATE_EVENT_HANDLER_OPTIONS,
);

export const TEST_AGGREGATE_EVENT_HANDLER_CREATE = new AggregateEventHandlerImplementation({
  ...TEST_AGGREGATE_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_CREATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.mergeState({ created: true });
  }),
});

export const TEST_AGGREGATE_EVENT_HANDLER_DESTROY = new AggregateEventHandlerImplementation({
  ...TEST_AGGREGATE_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_DESTROY.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.destroy();
  }),
});

export const TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT = new AggregateEventHandlerImplementation({
  ...TEST_AGGREGATE_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_DESTROY_NEXT.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.destroyNext();
  }),
});

export const TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE = new AggregateEventHandlerImplementation({
  ...TEST_AGGREGATE_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_MERGE_STATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.mergeState({ merge: ctx.event });
  }),
});

export const TEST_AGGREGATE_EVENT_HANDLER_SET_STATE = new AggregateEventHandlerImplementation({
  ...TEST_AGGREGATE_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_SET_STATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.mergeState({ set: "state" });
  }),
});

export const TEST_AGGREGATE_EVENT_HANDLER_THROWS = new AggregateEventHandlerImplementation({
  ...TEST_AGGREGATE_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_THROWS.name,
  handler: jest.fn().mockImplementation(async () => {
    throw new Error("throw");
  }),
});
