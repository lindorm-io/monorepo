import { MessageOptions } from "../types";
import { TEST_AGGREGATE_IDENTIFIER } from "./aggregate.fixture";

export const TEST_DOMAIN_EVENT_OPTIONS: MessageOptions = {
  aggregate: TEST_AGGREGATE_IDENTIFIER,
  name: "domainEventDefault",
  data: { domainEventData: true },
};

export const TEST_DOMAIN_EVENT = TEST_DOMAIN_EVENT_OPTIONS;

export const TEST_DOMAIN_EVENT_CREATE = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domainEventCreate",
};

export const TEST_DOMAIN_EVENT_ADD_FIELD = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domainEventAddField",
};

export const TEST_DOMAIN_EVENT_DESTROY = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domainEventDestroy",
};

export const TEST_DOMAIN_EVENT_DESTROY_NEXT = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domainEventDestroyNext",
};

export const TEST_DOMAIN_EVENT_DISPATCH = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domainEventDispatch",
};

export const TEST_DOMAIN_EVENT_MERGE_STATE = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domainEventMergeState",
};

export const TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_EQUAL = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domainEventRemoveFieldWhereEqual",
};

export const TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_MATCH = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domainEventRemoveFieldWhereMatch",
};

export const TEST_DOMAIN_EVENT_SET_STATE = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domainEventSetState",
};

export const TEST_DOMAIN_EVENT_THROWS = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domainEventThrows",
};

export const TEST_DOMAIN_EVENT_TIMEOUT = {
  ...TEST_DOMAIN_EVENT_OPTIONS,
  name: "domainEventTimeout",
};
