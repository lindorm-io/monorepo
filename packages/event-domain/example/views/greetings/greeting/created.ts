import { ViewEventHandlerFile } from "../../../../src";

const main: ViewEventHandlerFile = {
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.addField("messages", ctx.event.data.initial);
  },
};
export default main;
