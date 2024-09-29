import { HermesChecksumEventHandler } from "../handlers";
import { ChecksumEventHandlerOptions } from "../types";
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

export const TEST_CHECKSUM_EVENT_HANDLER_OPTIONS: ChecksumEventHandlerOptions = {
  aggregate: {
    name: TEST_AGGREGATE_OPTIONS.name,
    context: TEST_AGGREGATE_OPTIONS.context,
  },
  eventName: TEST_HERMES_EVENT.name,
};

export const TEST_CHECKSUM_EVENT_HANDLER = new HermesChecksumEventHandler(
  TEST_CHECKSUM_EVENT_HANDLER_OPTIONS,
);

export const TEST_CHECKSUM_EVENT_HANDLER_CREATE = new HermesChecksumEventHandler({
  ...TEST_CHECKSUM_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_CREATE.name,
});

export const TEST_CHECKSUM_EVENT_HANDLER_DESTROY = new HermesChecksumEventHandler({
  ...TEST_CHECKSUM_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_DESTROY.name,
});

export const TEST_CHECKSUM_EVENT_HANDLER_DESTROY_NEXT = new HermesChecksumEventHandler({
  ...TEST_CHECKSUM_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_DESTROY_NEXT.name,
});

export const TEST_CHECKSUM_EVENT_HANDLER_MERGE_STATE = new HermesChecksumEventHandler({
  ...TEST_CHECKSUM_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_MERGE_STATE.name,
});

export const TEST_CHECKSUM_EVENT_HANDLER_SET_STATE = new HermesChecksumEventHandler({
  ...TEST_CHECKSUM_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_SET_STATE.name,
});

export const TEST_CHECKSUM_EVENT_HANDLER_THROWS = new HermesChecksumEventHandler({
  ...TEST_CHECKSUM_EVENT_HANDLER_OPTIONS,
  eventName: TEST_HERMES_EVENT_THROWS.name,
});
