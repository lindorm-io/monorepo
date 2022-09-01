import { DomainEvent } from "../message";
import {
  DtoClass,
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierMultipleContexts,
  IViewEventHandler,
  State,
  ViewEventHandlerContext,
  ViewEventHandlerOptions,
  ViewEventHandlerStoreOptions,
} from "../types";

export class ViewEventHandlerImplementation<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> implements IViewEventHandler<TEvent, TState>
{
  public readonly aggregate: HandlerIdentifierMultipleContexts;
  public readonly conditions: HandlerConditions;
  public readonly eventName: string;
  public readonly options: ViewEventHandlerStoreOptions;
  public readonly version: number;
  public readonly view: HandlerIdentifier;
  public readonly getViewId: (event: DomainEvent<TEvent>) => string;
  public readonly handler: (ctx: ViewEventHandlerContext<TEvent, TState>) => Promise<void>;

  public constructor(options: ViewEventHandlerOptions<TEvent, TState>) {
    this.options = options.options;
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.conditions = options.conditions || {};
    this.eventName = options.eventName;
    this.version = options.version || 1;
    this.view = { name: options.view.name, context: options.view.context };
    this.getViewId = options.getViewId ? options.getViewId : (event): string => event.aggregate.id;
    this.handler = options.handler;
  }
}
