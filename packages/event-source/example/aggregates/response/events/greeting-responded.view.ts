import { GreetingResponded } from "./greeting-responded.event";
import { StoredGreeting } from "../../../entities";
import { ViewEventHandler } from "../../../../src";

const main: ViewEventHandler<GreetingResponded> = {
  name: "postgres_greetings",
  conditions: { created: true },
  adapters: { postgres: { ViewEntity: StoredGreeting } },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.addListItem("messages", ctx.event.response);
  },
};

export default main;
