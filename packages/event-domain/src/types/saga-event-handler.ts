import { DomainEvent, TimeoutEvent } from "../message";
import { Logger } from "@lindorm-io/winston";
import { SagaDispatchOptions } from "./saga";
import { SagaStoreSaveOptions } from "./saga-store";
import {
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierExpectingStructure,
  HandlerIdentifierMultipleContexts,
} from "./handler";

export type GetSagaIdFunction = (event: DomainEvent | TimeoutEvent) => string;

export interface SagaEventHandlerContext<State extends Record<string, any> = Record<string, any>> {
  event: DomainEvent | TimeoutEvent;
  state: State;
  logger: Logger;
  destroy(): void;
  dispatch(name: string, data: Record<string, any>, options?: SagaDispatchOptions): void;
  mergeState(data: Partial<State>): void;
  setState(path: string, value: any): void;
  timeout(name: string, data: Record<string, any>, delay: number): void;
}

export interface SagaEventHandlerFile<State extends Record<string, any> = Record<string, any>> {
  conditions?: HandlerConditions;
  context?: Array<string> | string;
  saveOptions?: SagaStoreSaveOptions;
  getSagaId: GetSagaIdFunction;
  handler(ctx: SagaEventHandlerContext<State>): Promise<void>;
}

export interface SagaEventHandlerOptions<State extends Record<string, any> = Record<string, any>>
  extends SagaEventHandlerFile<State> {
  aggregate: HandlerIdentifierMultipleContexts;
  eventName: string;
  saga: HandlerIdentifierExpectingStructure;
}

export interface ISagaEventHandler<State extends Record<string, any> = Record<string, any>> {
  aggregate: HandlerIdentifierMultipleContexts;
  conditions: HandlerConditions;
  eventName: string;
  saga: HandlerIdentifier;
  saveOptions: SagaStoreSaveOptions;
  getSagaId: GetSagaIdFunction;
  handler(ctx: SagaEventHandlerContext<State>): Promise<void>;
}
