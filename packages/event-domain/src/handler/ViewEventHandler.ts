import {
  GetViewIdFunction,
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierMultipleContexts,
  IViewEventHandler,
  State,
  ViewEventHandlerContext,
  ViewEventHandlerOptions,
  ViewStoreDocumentOptions,
} from "../types";

export class ViewEventHandler<S extends State = State> implements IViewEventHandler<S> {
  public readonly aggregate: HandlerIdentifierMultipleContexts;
  public readonly conditions: HandlerConditions;
  public readonly documentOptions: ViewStoreDocumentOptions;
  public readonly eventName: string;
  public readonly view: HandlerIdentifier;
  public readonly getViewId: GetViewIdFunction;
  public readonly handler: (ctx: ViewEventHandlerContext<S>) => Promise<void>;

  public constructor(options: ViewEventHandlerOptions<S>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.conditions = options.conditions || {};
    this.documentOptions = options.documentOptions || {};
    this.eventName = options.eventName;
    this.view = { name: options.view.name, context: options.view.context };
    this.getViewId = options.getViewId;
    this.handler = options.handler;
  }
}
