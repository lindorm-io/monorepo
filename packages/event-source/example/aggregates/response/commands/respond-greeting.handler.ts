import Joi from "joi";
import { AggregateCommandHandler } from "../../../../src";
import { GreetingResponded } from "../events/greeting-responded.event";
import { RespondGreeting } from "./respond-greeting.command";

const main: AggregateCommandHandler<RespondGreeting, GreetingResponded> = {
  command: RespondGreeting,
  conditions: { created: false },
  schema: Joi.object()
    .keys({
      response: Joi.string().required(),
    })
    .required(),
  handler: async ({ command, apply }) => {
    await apply(new GreetingResponded(command.response));
  },
};
export default main;
