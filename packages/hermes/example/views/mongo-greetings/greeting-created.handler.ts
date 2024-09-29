import { IViewEventHandler, ViewStoreType } from "../../../src";
import { GreetingCreated } from "../../aggregates/greeting/events/greeting-created.event";

const mongo: IViewEventHandler<GreetingCreated> = {
  event: GreetingCreated,
  adapter: { type: ViewStoreType.Mongo },
  conditions: { created: false },
  getViewId: (event) => event.aggregate.id,
  handler: async ({ event, state, setState }) => {
    setState({
      ...state,
      messages: [...(state.messages || []), event.initial],
    });
  },
};

export default [mongo];
