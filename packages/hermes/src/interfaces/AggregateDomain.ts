import { Dict } from "@lindorm/types";
import { AggregateIdentifier } from "../types";
import { IAggregateModel } from "./AggregateModel";

export interface IAggregateDomain {
  registerHandlers(): Promise<void>;
  inspect<S extends Dict = Dict>(
    aggregateIdentifier: AggregateIdentifier,
  ): Promise<IAggregateModel<S>>;
}
