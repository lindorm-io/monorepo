import { DomainEvent, TimeoutEvent } from "../message";
import { HandlerConditions, HandlerIdentifier, HandlerIdentifierMultipleContexts } from "./handler";
import { Logger } from "@lindorm-io/winston";
import { SagaDispatchOptions } from "./saga";
import { SagaStoreSaveOptions } from "./saga-store";
import { State } from "./generic";

export type GetSagaIdFunction = (event: DomainEvent | TimeoutEvent) => string;

export interface SagaEventHandlerContext<S extends State = State> {
  event: DomainEvent | TimeoutEvent;
  logger: Logger;

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

export interface SagaEventHandlerFile<S extends State = State> {
  aggregate?: SagaEventHandlerFileAggregate;
  conditions?: HandlerConditions;
  saveOptions?: SagaStoreSaveOptions;
  getSagaId: GetSagaIdFunction;
  handler(ctx: SagaEventHandlerContext<S>): Promise<void>;
}

export interface SagaEventHandlerOptions<S extends State = State> extends SagaEventHandlerFile<S> {
  aggregate: HandlerIdentifierMultipleContexts;
  eventName: string;
  saga: HandlerIdentifier;
}

export interface ISagaEventHandler<S extends State = State> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  eventName: string;
  saga: HandlerIdentifier;
  saveOptions: SagaStoreSaveOptions;
  getSagaId: GetSagaIdFunction;
  handler(ctx: SagaEventHandlerContext<S>): Promise<void>;
}
