import { IViewEventHandler, ViewStoreType } from "../../../src";
import { GreetingCreated } from "../../aggregates/greeting/events/greeting-created.event";

const postgres: IViewEventHandler<GreetingCreated> = {
  event: GreetingCreated,
  adapter: { type: ViewStoreType.Postgres },
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
