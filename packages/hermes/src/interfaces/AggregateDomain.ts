import { Dict } from "@lindorm/types";
import { AggregateIdentifier } from "../types";
import { IAggregate } from "./Aggregate";
import { IHermesAggregateCommandHandler } from "./AggregateCommandHandler";
import { IHermesAggregateEventHandler } from "./AggregateEventHandler";

export interface IAggregateDomain {
  registerCommandHandler(handler: IHermesAggregateCommandHandler): Promise<void>;
  registerEventHandler(handler: IHermesAggregateEventHandler): Promise<void>;
  inspect<S extends Dict = Dict>(
    aggregateIdentifier: AggregateIdentifier,
  ): Promise<IAggregate<S>>;
}
