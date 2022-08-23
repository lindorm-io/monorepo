import Joi from "joi";
import { AggregateCommandHandler } from "../../../../src";
import { RespondGreeting } from "./respond-greeting.command";
import { GreetingResponded } from "../events/greeting-responded.event";

const main: AggregateCommandHandler<RespondGreeting, GreetingResponded> = {
  conditions: { created: false },
  schema: Joi.object()
    .keys({
      response: Joi.string().required(),
    })
    .required(),
  handler: async (ctx) => {
    await ctx.apply(new GreetingResponded(ctx.command.response));
  },
};
export default main;
