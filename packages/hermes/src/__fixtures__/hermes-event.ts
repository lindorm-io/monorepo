import { HermesMessageOptions } from "../types";
import { TEST_AGGREGATE_IDENTIFIER } from "./aggregate";

export const TEST_HERMES_EVENT_OPTIONS: HermesMessageOptions = {
  aggregate: TEST_AGGREGATE_IDENTIFIER,
  name: "hermes_event_default",
  data: { hermesEventData: true },
  meta: { origin: "test" },
};

export const TEST_HERMES_EVENT = TEST_HERMES_EVENT_OPTIONS;

export const TEST_HERMES_EVENT_CREATE = {
  ...TEST_HERMES_EVENT_OPTIONS,
  name: "hermes_event_create",
};

export const TEST_HERMES_EVENT_DESTROY = {
  ...TEST_HERMES_EVENT_OPTIONS,
  name: "hermes_event_destroy",
};

export const TEST_HERMES_EVENT_DESTROY_NEXT = {
  ...TEST_HERMES_EVENT_OPTIONS,
  name: "hermes_event_destroy_next",
};

export const TEST_HERMES_EVENT_DISPATCH = {
  ...TEST_HERMES_EVENT_OPTIONS,
  name: "hermes_event_dispatch",
};

export const TEST_HERMES_EVENT_MERGE_STATE = {
  ...TEST_HERMES_EVENT_OPTIONS,
  name: "hermes_event_merge_state",
};

export const TEST_HERMES_EVENT_SET_STATE = {
  ...TEST_HERMES_EVENT_OPTIONS,
  name: "hermes_event_set_state",
};

export const TEST_HERMES_EVENT_THROWS = {
  ...TEST_HERMES_EVENT_OPTIONS,
  name: "hermes_event_throws",
};

export const TEST_HERMES_EVENT_TIMEOUT = {
  ...TEST_HERMES_EVENT_OPTIONS,
  name: "hermes_event_timeout",
};
