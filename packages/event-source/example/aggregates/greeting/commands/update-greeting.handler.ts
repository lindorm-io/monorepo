import Joi from "joi";
import { AggregateCommandHandler } from "../../../../src";
import { GreetingUpdated } from "../events/greeting-updated.event";
import { UpdateGreeting } from "./update-greeting.command";

/**
 * Exporting handler as [ default ]
 */

const main: AggregateCommandHandler<UpdateGreeting, GreetingUpdated> = {
  command: UpdateGreeting,
  conditions: { created: true },
  schema: Joi.object()
    .keys({
      greeting: Joi.string().required(),
    })
    .required(),
  handler: async ({ command, apply }) => {
    await apply(new GreetingUpdated(command.greeting));
  },
};
export default main;
