import { z } from "zod";
import { IAggregateCommandHandler } from "../../../../src";
import { GreetingResponded } from "../events/greeting-responded.event";
import { RespondGreeting } from "./respond-greeting.command";

const main: IAggregateCommandHandler<RespondGreeting, GreetingResponded> = {
  command: RespondGreeting,
  conditions: { created: false },
  schema: z.object({
    response: z.string(),
  }),
  handler: async ({ command, apply }) => {
    await apply(new GreetingResponded(command.response));
  },
};
export default main;
