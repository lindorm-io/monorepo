import { GreetingResponded } from "./greeting-responded.event";
import { ViewEventHandler } from "../../../../src";

const main: ViewEventHandler<GreetingResponded> = {
  name: "postgres_greetings",
  conditions: { created: true },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.setState({
      ...ctx.state,
      messages: [...(ctx.state.messages || []), ctx.event.response],
    });
  },
};

export default main;
