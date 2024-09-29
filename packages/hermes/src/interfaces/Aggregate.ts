import { ClassLike, Dict } from "@lindorm/types";
import { AggregateData } from "../types";
import { IHermesMessage } from "./HermesMessage";

export interface IAggregate<S extends Dict = Dict> extends AggregateData {
  apply(causation: IHermesMessage, event: ClassLike): Promise<void>;
  load(event: IHermesMessage): void;
  toJSON(): AggregateData<S>;
}
