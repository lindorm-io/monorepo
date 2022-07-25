import { MessageOptions } from "../types";
import { TEST_AGGREGATE_IDENTIFIER } from "./aggregate.fixture";

export const TEST_COMMAND_OPTIONS: MessageOptions = {
  aggregate: TEST_AGGREGATE_IDENTIFIER,
  name: "commandDefault",
  data: { commandData: true },
};

export const TEST_COMMAND = TEST_COMMAND_OPTIONS;

export const TEST_COMMAND_CREATE = {
  ...TEST_COMMAND_OPTIONS,
  name: "commandCreate",
};

export const TEST_COMMAND_ADD_FIELD = {
  ...TEST_COMMAND_OPTIONS,
  name: "commandAddField",
};

export const TEST_COMMAND_DESTROY = {
  ...TEST_COMMAND_OPTIONS,
  name: "commandDestroy",
};

export const TEST_COMMAND_DESTROY_NEXT = {
  ...TEST_COMMAND_OPTIONS,
  name: "commandDestroyNext",
};

export const TEST_COMMAND_DISPATCH = {
  ...TEST_COMMAND_OPTIONS,
  name: "commandDispatch",
};

export const TEST_COMMAND_MERGE_STATE = {
  ...TEST_COMMAND_OPTIONS,
  name: "commandMergeState",
};

export const TEST_COMMAND_REMOVE_FIELD_WHERE_EQUAL = {
  ...TEST_COMMAND_OPTIONS,
  name: "commandRemoveFieldWhereEqual",
};

export const TEST_COMMAND_REMOVE_FIELD_WHERE_MATCH = {
  ...TEST_COMMAND_OPTIONS,
  name: "commandRemoveFieldWhereMatch",
};

export const TEST_COMMAND_SET_STATE = {
  ...TEST_COMMAND_OPTIONS,
  name: "commandSetState",
};

export const TEST_COMMAND_THROWS = {
  ...TEST_COMMAND_OPTIONS,
  name: "commandThrows",
};

export const TEST_COMMAND_TIMEOUT = {
  ...TEST_COMMAND_OPTIONS,
  name: "commandTimeout",
};
