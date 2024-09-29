import { ViewStoreType } from "../enums";
import { HermesViewEventHandler } from "../handlers";
import { ViewEventHandlerOptions } from "../types";
import { TEST_AGGREGATE_IDENTIFIER } from "./aggregate";
import {
  TEST_HERMES_EVENT,
  TEST_HERMES_EVENT_CREATE,
  TEST_HERMES_EVENT_DESTROY,
  TEST_HERMES_EVENT_MERGE_STATE,
  TEST_HERMES_EVENT_SET_STATE,
  TEST_HERMES_EVENT_THROWS,
} from "./hermes-event";
import { TEST_VIEW_IDENTIFIER } from "./view";

export const TEST_VIEW_EVENT_HANDLER_OPTIONS: ViewEventHandlerOptions = {
  adapter: { type: ViewStoreType.Custom },
  aggregate: {
    name: TEST_AGGREGATE_IDENTIFIER.name,
    context: TEST_AGGREGATE_IDENTIFIER.context,
  },
  view: {
    name: TEST_VIEW_IDENTIFIER.name,
    context: TEST_VIEW_IDENTIFIER.context,
  },
  eventName: TEST_HERMES_EVENT.name,

  conditions: { created: true },
  getViewId: (event) => event.aggregate.id,
  handler: jest.fn().mockImplementation(async () => {}),
};

export const TEST_VIEW_EVENT_HANDLER = new HermesViewEventHandler(
  TEST_VIEW_EVENT_HANDLER_OPTIONS,
);

export const TEST_VIEW_EVENT_HANDLER_CREATE = new HermesViewEventHandler({
  ...TEST_VIEW_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_CREATE.name,
  conditions: { created: false },
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.setState({ created: true });
  }),
});

export const TEST_VIEW_EVENT_HANDLER_DESTROY = new HermesViewEventHandler({
  ...TEST_VIEW_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_DESTROY.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.destroy();
  }),
});

export const TEST_VIEW_EVENT_HANDLER_MERGE_STATE = new HermesViewEventHandler({
  ...TEST_VIEW_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_MERGE_STATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.mergeState({ merge: ctx.event });
  }),
});

export const TEST_VIEW_EVENT_HANDLER_SET_STATE = new HermesViewEventHandler({
  ...TEST_VIEW_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_SET_STATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.setState({ ...ctx.state, set: ctx.event });
  }),
});

export const TEST_VIEW_EVENT_HANDLER_THROWS = new HermesViewEventHandler({
  ...TEST_VIEW_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_THROWS.name,
  handler: jest.fn().mockImplementation(async () => {
    throw new Error("throw");
  }),
});
