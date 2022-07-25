import Joi from "joi";
import { AggregateCommandHandlerFile } from "../../../../src";

const main: AggregateCommandHandlerFile = {
  conditions: { created: false },
  schema: Joi.object()
    .keys({
      respond: Joi.string().required(),
    })
    .required(),
  handler: async (ctx) => {
    await ctx.apply("responded", ctx.command.data);
  },
};
export default main;
