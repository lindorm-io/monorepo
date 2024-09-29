import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { ViewIdentifier, ViewOptions } from "../types";

export const TEST_VIEW_IDENTIFIER: ViewIdentifier = {
  id: randomUUID(),
  name: "name",
  context: "default",
};

export const TEST_VIEW_OPTIONS: ViewOptions = {
  ...TEST_VIEW_IDENTIFIER,
  logger: createMockLogger(),
};
