import { Data, State } from "../generic";
import { DomainEvent } from "../../message";
import { HandlerIdentifier } from "./handler";
import { ILogger } from "@lindorm-io/winston";

export interface AggregateEventHandlerContext<S extends State = State, D extends Data = Data> {
  event: DomainEvent<D>;
  logger: ILogger;
  destroy(): void;
  destroyNext(): void;
  getState(): S;
  mergeState(data: Partial<S>): void;
  setState(path: string, value: any): void;
}

export interface AggregateEventHandlerFile<S extends State = State, D extends Data = Data> {
  version?: number;
  handler(ctx: AggregateEventHandlerContext<S, D>): Promise<void>;
}

export interface AggregateEventHandlerOptions<S extends State = State>
  extends AggregateEventHandlerFile<S> {
  aggregate: HandlerIdentifier;
  eventName: string;
}

export interface IAggregateEventHandler<S extends State = State, D extends Data = Data> {
  aggregate: HandlerIdentifier;
  eventName: string;
  version: number;
  handler(ctx: AggregateEventHandlerContext<S, D>): Promise<void>;
}
