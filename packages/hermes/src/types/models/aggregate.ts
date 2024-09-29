import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { IHermesAggregateEventHandler, IHermesMessage } from "../../interfaces";
import { AggregateIdentifier } from "../identifiers";

export interface AggregateData<S extends Dict = Dict> extends AggregateIdentifier {
  destroyed: boolean;
  events: Array<IHermesMessage>;
  numberOfLoadedEvents: number;
  state: S;
}

export interface AggregateOptions extends AggregateIdentifier {
  eventHandlers: Array<IHermesAggregateEventHandler>;
  logger: ILogger;
}
