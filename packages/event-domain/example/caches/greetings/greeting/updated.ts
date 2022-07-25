import { CacheEventHandlerFile } from "../../../../src";

const main: CacheEventHandlerFile = {
  conditions: { created: true },
  getCacheId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.addField("messages", ctx.event.data.greeting);
  },
};
export default main;
