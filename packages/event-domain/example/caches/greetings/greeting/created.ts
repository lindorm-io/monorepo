import { CacheEventHandlerFile } from "../../../../src";

const main: CacheEventHandlerFile = {
  conditions: { created: false },
  getCacheId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.addField("messages", ctx.event.data.initial);
  },
};
export default main;
