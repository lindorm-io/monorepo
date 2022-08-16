import { ViewEventHandlerFile } from "../../../../src";

const main: ViewEventHandlerFile = {
  conditions: { created: true },
  persistence: { type: "redis" },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.addListItem("messages", ctx.event.data.greeting);
  },
};
export default main;
