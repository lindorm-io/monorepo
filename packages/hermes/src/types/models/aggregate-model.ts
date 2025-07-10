import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { IHermesMessage, IHermesMessageBus, IHermesRegistry } from "../../interfaces";
import { AggregateIdentifier } from "../identifiers";

export interface AggregateData<S extends Dict = Dict> extends AggregateIdentifier {
  destroyed: boolean;
  events: Array<IHermesMessage>;
  numberOfLoadedEvents: number;
  state: S;
}

export interface AggregateModelOptions extends AggregateIdentifier {
  eventBus: IHermesMessageBus;
  registry: IHermesRegistry;
  logger: ILogger;
}
