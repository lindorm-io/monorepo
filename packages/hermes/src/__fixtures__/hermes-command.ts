import { HermesMessageOptions } from "../types";
import { TEST_AGGREGATE_IDENTIFIER } from "./aggregate";

export const TEST_HERMES_COMMAND_OPTIONS: HermesMessageOptions = {
  aggregate: TEST_AGGREGATE_IDENTIFIER,
  name: "hermes_command_default",
  data: { commandData: true },
  meta: { origin: "test" },
};

export const TEST_HERMES_COMMAND = TEST_HERMES_COMMAND_OPTIONS;

export const TEST_HERMES_COMMAND_CREATE = {
  ...TEST_HERMES_COMMAND_OPTIONS,
  name: "hermes_command_create",
};

export const TEST_HERMES_COMMAND_ADD_FIELD = {
  ...TEST_HERMES_COMMAND_OPTIONS,
  name: "hermes_command_add_field",
};

export const TEST_HERMES_COMMAND_DESTROY = {
  ...TEST_HERMES_COMMAND_OPTIONS,
  name: "hermes_command_destroy",
};

export const TEST_HERMES_COMMAND_DESTROY_NEXT = {
  ...TEST_HERMES_COMMAND_OPTIONS,
  name: "hermes_command_destroy_next",
};

export const TEST_HERMES_COMMAND_DISPATCH = {
  ...TEST_HERMES_COMMAND_OPTIONS,
  name: "hermes_command_dispatch",
};

export const TEST_HERMES_COMMAND_MERGE_STATE = {
  ...TEST_HERMES_COMMAND_OPTIONS,
  name: "hermes_command_merge_state",
};

export const TEST_HERMES_COMMAND_REMOVE_FIELD_WHERE_EQUAL = {
  ...TEST_HERMES_COMMAND_OPTIONS,
  name: "hermes_command_remove_field_where_equal",
};

export const TEST_HERMES_COMMAND_REMOVE_FIELD_WHERE_MATCH = {
  ...TEST_HERMES_COMMAND_OPTIONS,
  name: "hermes_command_remove_field_where_match",
};

export const TEST_HERMES_COMMAND_SET_STATE = {
  ...TEST_HERMES_COMMAND_OPTIONS,
  name: "hermes_command_set_state",
};

export const TEST_HERMES_COMMAND_THROWS = {
  ...TEST_HERMES_COMMAND_OPTIONS,
  name: "hermes_command_throws",
};

export const TEST_HERMES_COMMAND_TIMEOUT = {
  ...TEST_HERMES_COMMAND_OPTIONS,
  name: "hermes_command_timeout",
};
