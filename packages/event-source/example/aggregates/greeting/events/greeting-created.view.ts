import { GreetingCreated } from "./greeting-created.event";
import { StoredGreeting } from "../../../entities";
import { ViewEventHandler } from "../../../../src";

const main: ViewEventHandler<GreetingCreated> = {
  name: "postgres_greetings",
  conditions: { created: false },
  adapters: { postgres: { ViewEntity: StoredGreeting } },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.addListItem("messages", ctx.event.initial);
  },
};

export default main;
