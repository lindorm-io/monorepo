import { ClassConstructor, State } from "../generic";
import { DomainEvent, TimeoutMessage } from "../../message";
import { HandlerConditions, HandlerIdentifier, HandlerIdentifierMultipleContexts } from "./handler";
import { ILogger } from "@lindorm-io/winston";
import { SagaDispatchOptions } from "../entity";

export type GetSagaIdFunction<TEvent extends ClassConstructor = ClassConstructor> = (
  event: DomainEvent<TEvent> | TimeoutMessage<TEvent>,
) => string;

export interface SagaEventHandlerContext<
  TEvent extends ClassConstructor = ClassConstructor,
  TState extends State = State,
  TDispatch extends ClassConstructor = ClassConstructor,
> {
  event: TEvent;
  logger: ILogger;
  destroy(): void;
  dispatch(command: TDispatch, options?: SagaDispatchOptions): void;
  getState(): TState;
  mergeState(data: Partial<TState>): void;
  setState(path: string, value: any): void;
  timeout(name: string, data: Record<string, any>, delay: number): void;
}

export interface SagaEventHandlerFileAggregate {
  context?: Array<string> | string;
}

export interface SagaEventHandler<
  TEvent extends ClassConstructor,
  TState extends State = State,
  TDispatch extends ClassConstructor = ClassConstructor,
> {
  name: string;
  aggregate?: SagaEventHandlerFileAggregate;
  conditions?: HandlerConditions;
  version?: number;
  getSagaId?(event: DomainEvent<TEvent> | TimeoutMessage<TEvent>): string;
  handler(ctx: SagaEventHandlerContext<TEvent, TState, TDispatch>): Promise<void>;
}

export interface SagaEventHandlerOptions<
  TEvent extends ClassConstructor = ClassConstructor,
  TState extends State = State,
  TDispatch extends ClassConstructor = ClassConstructor,
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
  TEvent extends ClassConstructor = ClassConstructor,
  TState extends State = State,
  TDispatch extends ClassConstructor = ClassConstructor,
> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  eventName: string;
  saga: HandlerIdentifier;
  version: number;
  getSagaId(event: DomainEvent<TEvent> | TimeoutMessage<TEvent>): string;
  handler(ctx: SagaEventHandlerContext<TEvent, TState, TDispatch>): Promise<void>;
}
