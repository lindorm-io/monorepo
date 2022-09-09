import { GreetingResponded } from "./greeting-responded.event";
import { ViewEventHandler } from "../../../../src";

const mongo: ViewEventHandler<GreetingResponded> = {
  event: GreetingResponded,
  view: "mongo_greetings",
  adapter: { type: "mongo" },
  conditions: { created: true },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.setState({
      ...ctx.state,
      messages: [...(ctx.state.messages || []), ctx.event.response],
    });
  },
};

const postgres: ViewEventHandler<GreetingResponded> = {
  event: GreetingResponded,
  view: "postgres_greetings",
  adapter: { type: "postgres" },
  conditions: { created: true },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.setState({
      ...ctx.state,
      messages: [...(ctx.state.messages || []), ctx.event.response],
    });
  },
};

export default [mongo, postgres];
