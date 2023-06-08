import { ViewEventHandler } from "../../../src";
import { GreetingCreated } from "../../aggregates/greeting/events/greeting-created.event";

const postgres: ViewEventHandler<GreetingCreated> = {
  event: GreetingCreated,
  adapter: { type: "postgres" },
  conditions: { created: false },
  getViewId: (event) => event.aggregate.id,
  handler: async ({ event, state, setState }) => {
    setState({
      ...state,
      messages: [...(state.messages || []), event.initial],
    });
  },
};

export default [postgres];
