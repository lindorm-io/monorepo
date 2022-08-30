import { MessageOptions } from "../types";
import { TEST_AGGREGATE_IDENTIFIER } from "./aggregate.fixture";

export const TEST_COMMAND_OPTIONS: MessageOptions = {
  aggregate: TEST_AGGREGATE_IDENTIFIER,
  name: "command_default",
  data: { commandData: true },
  metadata: { origin: "test" },
};

export const TEST_COMMAND = TEST_COMMAND_OPTIONS;

export const TEST_COMMAND_CREATE = {
  ...TEST_COMMAND_OPTIONS,
  name: "command_create",
};

export const TEST_COMMAND_ADD_FIELD = {
  ...TEST_COMMAND_OPTIONS,
  name: "command_add_field",
};

export const TEST_COMMAND_DESTROY = {
  ...TEST_COMMAND_OPTIONS,
  name: "command_destroy",
};

export const TEST_COMMAND_DESTROY_NEXT = {
  ...TEST_COMMAND_OPTIONS,
  name: "command_destroy_next",
};

export const TEST_COMMAND_DISPATCH = {
  ...TEST_COMMAND_OPTIONS,
  name: "command_dispatch",
};

export const TEST_COMMAND_MERGE_STATE = {
  ...TEST_COMMAND_OPTIONS,
  name: "command_merge_state",
};

export const TEST_COMMAND_REMOVE_FIELD_WHERE_EQUAL = {
  ...TEST_COMMAND_OPTIONS,
  name: "command_remove_field_where_equal",
};

export const TEST_COMMAND_REMOVE_FIELD_WHERE_MATCH = {
  ...TEST_COMMAND_OPTIONS,
  name: "command_remove_field_where_match",
};

export const TEST_COMMAND_SET_STATE = {
  ...TEST_COMMAND_OPTIONS,
  name: "command_set_state",
};

export const TEST_COMMAND_THROWS = {
  ...TEST_COMMAND_OPTIONS,
  name: "command_throws",
};

export const TEST_COMMAND_TIMEOUT = {
  ...TEST_COMMAND_OPTIONS,
  name: "command_timeout",
};
