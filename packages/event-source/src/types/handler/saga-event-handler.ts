import { Logger } from "@lindorm-io/core-logger";
import { DomainEvent, TimeoutMessage } from "../../message";
import { Constructor, DtoClass, State } from "../generic";
import { SagaDispatchOptions } from "../model";
import { HandlerConditions, HandlerIdentifier, HandlerIdentifierMultipleContexts } from "./handler";

export interface SagaEventHandlerContext<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
  TDispatch extends DtoClass = DtoClass,
> {
  event: TEvent;
  logger: Logger;
  state: TState;
  destroy(): void;
  dispatch(command: TDispatch, options?: SagaDispatchOptions): void;
  mergeState(data: Partial<TState>): void;
  setState(state: TState): void;
  timeout(name: string, data: Record<string, any>, delay: number): void;
}

export interface SagaEventHandlerFileAggregate {
  name?: string;
  context?: Array<string> | string;
}

export interface SagaEventHandler<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
  TDispatch extends DtoClass = DtoClass,
> {
  event: Constructor<TEvent>;
  aggregate?: SagaEventHandlerFileAggregate;
  conditions?: HandlerConditions;
  getSagaId?(event: DomainEvent<TEvent> | TimeoutMessage<TEvent>): string;
  handler(ctx: SagaEventHandlerContext<TEvent, TState, TDispatch>): Promise<void>;
}

export interface SagaEventHandlerOptions<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
  TDispatch extends DtoClass = DtoClass,
> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions?: HandlerConditions;
  eventName: string;
  saga: HandlerIdentifier;
  version?: number;
  getSagaId?(event: DomainEvent<TEvent> | TimeoutMessage<TEvent>): string;
  handler(ctx: SagaEventHandlerContext<TEvent, TState, TDispatch>): Promise<void>;
}

export interface ISagaEventHandler<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
  TDispatch extends DtoClass = DtoClass,
> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  eventName: string;
  saga: HandlerIdentifier;
  version: number;
  getSagaId(event: DomainEvent<TEvent> | TimeoutMessage<TEvent>): string;
  handler(ctx: SagaEventHandlerContext<TEvent, TState, TDispatch>): Promise<void>;
}
