import { GreetingUpdated } from "./greeting-updated.event";
import { ViewEventHandler } from "../../../../src";

const mongo: ViewEventHandler<GreetingUpdated> = {
  event: GreetingUpdated,
  view: "mongo_greetings",
  adapter: { type: "mongo" },
  conditions: { created: true },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.setState({
      ...ctx.state,
      messages: [...(ctx.state.messages || []), ctx.event.greeting],
    });
  },
};

const postgres: ViewEventHandler<GreetingUpdated> = {
  event: GreetingUpdated,
  view: "postgres_greetings",
  adapter: { type: "postgres" },
  conditions: { created: true },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.setState({
      ...ctx.state,
      messages: [...(ctx.state.messages || []), ctx.event.greeting],
    });
  },
};

export default [mongo, postgres];
