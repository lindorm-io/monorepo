import { TEST_AGGREGATE_IDENTIFIER } from "./aggregate.fixture";
import { TEST_VIEW_IDENTIFIER } from "./view.fixture";
import { ViewEventHandler } from "../handler";
import { ViewEventHandlerOptions } from "../types";
import {
  TEST_DOMAIN_EVENT_ADD_FIELD,
  TEST_DOMAIN_EVENT,
  TEST_DOMAIN_EVENT_DESTROY,
  TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_EQUAL,
  TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_MATCH,
  TEST_DOMAIN_EVENT_SET_STATE,
  TEST_DOMAIN_EVENT_THROWS,
  TEST_DOMAIN_EVENT_CREATE,
} from "./domain-event.fixture";

export const TEST_VIEW_EVENT_HANDLER_OPTIONS: ViewEventHandlerOptions = {
  aggregate: {
    name: TEST_AGGREGATE_IDENTIFIER.name,
    context: TEST_AGGREGATE_IDENTIFIER.context,
  },
  view: {
    name: TEST_VIEW_IDENTIFIER.name,
    context: TEST_VIEW_IDENTIFIER.context,
  },
  eventName: TEST_DOMAIN_EVENT.name,

  conditions: { created: true },
  persistence: { type: "mongo" },
  getViewId: (event) => event.aggregate.id,
  handler: jest.fn().mockImplementation(async () => {}),
};

export const TEST_VIEW_EVENT_HANDLER = new ViewEventHandler(TEST_VIEW_EVENT_HANDLER_OPTIONS);

export const TEST_VIEW_EVENT_HANDLER_CREATE = new ViewEventHandler({
  ...TEST_VIEW_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_CREATE.name,
  conditions: { created: false },
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.setState("created", true);
  }),
});

export const TEST_VIEW_EVENT_HANDLER_ADD_FIELD = new ViewEventHandler({
  ...TEST_VIEW_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_ADD_FIELD.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.addField("field.string", "value");
    ctx.addField("field.record", { record: true });
  }),
});

export const TEST_VIEW_EVENT_HANDLER_DESTROY = new ViewEventHandler({
  ...TEST_VIEW_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_DESTROY.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.destroy();
  }),
});

export const TEST_VIEW_EVENT_HANDLER_REMOVE_FIELD_WHERE_EQUAL = new ViewEventHandler({
  ...TEST_VIEW_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_EQUAL.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.removeFieldWhereEqual("path.string", "value");
  }),
});

export const TEST_VIEW_EVENT_HANDLER_REMOVE_FIELD_WHERE_MATCH = new ViewEventHandler({
  ...TEST_VIEW_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_MATCH.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.removeFieldWhereMatch("path.record", { record: true });
  }),
});

export const TEST_VIEW_EVENT_HANDLER_SET_STATE = new ViewEventHandler({
  ...TEST_VIEW_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_SET_STATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    ctx.setState("path", { value: ctx.event.data });
  }),
});

export const TEST_VIEW_EVENT_HANDLER_THROWS = new ViewEventHandler({
  ...TEST_VIEW_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_THROWS.name,
  handler: jest.fn().mockImplementation(async () => {
    throw new Error("throw");
  }),
});
