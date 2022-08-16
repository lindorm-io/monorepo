import Joi from "joi";
import { AggregateCommandHandlerFile } from "../../../../src";

/**
 * Exporting handler as [ default ]
 */

const main: AggregateCommandHandlerFile = {
  conditions: { created: true },
  schema: Joi.object()
    .keys({
      greeting: Joi.string().required(),
    })
    .required(),
  handler: async (ctx) => {
    await ctx.apply("updated", ctx.command.data);
  },
};
export default main;
