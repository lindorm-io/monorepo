import {
  GetViewIdFunction,
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierMultipleContexts,
  IViewEventHandler,
  ViewEventHandlerContext,
  ViewEventHandlerOptions,
  ViewStoreDocumentOptions,
} from "../types";
import { snakeCase } from "lodash";

export class ViewEventHandler<State extends Record<string, any> = Record<string, any>>
  implements IViewEventHandler<State>
{
  public readonly aggregate: HandlerIdentifierMultipleContexts;
  public readonly conditions: HandlerConditions;
  public readonly documentOptions: ViewStoreDocumentOptions;
  public readonly eventName: string;
  public readonly view: HandlerIdentifier;
  public readonly getViewId: GetViewIdFunction;
  public readonly handler: (ctx: ViewEventHandlerContext<State>) => Promise<void>;

  public constructor(options: ViewEventHandlerOptions<State>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.conditions = options.conditions || {};
    this.documentOptions = options.documentOptions || { collection: snakeCase(options.view.name) };
    this.eventName = options.eventName;
    this.view = { name: options.view.name, context: options.view.context };
    this.getViewId = options.getViewId;
    this.handler = options.handler;
  }
}
