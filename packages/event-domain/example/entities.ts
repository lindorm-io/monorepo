import { createViewEntities } from "../src";

export const { ViewEntity: StoredGreeting, ViewCausationEntity: StoredGreetingCausation } =
  createViewEntities("stored_greeting");
