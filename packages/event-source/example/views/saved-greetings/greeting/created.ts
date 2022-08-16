import { ViewEventHandlerFile } from "../../../../src";

const main: ViewEventHandlerFile = {
  conditions: { created: false },
  persistence: { type: "mongo" },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.addListItem("messages", ctx.event.data.initial);
  },
};
export default main;
