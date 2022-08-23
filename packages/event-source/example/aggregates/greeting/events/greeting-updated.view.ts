import { GreetingUpdated } from "./greeting-updated.event";
import { StoredGreeting } from "../../../entities";
import { ViewEventHandler } from "../../../../src";

const main: ViewEventHandler<GreetingUpdated> = {
  name: "postgres_greetings",
  conditions: { created: true },
  adapters: { postgres: { ViewEntity: StoredGreeting } },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.addListItem("messages", ctx.event.greeting);
  },
};

export default main;
