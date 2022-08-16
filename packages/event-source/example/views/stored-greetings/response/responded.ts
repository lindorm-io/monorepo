import { ViewEventHandlerFile } from "../../../../src";
import { StoredGreeting, StoredGreetingCausation } from "../../../entities";

const main: ViewEventHandlerFile = {
  conditions: { created: true },
  persistence: {
    type: "postgres",
    postgres: { viewEntity: StoredGreeting, causationEntity: StoredGreetingCausation },
  },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.addListItem("responses", ctx.event.data.respond);
  },
};
export default main;
