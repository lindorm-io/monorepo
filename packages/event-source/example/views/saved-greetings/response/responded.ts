import { ViewEventHandlerFile } from "../../../../src";

const main: ViewEventHandlerFile = {
  conditions: { created: true },
  persistence: { type: "mongo" },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.addListItem("responses", ctx.event.data.respond);
  },
};
export default main;
