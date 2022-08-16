import { Data, State } from "./generic";
import { DomainEvent, TimeoutMessage } from "../message";
import { HandlerConditions, HandlerIdentifier, HandlerIdentifierMultipleContexts } from "./handler";
import { ILogger } from "@lindorm-io/winston";
import { SagaDispatchOptions } from "./saga";
import { SagaStoreHandlerOptions } from "./saga-store";

export type GetSagaIdFunction = (event: DomainEvent | TimeoutMessage) => string;

export interface SagaEventHandlerContext<S extends State = State, D extends Data = Data> {
  event: DomainEvent<D> | TimeoutMessage<D>;
  logger: ILogger;

  destroy(): void;
  dispatch(name: string, data: Record<string, any>, options?: SagaDispatchOptions): void;
  getState(): S;
  mergeState(data: Partial<S>): void;
  setState(path: string, value: any): void;
  timeout(name: string, data: Record<string, any>, delay: number): void;
}

export interface SagaEventHandlerFileAggregate {
  context?: Array<string> | string;
}

export interface SagaEventHandlerFile<S extends State = State, D extends Data = Data> {
  aggregate?: SagaEventHandlerFileAggregate;
  conditions?: HandlerConditions;
  options?: SagaStoreHandlerOptions;
  getSagaId?: GetSagaIdFunction;
  handler(ctx: SagaEventHandlerContext<S, D>): Promise<void>;
}

export interface SagaEventHandlerOptions<S extends State = State> extends SagaEventHandlerFile<S> {
  aggregate: HandlerIdentifierMultipleContexts;
  eventName: string;
  saga: HandlerIdentifier;
}

export interface ISagaEventHandler<S extends State = State, D extends Data = Data> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  eventName: string;
  saga: HandlerIdentifier;
  options: SagaStoreHandlerOptions;
  getSagaId: GetSagaIdFunction;
  handler(ctx: SagaEventHandlerContext<S, D>): Promise<void>;
}
