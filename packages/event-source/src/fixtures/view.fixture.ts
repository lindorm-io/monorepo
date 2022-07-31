import { ViewIdentifier, ViewOptions } from "../types";
import { randomUUID } from "crypto";

export const TEST_VIEW_IDENTIFIER: ViewIdentifier = {
  id: randomUUID(),
  name: "view_name",
  context: "default",
};

export const TEST_VIEW_OPTIONS: ViewOptions = {
  ...TEST_VIEW_IDENTIFIER,
};
