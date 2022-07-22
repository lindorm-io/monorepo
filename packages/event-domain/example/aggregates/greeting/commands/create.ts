import Joi from "joi";
import { AggregateCommandHandlerFile } from "../../../../src";

const main: AggregateCommandHandlerFile = {
  conditions: { created: false },
  schema: Joi.object(),
  handler: async (ctx) => {
    await ctx.apply("created", ctx.command.data);
  },
};
export default main;
