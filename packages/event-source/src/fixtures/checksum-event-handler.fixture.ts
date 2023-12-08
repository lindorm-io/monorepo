import { ChecksumEventHandlerImplementation } from "../handler";
import { ChecksumEventHandlerOptions } from "../types";
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

export const TEST_CHECKSUM_EVENT_HANDLER_OPTIONS: ChecksumEventHandlerOptions = {
  aggregate: {
    name: TEST_AGGREGATE_OPTIONS.name,
    context: TEST_AGGREGATE_OPTIONS.context,
  },
  eventName: TEST_DOMAIN_EVENT.name,
};

export const TEST_CHECKSUM_EVENT_HANDLER = new ChecksumEventHandlerImplementation(
  TEST_CHECKSUM_EVENT_HANDLER_OPTIONS,
);

export const TEST_CHECKSUM_EVENT_HANDLER_CREATE = new ChecksumEventHandlerImplementation({
  ...TEST_CHECKSUM_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_CREATE.name,
});

export const TEST_CHECKSUM_EVENT_HANDLER_DESTROY = new ChecksumEventHandlerImplementation({
  ...TEST_CHECKSUM_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_DESTROY.name,
});

export const TEST_CHECKSUM_EVENT_HANDLER_DESTROY_NEXT = new ChecksumEventHandlerImplementation({
  ...TEST_CHECKSUM_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_DESTROY_NEXT.name,
});

export const TEST_CHECKSUM_EVENT_HANDLER_MERGE_STATE = new ChecksumEventHandlerImplementation({
  ...TEST_CHECKSUM_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_MERGE_STATE.name,
});

export const TEST_CHECKSUM_EVENT_HANDLER_SET_STATE = new ChecksumEventHandlerImplementation({
  ...TEST_CHECKSUM_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_SET_STATE.name,
});

export const TEST_CHECKSUM_EVENT_HANDLER_THROWS = new ChecksumEventHandlerImplementation({
  ...TEST_CHECKSUM_EVENT_HANDLER_OPTIONS,
  eventName: TEST_DOMAIN_EVENT_THROWS.name,
});
