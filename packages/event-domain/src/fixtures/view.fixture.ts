import { ViewIdentifier, ViewOptions } from "../types";
import { randomUUID } from "crypto";

export const TEST_VIEW_IDENTIFIER: ViewIdentifier = {
  id: randomUUID(),
  name: "viewName",
  context: "viewContext",
};

export const TEST_VIEW_OPTIONS: ViewOptions = {
  ...TEST_VIEW_IDENTIFIER,
};
