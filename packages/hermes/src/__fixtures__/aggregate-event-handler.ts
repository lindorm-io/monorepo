import { HermesAggregateEventHandler } from "../handlers";
import { AggregateEventHandlerOptions } from "../types";
import { TEST_AGGREGATE_OPTIONS } from "./aggregate";
import {
  TEST_HERMES_EVENT,
  TEST_HERMES_EVENT_CREATE,
  TEST_HERMES_EVENT_DESTROY,
  TEST_HERMES_EVENT_DESTROY_NEXT,
  TEST_HERMES_EVENT_MERGE_STATE,
  TEST_HERMES_EVENT_SET_STATE,
  TEST_HERMES_EVENT_THROWS,
} from "./hermes-event";

export const TEST_AGGREGATE_EVENT_HANDLER_OPTIONS: AggregateEventHandlerOptions = {
  aggregate: {
    name: TEST_AGGREGATE_OPTIONS.name,
    context: TEST_AGGREGATE_OPTIONS.context,
  },
  eventName: TEST_HERMES_EVENT.name,
  handler: jest.fn().mockImplementation(async () => {}),
};

export const TEST_AGGREGATE_EVENT_HANDLER = new HermesAggregateEventHandler(
  TEST_AGGREGATE_EVENT_HANDLER_OPTIONS,
);

export const TEST_AGGREGATE_EVENT_HANDLER_CREATE = new HermesAggregateEventHandler({
  ...TEST_AGGREGATE_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_CREATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.mergeState({ created: true });
  }),
});

export const TEST_AGGREGATE_EVENT_HANDLER_DESTROY = new HermesAggregateEventHandler({
  ...TEST_AGGREGATE_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_DESTROY.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.destroy();
  }),
});

export const TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT = new HermesAggregateEventHandler({
  ...TEST_AGGREGATE_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_DESTROY_NEXT.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.destroyNext();
  }),
});

export const TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE = new HermesAggregateEventHandler({
  ...TEST_AGGREGATE_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_MERGE_STATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.mergeState({ merge: ctx.event });
  }),
});

export const TEST_AGGREGATE_EVENT_HANDLER_SET_STATE = new HermesAggregateEventHandler({
  ...TEST_AGGREGATE_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_SET_STATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.mergeState({ set: "state" });
  }),
});

export const TEST_AGGREGATE_EVENT_HANDLER_THROWS = new HermesAggregateEventHandler({
  ...TEST_AGGREGATE_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_THROWS.name,
  handler: jest.fn().mockImplementation(async () => {
    throw new Error("throw");
  }),
});
