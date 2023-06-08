import { ViewEventHandler } from "../../../src";
import { GreetingResponded } from "../../aggregates/response/events/greeting-responded.event";

const postgres: ViewEventHandler<GreetingResponded> = {
  event: GreetingResponded,
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

export default [postgres];
