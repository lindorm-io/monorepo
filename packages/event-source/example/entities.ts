import { createTypeormViewEntity } from "../src";

export const { ViewEntity: StoredGreeting, ViewCausationEntity: StoredGreetingCausation } =
  createTypeormViewEntity("stored_greeting");
