import { MessageOptions } from "../types";
import { TEST_AGGREGATE_IDENTIFIER } from "./aggregate.fixture";

export const TEST_DOMAIN_EVENT_OPTIONS: MessageOptions = {
  aggregate: TEST_AGGREGATE_IDENTIFIER,
  name: "domain_event_default",
  data: { domainEventData: true },
  metadata: { origin: "test" },
};

export const TEST_DOMAIN_EVENT = TEST_DOMAIN_EVENT_OPTIONS;

export const TEST_DOMAIN_EVENT_CREATE = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domain_event_create",
};

export const TEST_DOMAIN_EVENT_DESTROY = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domain_event_destroy",
};

export const TEST_DOMAIN_EVENT_DESTROY_NEXT = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domain_event_destroy_next",
};

export const TEST_DOMAIN_EVENT_DISPATCH = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domain_event_dispatch",
};

export const TEST_DOMAIN_EVENT_MERGE_STATE = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domain_event_merge_state",
};

export const TEST_DOMAIN_EVENT_SET_STATE = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domain_event_set_state",
};

export const TEST_DOMAIN_EVENT_THROWS = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domain_event_throws",
};

export const TEST_DOMAIN_EVENT_TIMEOUT = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domain_event_timeout",
};
