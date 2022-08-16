import { ViewEventHandlerFile } from "../../../../src";
import { StoredGreeting, StoredGreetingCausation } from "../../../entities";

const main: ViewEventHandlerFile = {
  conditions: { created: false },
  persistence: {
    type: "postgres",
    postgres: { viewEntity: StoredGreeting, causationEntity: StoredGreetingCausation },
  },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.addListItem("messages", ctx.event.data.initial);
  },
};
export default main;
