import { ViewEventHandler } from "../../../../src";
import { GreetingResponded } from "./greeting-responded.event";

const mongo: ViewEventHandler<GreetingResponded> = {
  event: GreetingResponded,
  view: "mongo_greetings",
  adapter: { type: "mongo" },
  conditions: { created: true },
  getViewId: (event) => event.aggregate.id,
  handler: async ({ event, state, setState }) => {
    setState({
      ...state,
      messages: [...(state.messages || []), event.response],
    });
  },
};

const postgres: ViewEventHandler<GreetingResponded> = {
  event: GreetingResponded,
  view: "postgres_greetings",
  adapter: { type: "postgres" },
  conditions: { created: true },
  getViewId: (event) => event.aggregate.id,
  handler: async ({ event, state, setState }) => {
    setState({
      ...state,
      messages: [...(state.messages || []), event.response],
    });
  },
};

export default [mongo, postgres];
