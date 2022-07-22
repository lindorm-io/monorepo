import {
  GetSagaIdFunction,
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierMultipleContexts,
  ISagaEventHandler,
  SagaEventHandlerContext,
  SagaEventHandlerOptions,
  SagaStoreSaveOptions,
} from "../types";

export class SagaEventHandler<State extends Record<string, any> = Record<string, any>>
  implements ISagaEventHandler<State>
{
  public readonly aggregate: HandlerIdentifierMultipleContexts;
  public readonly conditions: HandlerConditions;
  public readonly eventName: string;
  public readonly saga: HandlerIdentifier;
  public readonly saveOptions: SagaStoreSaveOptions;
  public readonly getSagaId: GetSagaIdFunction;
  public readonly handler: (ctx: SagaEventHandlerContext<State>) => Promise<void>;

  public constructor(options: SagaEventHandlerOptions<State>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.conditions = options.conditions || {};
    this.eventName = options.eventName;
    this.saga = { name: options.saga.name, context: options.saga.context };
    this.saveOptions = options.saveOptions || {};
    this.getSagaId = options.getSagaId;
    this.handler = options.handler;
  }
}
